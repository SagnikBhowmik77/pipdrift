import type { BucketId } from "@/lib/buckets";

/**
 * Shared by the client form and the server action. Kept out of actions.ts
 * because a "use server" module may only export async functions.
 */

type FieldName = "merchant" | "amount" | "category" | "bucket";

export type Receipt = {
  transactionId: string;
  merchant: string;
  amountPaise: number;
  roundUpPaise: number;
  bucketId: BucketId;
  bucketName: string;
  bucketTicker: string;
  newBucketBalancePaise: number;
  newTotalPaise: number;
};

export type FormState =
  | { status: "idle"; errors: Partial<Record<FieldName, string>> }
  | { status: "error"; errors: Partial<Record<FieldName, string>> }
  | { status: "success"; errors: Record<string, never>; receipt: Receipt };

export const EMPTY_FORM_STATE: FormState = { status: "idle", errors: {} };
