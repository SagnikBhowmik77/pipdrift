import type { BucketId } from "@/lib/buckets";

/**
 * Kept out of actions.ts because a "use server" module may only export async
 * functions - exporting a constant from one compiles fine and fails at runtime.
 */
export type ExposureFormState = {
  status: "idle" | "success" | "error";
  /** Form-level problem, e.g. an infeasible set of bands. */
  message: string | null;
  /** Per-bucket problems, keyed by bucket. */
  fieldErrors: Partial<Record<BucketId, string>>;
};

export const EMPTY_EXPOSURE_FORM_STATE: ExposureFormState = {
  status: "idle",
  message: null,
  fieldErrors: {},
};
