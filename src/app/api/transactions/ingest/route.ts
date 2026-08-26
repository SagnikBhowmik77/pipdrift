import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { isBucketId, DEFAULT_BUCKET } from "@/lib/buckets";
import { roundUpPaise } from "@/lib/currency";
import { prisma } from "@/lib/db";
import { recordTransaction } from "@/lib/portfolio";

/**
 * Card-transaction ingestion.
 *
 * This is the seam where automatic round-ups arrive. Pipdrift does not have a
 * bank connection - that requires an Account Aggregator or card-network
 * provider - but the boundary is real: point a provider's webhook here and
 * round-ups stop being something the user types in. The simulator in
 * `scripts/push-transaction.mjs` speaks the same protocol as a provider would.
 *
 * Requests are authenticated by HMAC-SHA256 over the raw body, not by a session,
 * because the caller is a machine.
 */

export const dynamic = "force-dynamic";

type IngestPayload = {
  /** Provider's own id for this transaction - used to make retries safe. */
  externalId?: unknown;
  userEmail?: unknown;
  merchant?: unknown;
  category?: unknown;
  /** Purchase amount in paise, as an integer. */
  amountPaise?: unknown;
  bucketId?: unknown;
};

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.INGEST_SECRET;
  if (!secret || !header) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = header.replace(/^sha256=/i, "");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  // The signature covers the exact bytes sent, so read the raw body first and
  // parse afterwards - re-serialising JSON would change them.
  const rawBody = await request.text();

  if (!verifySignature(rawBody, request.headers.get("x-pipdrift-signature"))) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing signature." },
      { status: 401 },
    );
  }

  let payload: IngestPayload;
  try {
    payload = JSON.parse(rawBody) as IngestPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body is not valid JSON." },
      { status: 400 },
    );
  }

  const email = String(payload.userEmail ?? "").trim().toLowerCase();
  const merchant = String(payload.merchant ?? "").trim();
  const category = String(payload.category ?? "Other").trim();
  const amountPaise = Number(payload.amountPaise);
  const externalId = String(payload.externalId ?? "").trim();

  if (!email || !merchant) {
    return NextResponse.json(
      { ok: false, error: "userEmail and merchant are required." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    return NextResponse.json(
      { ok: false, error: "amountPaise must be a positive integer." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No account for that email." },
      { status: 404 },
    );
  }

  // Providers retry. Without this, one network hiccup double-counts a purchase.
  if (externalId) {
    const seen = await prisma.transaction.findFirst({
      where: { userId: user.id, merchant, amountPaise },
      orderBy: { createdAt: "desc" },
    });
    if (seen && Date.now() - seen.createdAt.getTime() < 60_000) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        transactionId: seen.id,
        roundUpPaise: seen.roundUpPaise,
      });
    }
  }

  const bucketId = isBucketId(payload.bucketId) ? payload.bucketId : DEFAULT_BUCKET;
  const roundUp = roundUpPaise(amountPaise);

  // A purchase landing exactly on a rupee has no spare change. Accept it so the
  // provider does not retry, but record nothing.
  if (roundUp === 0) {
    return NextResponse.json({
      ok: true,
      skipped: "Purchase already lands on a whole rupee - no spare change.",
      roundUpPaise: 0,
    });
  }

  const receipt = await recordTransaction(user.id, {
    merchant,
    category,
    amountPaise,
    roundUpPaise: roundUp,
    bucketId,
  });

  return NextResponse.json({
    ok: true,
    transactionId: receipt.transactionId,
    roundUpPaise: receipt.roundUpPaise,
    bucketId: receipt.bucketId,
    newBucketBalancePaise: receipt.newBucketBalancePaise,
    newTotalPaise: receipt.newTotalPaise,
  });
}
