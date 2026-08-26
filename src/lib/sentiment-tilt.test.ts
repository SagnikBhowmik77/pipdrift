import { describe, expect, it } from "vitest";

import {
  applySentimentTilt,
  MAX_TILT_PCT,
  type TiltInput,
} from "./sentiment-tilt";

/**
 * These guard the only path by which a signal, rather than arithmetic, moves
 * a user's money. The invariants matter more than any single number: the
 * result must always sum to 100, must never leave the user's exposure bands,
 * and must never exceed the authority the user granted.
 */

const WIDE = { minPct: 0, maxPct: 100 };

function buckets(overrides: Partial<TiltInput>[] = []): TiltInput[] {
  const base: TiltInput[] = [
    { bucketId: "equities", targetPct: 50, posture: 1, ...WIDE },
    { bucketId: "bonds", targetPct: 30, posture: -1, ...WIDE },
    { bucketId: "emerging", targetPct: 20, posture: 1, ...WIDE },
  ];
  return base.map((b, i) => ({ ...b, ...(overrides[i] ?? {}) }));
}

const sum = (results: { effectiveTargetPct: number }[]) =>
  results.reduce((total, r) => total + r.effectiveTargetPct, 0);

describe("applySentimentTilt", () => {
  it("is inert when the user has granted no authority", () => {
    const result = applySentimentTilt(buckets(), 1, 0);

    expect(result.every((r) => r.deltaPct === 0)).toBe(true);
    expect(sum(result)).toBeCloseTo(100, 6);
  });

  it("is inert on a neutral reading even at full authority", () => {
    const result = applySentimentTilt(buckets(), 0, MAX_TILT_PCT);

    expect(result.every((r) => r.deltaPct === 0)).toBe(true);
  });

  it("moves weight from risk-off into risk-on when sentiment is positive", () => {
    const result = applySentimentTilt(buckets(), 1, 6);
    const byId = Object.fromEntries(result.map((r) => [r.bucketId, r]));

    expect(byId.bonds.deltaPct).toBeLessThan(0);
    expect(byId.equities.deltaPct).toBeGreaterThan(0);
    expect(byId.emerging.deltaPct).toBeGreaterThan(0);
  });

  it("reverses direction when sentiment is negative", () => {
    const result = applySentimentTilt(buckets(), -1, 6);
    const byId = Object.fromEntries(result.map((r) => [r.bucketId, r]));

    expect(byId.bonds.deltaPct).toBeGreaterThan(0);
    expect(byId.equities.deltaPct).toBeLessThan(0);
  });

  it("never moves more than the granted authority", () => {
    for (const score of [-1, -0.5, 0.25, 0.6, 1]) {
      const result = applySentimentTilt(buckets(), score, 6);
      const moved = result
        .filter((r) => r.deltaPct > 0)
        .reduce((total, r) => total + r.deltaPct, 0);

      expect(moved).toBeLessThanOrEqual(6 + 0.01);
    }
  });

  it("clamps authority above MAX_TILT_PCT", () => {
    const abusive = applySentimentTilt(buckets(), 1, 500);
    const capped = applySentimentTilt(buckets(), 1, MAX_TILT_PCT);

    expect(abusive).toEqual(capped);
  });

  it("clamps a score outside -1..1 rather than scaling past it", () => {
    expect(applySentimentTilt(buckets(), 42, 6)).toEqual(
      applySentimentTilt(buckets(), 1, 6),
    );
    expect(applySentimentTilt(buckets(), -42, 6)).toEqual(
      applySentimentTilt(buckets(), -1, 6),
    );
  });

  it("always sums to exactly 100", () => {
    for (const score of [-1, -0.75, -0.2, 0, 0.2, 0.6, 1]) {
      for (const authority of [0, 1, 6, 15]) {
        expect(sum(applySentimentTilt(buckets(), score, authority))).toBeCloseTo(
          100,
          6,
        );
      }
    }
  });

  it("respects exposure bands even under maximum tilt", () => {
    const banded = buckets([
      { targetPct: 50, minPct: 45, maxPct: 55 },
      { targetPct: 30, minPct: 25, maxPct: 35 },
      { targetPct: 20, minPct: 15, maxPct: 25 },
    ]);

    for (const score of [-1, 1]) {
      const result = applySentimentTilt(banded, score, MAX_TILT_PCT);

      for (const r of result) {
        const band = banded.find((b) => b.bucketId === r.bucketId)!;
        expect(r.effectiveTargetPct).toBeGreaterThanOrEqual(band.minPct - 0.01);
        expect(r.effectiveTargetPct).toBeLessThanOrEqual(band.maxPct + 0.01);
      }
      expect(sum(result)).toBeCloseTo(100, 6);
    }
  });

  it("does nothing when every bucket sits on the same side", () => {
    const allRiskOn: TiltInput[] = [
      { bucketId: "equities", targetPct: 60, posture: 1, ...WIDE },
      { bucketId: "emerging", targetPct: 40, posture: 1, ...WIDE },
    ];

    const result = applySentimentTilt(allRiskOn, 1, 6);
    expect(result.every((r) => r.deltaPct === 0)).toBe(true);
  });

  it("handles a locked portfolio without breaking the total", () => {
    const locked = buckets([
      { targetPct: 50, minPct: 50, maxPct: 50 },
      { targetPct: 30, minPct: 30, maxPct: 30 },
      { targetPct: 20, minPct: 20, maxPct: 20 },
    ]);

    const result = applySentimentTilt(locked, 1, MAX_TILT_PCT);
    expect(result.every((r) => r.deltaPct === 0)).toBe(true);
    expect(sum(result)).toBeCloseTo(100, 6);
  });

  it("returns an empty plan for an empty portfolio", () => {
    expect(applySentimentTilt([], 1, 6)).toEqual([]);
  });
});
