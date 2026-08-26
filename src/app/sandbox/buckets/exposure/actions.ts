"use server";

import { revalidatePath } from "next/cache";

import { BUCKETS, type BucketId } from "@/lib/buckets";
import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import type { ExposureFormState } from "./form-state";

type Band = { minPct: number; maxPct: number };

export async function saveExposureCaps(
  _prev: ExposureFormState,
  formData: FormData,
): Promise<ExposureFormState> {
  const userId = await getSessionUserId();

  const current = await prisma.bucketAllocation.findMany({
    where: { userId },
    select: { bucketId: true, targetPct: true },
  });
  const targetOf = new Map(current.map((b) => [b.bucketId, b.targetPct]));

  const bands: Partial<Record<BucketId, Band>> = {};
  const fieldErrors: ExposureFormState["fieldErrors"] = {};

  for (const bucket of BUCKETS) {
    const rawMin = String(formData.get(`min-${bucket.id}`) ?? "");
    const rawMax = String(formData.get(`max-${bucket.id}`) ?? "");
    const minPct = Number(rawMin);
    const maxPct = Number(rawMax);

    if (!rawMin.trim() || !Number.isFinite(minPct) || minPct < 0 || minPct > 100) {
      fieldErrors[bucket.id] = "Minimum must be between 0 and 100.";
      continue;
    }
    if (!rawMax.trim() || !Number.isFinite(maxPct) || maxPct < 0 || maxPct > 100) {
      fieldErrors[bucket.id] = "Maximum must be between 0 and 100.";
      continue;
    }
    if (minPct > maxPct) {
      fieldErrors[bucket.id] = "Minimum cannot exceed maximum.";
      continue;
    }

    // The band has to contain the target, or the rebalancer would be asked to
    // hit a number its own caps forbid.
    const target = targetOf.get(bucket.id);
    if (target !== undefined && (target < minPct || target > maxPct)) {
      fieldErrors[bucket.id] =
        `Target is ${target}% - widen the band or change the target first.`;
      continue;
    }

    bands[bucket.id] = { minPct, maxPct };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: null, fieldErrors };
  }

  const values = BUCKETS.map((b) => bands[b.id]!);
  const minSum = values.reduce((sum, b) => sum + b.minPct, 0);
  const maxSum = values.reduce((sum, b) => sum + b.maxPct, 0);

  // Feasibility: a portfolio is 100% of itself. If the minimums already demand
  // more than 100, or the maximums cannot reach 100, no allocation satisfies
  // every band and the rebalancer would have no valid destination.
  if (minSum > 100) {
    return {
      status: "error",
      message: `Minimums add up to ${minSum}% - no allocation can satisfy them all. Lower one of them.`,
      fieldErrors: {},
    };
  }
  if (maxSum < 100) {
    return {
      status: "error",
      message: `Maximums only add up to ${maxSum}% - they leave ${100 - maxSum}% of the portfolio with nowhere to go. Raise one of them.`,
      fieldErrors: {},
    };
  }

  await prisma.$transaction(
    BUCKETS.map((bucket) =>
      prisma.bucketAllocation.update({
        where: { userId_bucketId: { userId, bucketId: bucket.id } },
        data: bands[bucket.id]!,
      }),
    ),
  );

  revalidatePath("/sandbox");
  revalidatePath("/sandbox/buckets");
  revalidatePath("/sandbox/buckets/exposure");

  return { status: "success", message: "Exposure caps saved.", fieldErrors: {} };
}
