import { beforeEach, describe, expect, it, vi } from "vitest";

import { balancesOf, seedUser } from "@/test/factories";

/**
 * The rebalance tick, end to end against a real database.
 *
 * The signal layer is mocked: a test that reaches the live RSS feeds and a
 * hosted model would be slow, non-deterministic, and would fail offline. What
 * is exercised for real is everything downstream - drift detection, the
 * transaction that moves balances, the audit rows, and the broker receipts.
 */

const collectSignals = vi.fn();
const readSentiment = vi.fn();

vi.mock("./agents/registry", () => ({
  collectSignals: (...args: unknown[]) => collectSignals(...args),
  readSentiment: (...args: unknown[]) => readSentiment(...args),
}));

const NEUTRAL = { score: 0, tags: [], label: "neutral" as const };

beforeEach(() => {
  collectSignals.mockResolvedValue([]);
  readSentiment.mockResolvedValue(NEUTRAL);
});

async function tick(userId: string) {
  const { runRebalanceTick } = await import("./rebalance");
  return runRebalanceTick(userId);
}

describe("runRebalanceTick", () => {
  it("does nothing to an empty portfolio", async () => {
    const user = await seedUser();
    const result = await tick(user.id);

    expect(result.rebalanced).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.orders).toEqual([]);
  });

  it("leaves a portfolio inside its threshold alone", async () => {
    const user = await seedUser({
      balancesPaise: { equities: 5_000, bonds: 3_000, emerging: 2_000 },
    });

    const result = await tick(user.id);

    expect(result.rebalanced).toBe(false);
    expect(await balancesOf(user.id)).toMatchObject({ equities: 5_000 });
  });

  it("moves balances back to target once drift breaches the threshold", async () => {
    const user = await seedUser({
      driftThresholdPct: 3,
      balancesPaise: { equities: 8_000, bonds: 1_000, emerging: 1_000 },
    });

    const result = await tick(user.id);
    const after = await balancesOf(user.id);

    expect(result.rebalanced).toBe(true);
    expect(after.equities).toBe(5_000);
    expect(after.bonds).toBe(3_000);
    expect(after.emerging).toBe(2_000);
  });

  it("conserves the total across a rebalance - money is moved, never created", async () => {
    const user = await seedUser({
      driftThresholdPct: 3,
      balancesPaise: { equities: 7_777, bonds: 1_111, emerging: 999 },
    });

    const before = Object.values(await balancesOf(user.id)).reduce((a, b) => a + b, 0);
    await tick(user.id);
    const after = Object.values(await balancesOf(user.id)).reduce((a, b) => a + b, 0);

    expect(after).toBe(before);
  });

  it("writes one audit row per breaching bucket", async () => {
    const user = await seedUser({
      driftThresholdPct: 3,
      balancesPaise: { equities: 8_000, bonds: 1_000, emerging: 1_000 },
    });

    const result = await tick(user.id);
    const { prisma } = await import("./db");
    const rows = await prisma.rebalanceEvent.findMany({ where: { userId: user.id } });

    expect(rows.length).toBe(result.events.length);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.beforePct).not.toBe(row.afterPct);
  });

  it("writes nothing when it changes nothing - history is decisions, not ticks", async () => {
    const user = await seedUser({
      balancesPaise: { equities: 5_000, bonds: 3_000, emerging: 2_000 },
    });

    await tick(user.id);
    const { prisma } = await import("./db");

    expect(await prisma.rebalanceEvent.count({ where: { userId: user.id } })).toBe(0);
  });

  it("produces broker receipts that are never marked filled", async () => {
    const user = await seedUser({
      driftThresholdPct: 3,
      balancesPaise: { equities: 8_000, bonds: 1_000, emerging: 1_000 },
    });

    const result = await tick(user.id);

    expect(result.orders.length).toBeGreaterThan(0);
    expect(result.orders.every((o) => o.status === "simulated")).toBe(true);
  });

  it("balances buys against sells", async () => {
    const user = await seedUser({
      driftThresholdPct: 3,
      balancesPaise: { equities: 8_000, bonds: 1_000, emerging: 1_000 },
    });

    const { orders } = await tick(user.id);
    const buys = orders.filter((o) => o.intent.side === "buy");
    const sells = orders.filter((o) => o.intent.side === "sell");

    expect(buys.reduce((s, o) => s + o.intent.amountPaise, 0)).toBe(
      sells.reduce((s, o) => s + o.intent.amountPaise, 0),
    );
  });

  it("ignores sentiment when the user granted no tilt authority", async () => {
    readSentiment.mockResolvedValue({ score: 1, tags: ["llm:positive"], label: "positive" });

    const user = await seedUser({
      sentimentTiltPct: 0,
      balancesPaise: { equities: 5_000, bonds: 3_000, emerging: 2_000 },
    });

    const result = await tick(user.id);

    // News must never move a portfolio the user did not open to it.
    expect(result.rebalanced).toBe(false);
  });

  it("rebalances a bucket outside its exposure cap even without drift", async () => {
    const user = await seedUser({
      driftThresholdPct: 90,
      balancesPaise: { equities: 5_000, bonds: 3_000, emerging: 2_000 },
      caps: { equities: { minPct: 0, maxPct: 10 } },
    });

    const result = await tick(user.id);

    expect(result.rebalanced).toBe(true);
  });
});
