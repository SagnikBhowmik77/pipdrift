import type { BucketId } from "./buckets";

/**
 * Categorical slots 1-3 stepped for the dark chart surface (#0b1220).
 * Validated as a set for all-pairs use (a pie puts every slice next to every
 * other): worst CVD ΔE 9.4, worst normal-vision ΔE 20.9, all ≥3:1 on surface.
 * Re-run the validator before changing a hex - do not eyeball substitutes.
 */
export const CHART_SURFACE = "#0b1220";

export const BUCKET_COLORS: Record<BucketId, string> = {
  equities: "#3987e5",
  bonds: "#d95926",
  emerging: "#199e70",
};
