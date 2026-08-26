/**
 * Sentiment tilt - the only path by which a signal, rather than arithmetic,
 * changes where money goes.
 *
 * Three constraints make this safe enough to ship:
 *   1. It is off by default (tiltPct 0) and capped at MAX_TILT_PCT.
 *   2. It can never move a bucket outside the exposure band the user set.
 *   3. The result always sums to exactly 100, so the rebalancer still has a
 *      well-defined destination.
 *
 * Pure and side-effect free so it can be reasoned about and tested directly.
 */

export const MAX_TILT_PCT = 15;

export type TiltInput = {
  bucketId: string;
  targetPct: number;
  minPct: number;
  maxPct: number;
  /**
   * How this bucket responds to risk appetite: +1 risk-on (leans in when
   * sentiment is positive), -1 risk-off (the destination when it is negative).
   */
  posture: 1 | -1 | 0;
};

export type TiltResult = {
  bucketId: string;
  /** The target the rebalancer should actually aim at this tick. */
  effectiveTargetPct: number;
  /** Signed change from the user's configured target. */
  deltaPct: number;
};

/** Risk posture per default bucket. Bonds are the shock absorber. */
export const BUCKET_POSTURE: Record<string, 1 | -1 | 0> = {
  equities: 1,
  bonds: -1,
  emerging: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Shifts weight between risk-on and risk-off buckets in proportion to the
 * sentiment score, then repairs the total so it lands on exactly 100.
 *
 * `score` is -1..1. `tiltPct` is the user's maximum authority in percentage
 * points; a score of 1.0 with tiltPct 6 moves at most 6 points.
 */
export function applySentimentTilt(
  buckets: TiltInput[],
  score: number,
  tiltPct: number,
): TiltResult[] {
  const authority = clamp(tiltPct, 0, MAX_TILT_PCT);
  const magnitude = clamp(score, -1, 1) * authority;

  if (authority === 0 || magnitude === 0 || buckets.length === 0) {
    return buckets.map((b) => ({
      bucketId: b.bucketId,
      effectiveTargetPct: b.targetPct,
      deltaPct: 0,
    }));
  }

  const riskOn = buckets.filter((b) => b.posture === 1);
  const riskOff = buckets.filter((b) => b.posture === -1);

  // Nothing to trade against - a tilt needs both a source and a destination.
  if (riskOn.length === 0 || riskOff.length === 0) {
    return buckets.map((b) => ({
      bucketId: b.bucketId,
      effectiveTargetPct: b.targetPct,
      deltaPct: 0,
    }));
  }

  // Positive sentiment moves weight from risk-off into risk-on, and vice
  // versa. Splitting evenly within each side keeps the total shift equal to
  // `magnitude` regardless of how many buckets sit on each side.
  const desired = new Map<string, number>();
  for (const b of buckets) {
    const share =
      b.posture === 1
        ? magnitude / riskOn.length
        : b.posture === -1
          ? -magnitude / riskOff.length
          : 0;
    desired.set(b.bucketId, b.targetPct + share);
  }

  // Clamping to the exposure bands breaks the sum, so redistribute whatever is
  // left over among the buckets that still have room in the needed direction.
  const clamped = new Map<string, number>();
  for (const b of buckets) {
    clamped.set(b.bucketId, clamp(desired.get(b.bucketId)!, b.minPct, b.maxPct));
  }

  let residual =
    100 - [...clamped.values()].reduce((sum, value) => sum + value, 0);

  // Bounded loop: each pass either places the residual or exhausts headroom.
  for (let pass = 0; pass < buckets.length && Math.abs(residual) > 0.001; pass++) {
    const movable = buckets.filter((b) => {
      const value = clamped.get(b.bucketId)!;
      return residual > 0 ? value < b.maxPct : value > b.minPct;
    });

    if (movable.length === 0) break;

    const slice = residual / movable.length;
    for (const b of movable) {
      const value = clamped.get(b.bucketId)!;
      const next = clamp(value + slice, b.minPct, b.maxPct);
      residual -= next - value;
      clamped.set(b.bucketId, next);
    }
  }

  const settled = roundPreservingTotal(buckets, clamped);

  return buckets.map((b) => {
    const effective = settled.get(b.bucketId)!;
    return {
      bucketId: b.bucketId,
      effectiveTargetPct: effective,
      deltaPct: round2(effective - b.targetPct),
    };
  });
}

/**
 * Rounds every bucket to 2dp while keeping the total at exactly 100.
 *
 * Rounding each bucket independently does not: three buckets landing on .625
 * each round up and invent a paisa, which is how this returned 100.01 and left
 * the rebalancer aiming at a target that did not exist. So the rounding error
 * is measured once and then walked back onto whichever buckets still have room
 * inside their exposure band, a paisa at a time.
 */
function roundPreservingTotal(
  buckets: TiltInput[],
  values: Map<string, number>,
): Map<string, number> {
  const rounded = new Map<string, number>(
    buckets.map((b) => [b.bucketId, round2(values.get(b.bucketId)!)]),
  );

  let drift = round2(
    100 - [...rounded.values()].reduce((sum, value) => sum + value, 0),
  );
  if (Math.abs(drift) < 0.001) return rounded;

  const step = drift > 0 ? 0.01 : -0.01;

  // Largest buckets absorb first: a paisa is least visible where the number is
  // biggest. Bounded by the number of paise in play, so it cannot spin.
  const order = [...buckets].sort(
    (a, b) =>
      (rounded.get(b.bucketId) ?? 0) - (rounded.get(a.bucketId) ?? 0) ||
      a.bucketId.localeCompare(b.bucketId),
  );

  for (let guard = 0; Math.abs(drift) > 0.001 && guard < 10_000; guard++) {
    const absorber = order.find((b) => {
      const next = round2(rounded.get(b.bucketId)! + step);
      return next >= b.minPct - 1e-9 && next <= b.maxPct + 1e-9;
    });

    // Every bucket is pinned against a band; the caller sees the honest total
    // rather than a number forced outside the limits the user set.
    if (!absorber) break;

    rounded.set(absorber.bucketId, round2(rounded.get(absorber.bucketId)! + step));
    drift = round2(drift - step);
  }

  return rounded;
}
