import { describe, expect, it } from "vitest";

import { planTargetPaise } from "./rebalance";

/**
 * Largest-remainder allocation. The invariant that matters: the plan must
 * distribute the total exactly - never inventing a paisa, never dropping one.
 * Naive rounding does both, and over enough ticks it silently corrupts the
 * ledger with no error to trace.
 */

const DEFAULT = [
  { bucketId: "equities" as const, targetPct: 50 },
  { bucketId: "bonds" as const, targetPct: 30 },
  { bucketId: "emerging" as const, targetPct: 20 },
];

const total = (plan: Map<string, number>) =>
  [...plan.values()].reduce((sum, paise) => sum + paise, 0);

describe("planTargetPaise", () => {
  it("splits a clean total exactly on target", () => {
    const plan = planTargetPaise(DEFAULT, 10_000);

    expect(plan.get("equities")).toBe(5_000);
    expect(plan.get("bonds")).toBe(3_000);
    expect(plan.get("emerging")).toBe(2_000);
  });

  it("conserves the total when the split does not divide evenly", () => {
    for (const paise of [1, 7, 33, 101, 999, 1_234, 100_003]) {
      expect(total(planTargetPaise(DEFAULT, paise))).toBe(paise);
    }
  });

  it("conserves the total across many awkward amounts", () => {
    for (let paise = 0; paise < 500; paise++) {
      expect(total(planTargetPaise(DEFAULT, paise))).toBe(paise);
    }
  });

  it("never allocates a negative amount", () => {
    for (const paise of [0, 1, 3, 97, 12_345]) {
      const plan = planTargetPaise(DEFAULT, paise);
      for (const value of plan.values()) expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles a zero balance", () => {
    const plan = planTargetPaise(DEFAULT, 0);

    expect(total(plan)).toBe(0);
    expect([...plan.values()].every((v) => v === 0)).toBe(true);
  });

  it("gives everything to a single 100% bucket", () => {
    const plan = planTargetPaise([{ bucketId: "equities", targetPct: 100 }], 777);

    expect(plan.get("equities")).toBe(777);
  });

  it("is deterministic - the same input always plans the same way", () => {
    const a = planTargetPaise(DEFAULT, 1_001);
    const b = planTargetPaise(DEFAULT, 1_001);

    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  it("stays within a paisa of the ideal share", () => {
    const paise = 100_001;
    const plan = planTargetPaise(DEFAULT, paise);

    for (const position of DEFAULT) {
      const ideal = (position.targetPct / 100) * paise;
      expect(Math.abs(plan.get(position.bucketId)! - ideal)).toBeLessThan(1);
    }
  });

  it("conserves the total even when targets do not sum to 100", () => {
    // Defensive: a malformed allocation should not silently mint or burn paise.
    const lopsided = [
      { bucketId: "equities" as const, targetPct: 40 },
      { bucketId: "bonds" as const, targetPct: 40 },
    ];

    expect(total(planTargetPaise(lopsided, 1_000))).toBe(1_000);
  });
});
