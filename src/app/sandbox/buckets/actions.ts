"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { BUCKETS, isBucketId, type BucketId } from "@/lib/buckets";
import { prisma } from "@/lib/db";
import { getRiskProfile, RISK_PROFILES } from "@/lib/risk-profiles";
import { getSessionUserId } from "@/lib/session";
import type { BucketFormState } from "./form-state";

const MIN_THRESHOLD = 0.5;
const MAX_THRESHOLD = 50;

export async function saveBucketConfig(
  _prev: BucketFormState,
  formData: FormData,
): Promise<BucketFormState> {
  const userId = await getSessionUserId();

  const targets: Partial<Record<BucketId, number>> = {};
  for (const bucket of BUCKETS) {
    const raw = String(formData.get(`target-${bucket.id}`) ?? "");
    const value = Number(raw);

    if (!raw.trim() || !Number.isFinite(value) || value < 0 || value > 100) {
      return {
        status: "error",
        message: `${bucket.name} target must be between 0 and 100.`,
      };
    }
    targets[bucket.id] = value;
  }

  const sum = Object.values(targets).reduce((a, b) => a + b, 0);
  // Targets are a division of one portfolio; anything but 100 leaves the
  // rebalancer without a well-defined destination.
  if (Math.round(sum * 100) / 100 !== 100) {
    return {
      status: "error",
      message: `Targets must sum to 100% - they currently sum to ${sum}%.`,
    };
  }

  // Targets and exposure caps must agree, whichever page is edited.
  const bands = await prisma.bucketAllocation.findMany({
    where: { userId },
    select: { bucketId: true, minPct: true, maxPct: true },
  });
  for (const band of bands) {
    if (!isBucketId(band.bucketId)) continue;
    const target = targets[band.bucketId];
    if (target === undefined) continue;

    if (target < band.minPct || target > band.maxPct) {
      const name = BUCKETS.find((b) => b.id === band.bucketId)?.name ?? band.bucketId;
      return {
        status: "error",
        message: `${name} target of ${target}% falls outside its ${band.minPct}-${band.maxPct}% exposure cap.`,
      };
    }
  }

  const threshold = Number(formData.get("threshold"));
  if (
    !Number.isFinite(threshold) ||
    threshold < MIN_THRESHOLD ||
    threshold > MAX_THRESHOLD
  ) {
    return {
      status: "error",
      message: `Drift threshold must be between ${MIN_THRESHOLD}% and ${MAX_THRESHOLD}%.`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { driftThresholdPct: threshold, riskProfile: "custom" },
    });

    for (const bucket of BUCKETS) {
      await tx.bucketAllocation.update({
        where: { userId_bucketId: { userId, bucketId: bucket.id } },
        data: { targetPct: targets[bucket.id]! },
      });
    }
  });

  revalidatePath("/sandbox");
  revalidatePath("/sandbox/buckets");
  revalidatePath("/sandbox/profile");

  return { status: "success", message: "Targets saved." };
}

/**
 * Applies a preset's targets wholesale - the roadmap's risk-profile selector.
 * Invoked as a plain form action, so it takes formData alone and reports
 * through a redirect-free revalidate rather than a returned state.
 */
export async function applyRiskProfile(formData: FormData): Promise<void> {
  const userId = await getSessionUserId();
  const profileId = String(formData.get("profile") ?? "");

  if (!RISK_PROFILES.some((p) => p.id === profileId)) return;

  const profile = getRiskProfile(profileId);

  // A preset that would push a bucket outside its own exposure cap is refused
  // rather than silently widening the cap the user set.
  const bands = await prisma.bucketAllocation.findMany({
    where: { userId },
    select: { bucketId: true, minPct: true, maxPct: true },
  });
  const conflict = bands.some((band) => {
    if (!isBucketId(band.bucketId)) return false;
    const target = profile.targets[band.bucketId];
    return target < band.minPct || target > band.maxPct;
  });

  if (conflict) redirect(`/sandbox/profile?conflict=${profile.id}`);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { riskProfile: profile.id },
    });

    for (const [bucketId, targetPct] of Object.entries(profile.targets)) {
      if (!isBucketId(bucketId)) continue;
      await tx.bucketAllocation.update({
        where: { userId_bucketId: { userId, bucketId } },
        data: { targetPct },
      });
    }
  });

  revalidatePath("/sandbox");
  revalidatePath("/sandbox/buckets");
  revalidatePath("/sandbox/profile");

  // Round-trips the confirmation through the URL so the page can toast it -
  // a plain form action has no return channel to the client.
  redirect(`/sandbox/profile?applied=${profile.id}`);
}
