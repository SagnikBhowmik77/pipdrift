"use server";

import { revalidatePath } from "next/cache";

import { DEFAULT_BUCKET, isBucketId } from "@/lib/buckets";
import { isCategory } from "@/lib/categories";
import { recordTransaction } from "@/lib/portfolio";
import { parseAmountToPaise, roundUpPaise } from "@/lib/currency";
import { getSessionUserId } from "@/lib/session";
import type { FormState } from "./form-state";

export async function createTransaction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const merchant = String(formData.get("merchant") ?? "").trim();
  const amountPaise = parseAmountToPaise(String(formData.get("amount") ?? ""));
  const category = formData.get("category");
  const bucketId = formData.get("bucket") ?? DEFAULT_BUCKET;

  const errors: Partial<Record<string, string>> = {};

  if (!merchant) {
    errors.merchant = "Where did you spend it?";
  } else if (merchant.length > 60) {
    errors.merchant = "Keep it under 60 characters.";
  }

  if (amountPaise === null) {
    errors.amount = "Enter an amount like 128.40.";
  } else if (amountPaise === 0) {
    errors.amount = "A ₹0.00 purchase has no spare change.";
  }

  if (!isCategory(category)) errors.category = "Pick a category.";
  if (!isBucketId(bucketId)) errors.bucket = "Pick a bucket.";

  // The guards do double duty: they report the errors above and narrow the raw
  // FormData values to their real types below.
  if (
    Object.keys(errors).length > 0 ||
    amountPaise === null ||
    !isCategory(category) ||
    !isBucketId(bucketId)
  ) {
    return { status: "error", errors };
  }

  const userId = await getSessionUserId();

  const receipt = await recordTransaction(userId, {
    merchant,
    category,
    amountPaise,
    roundUpPaise: roundUpPaise(amountPaise),
    bucketId,
  });

  revalidatePath("/sandbox");
  revalidatePath("/sandbox/buckets");

  return { status: "success", errors: {}, receipt };
}
