"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { MAX_TILT_PCT } from "@/lib/sentiment-tilt";
import { getSessionUserId } from "@/lib/session";
import type { AuthorityState } from "./form-state";

export async function saveAgentAuthority(
  _prev: AuthorityState,
  formData: FormData,
): Promise<AuthorityState> {
  const userId = await getSessionUserId();

  const tilt = Number(formData.get("sentimentTiltPct"));
  const autoRebalance = formData.get("autoRebalance") === "on";

  if (!Number.isFinite(tilt) || tilt < 0 || tilt > MAX_TILT_PCT) {
    return {
      status: "error",
      message: `Sentiment authority must be between 0 and ${MAX_TILT_PCT} points.`,
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { sentimentTiltPct: tilt, autoRebalance },
  });

  revalidatePath("/sandbox");
  revalidatePath("/sandbox/profile");

  return {
    status: "success",
    message:
      tilt === 0
        ? "Saved. Sentiment will be logged but will not move money."
        : `Saved. Agents may tilt targets up to ${tilt} points.`,
  };
}
