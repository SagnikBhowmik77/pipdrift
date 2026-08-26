import { describe, expect, it } from "vitest";

import { getBroker, toOrderIntents } from "./registry";

/**
 * The seam that keeps "we moved the ledger" and "we bought something" separate.
 * The critical assertion is the boring one: the default broker must never
 * report itself as live.
 */

describe("getBroker", () => {
  it("defaults to a broker that is not live", () => {
    expect(getBroker().isLive).toBe(false);
  });

  it("never reports an order as filled without a venue", async () => {
    const receipts = await getBroker().placeOrders([
      { bucketId: "equities", symbol: "NIFTYBEES", side: "buy", amountPaise: 5_000 },
    ]);

    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe("simulated");
    expect(receipts[0].brokerOrderId).toBeUndefined();
    expect(receipts[0].note).toMatch(/no order placed/i);
  });

  it("returns nothing for an empty batch", async () => {
    expect(await getBroker().placeOrders([])).toEqual([]);
  });
});

describe("toOrderIntents", () => {
  const move = (bucketId: string, fromPaise: number, toPaise: number) => ({
    bucketId,
    symbol: `${bucketId.toUpperCase()}ETF`,
    fromPaise,
    toPaise,
  });

  it("buys when a bucket needs to grow", () => {
    const [intent] = toOrderIntents([move("equities", 1_000, 1_500)]);

    expect(intent.side).toBe("buy");
    expect(intent.amountPaise).toBe(500);
  });

  it("sells when a bucket needs to shrink", () => {
    const [intent] = toOrderIntents([move("bonds", 2_000, 1_250)]);

    expect(intent.side).toBe("sell");
    expect(intent.amountPaise).toBe(750);
  });

  it("emits nothing for a bucket that did not move", () => {
    expect(toOrderIntents([move("equities", 1_000, 1_000)])).toEqual([]);
  });

  it("never emits a negative amount", () => {
    const intents = toOrderIntents([
      move("a", 5_000, 0),
      move("b", 0, 5_000),
      move("c", 100, 99),
    ]);

    expect(intents.every((i) => i.amountPaise > 0)).toBe(true);
  });

  it("keeps buys and sells balanced when the total is conserved", () => {
    const intents = toOrderIntents([
      move("equities", 5_000, 6_000),
      move("bonds", 3_000, 2_000),
      move("emerging", 2_000, 2_000),
    ]);

    const buys = intents.filter((i) => i.side === "buy").reduce((s, i) => s + i.amountPaise, 0);
    const sells = intents.filter((i) => i.side === "sell").reduce((s, i) => s + i.amountPaise, 0);

    expect(buys).toBe(sells);
  });

  it("carries the instrument through so a venue knows what to trade", () => {
    expect(toOrderIntents([move("equities", 0, 100)])[0].symbol).toBe("EQUITIESETF");
  });
});
