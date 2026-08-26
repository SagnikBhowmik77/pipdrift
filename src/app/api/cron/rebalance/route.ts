import { NextResponse, type NextRequest } from "next/server";
import { reportError } from "@/lib/observability";
import { timingSafeEqual } from "node:crypto";

import { runScheduledTicks } from "@/lib/agent-runner";

/**
 * The scheduler's entry point. Call this from Vercel Cron, GitHub Actions,
 * systemd, or `npm run agent:watch` - anything that can make an HTTP request on
 * a timer. It ticks every user who has auto-rebalancing enabled.
 *
 * Auth is a shared secret rather than a user session, because no user is
 * present when a scheduler fires.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret the endpoint is disabled rather
  // than open, so a misconfigured deploy cannot be triggered by anyone.
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "");
  if (provided.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 },
    );
  }

  try {
    const summary = await runScheduledTicks("scheduled");
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[api/cron/rebalance] run failed", error);
    void reportError("api.cron.rebalance", error);
    return NextResponse.json(
      { ok: false, error: "Scheduled run failed." },
      { status: 500 },
    );
  }
}

// GET as well as POST: most hosted cron products only issue GET.
export const GET = handle;
export const POST = handle;
