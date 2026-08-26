import { describe, expect, it } from "vitest";

import { balancesOf, seedUser } from "@/test/factories";
import { getPortfolio, recordTransaction } from "./portfolio";

/**
 * The ledger. These run against a real database because the thing worth
 * checking is the transaction boundary - that a logged purchase and the credit
 * it implies can never come apart.
 */

describe("recordTransaction", () => {
  it("credits the round-up to the chosen bucket", async () => {
    const user = await seedUser();

    const receipt = await recordTransaction(user.id, {
      merchant: "Corner Coffee",
      category: "Dining",
      amountPaise: 435,
      roundUpPaise: 65,
      bucketId: "bonds",
    });

    expect(receipt.newBucketBalancePaise).toBe(65);
    expect(receipt.newTotalPaise).toBe(65);
    expect(await balancesOf(user.id)).toMatchObject({
      bonds: 65,
      equities: 0,
      emerging: 0,
    });
  });

  it("accumulates across purchases", async () => {
    const user = await seedUser();

    for (const paise of [65, 40, 5]) {
      await recordTransaction(user.id, {
        merchant: "Shop",
        category: "Shopping",
        amountPaise: 100 - paise,
        roundUpPaise: paise,
        bucketId: "equities",
      });
    }

    expect((await balancesOf(user.id)).equities).toBe(110);
  });

  it("reports the bucket's instrument on the receipt", async () => {
    const user = await seedUser();

    const receipt = await recordTransaction(user.id, {
      merchant: "Shop",
      category: "Other",
      amountPaise: 990,
      roundUpPaise: 10,
      bucketId: "equities",
    });

    expect(receipt.bucketTicker).toBe("NIFTYBEES");
  });

  it("leaves no transaction behind when the credit cannot apply", async () => {
    const user = await seedUser();
    await prismaDeleteBucket(user.id, "bonds");

    await expect(
      recordTransaction(user.id, {
        merchant: "Ghost",
        category: "Other",
        amountPaise: 100,
        roundUpPaise: 50,
        bucketId: "bonds",
      }),
    ).rejects.toThrow();

    // The insert and the increment share a transaction, so a failed credit must
    // not leave a logged purchase claiming money that was never moved.
    const { getRecentTransactions } = await import("./portfolio");
    const logged = await getRecentTransactions(user.id, 10);
    expect(logged.some((t) => t.merchant === "Ghost")).toBe(false);
  });

  it("keeps a zero round-up from inventing money", async () => {
    const user = await seedUser();

    const receipt = await recordTransaction(user.id, {
      merchant: "Exact",
      category: "Other",
      amountPaise: 5_000,
      roundUpPaise: 0,
      bucketId: "equities",
    });

    expect(receipt.newTotalPaise).toBe(0);
  });
});

describe("getPortfolio", () => {
  it("reports current percentages from real balances", async () => {
    const user = await seedUser({
      balancesPaise: { equities: 5_000, bonds: 3_000, emerging: 2_000 },
    });

    const portfolio = await getPortfolio(user.id);
    const byId = Object.fromEntries(
      portfolio.positions.map((p) => [p.bucketId, p]),
    );

    expect(portfolio.totalPaise).toBe(10_000);
    expect(byId.equities.currentPct).toBeCloseTo(50, 4);
    expect(byId.bonds.currentPct).toBeCloseTo(30, 4);
  });

  it("does not divide by zero on an empty portfolio", async () => {
    const user = await seedUser();
    const portfolio = await getPortfolio(user.id);

    expect(portfolio.totalPaise).toBe(0);
    expect(portfolio.positions.every((p) => Number.isFinite(p.currentPct))).toBe(
      true,
    );
  });

  it("returns every bucket even when untouched", async () => {
    const user = await seedUser();
    expect((await getPortfolio(user.id)).positions).toHaveLength(3);
  });
});

async function prismaDeleteBucket(userId: string, bucketId: string) {
  const { prisma } = await import("./db");
  await prisma.bucketAllocation.delete({
    where: { userId_bucketId: { userId, bucketId } },
  });
}
