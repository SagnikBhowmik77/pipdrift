import "server-only";

import { BUCKETS, getBucket, type BucketId } from "./buckets";
import { prisma } from "./db";

export type BucketPosition = {
  bucketId: BucketId;
  name: string;
  ticker: string;
  balancePaise: number;
  targetPct: number;
  /** Share of the portfolio this bucket actually holds right now. */
  currentPct: number;
  /** Signed gap from target, in percentage points. Positive = overweight. */
  driftPct: number;
  /** Exposure band this bucket must stay inside. */
  minPct: number;
  maxPct: number;
  /** True when the bucket has drifted outside its own exposure band. */
  capBreached: boolean;
};

export type Portfolio = {
  userId: string;
  totalPaise: number;
  transactionCount: number;
  driftThresholdPct: number;
  riskProfile: string;
  /** Percentage points of authority the agents have to tilt on sentiment. */
  sentimentTiltPct: number;
  autoRebalance: boolean;
  positions: BucketPosition[];
  /** True when at least one bucket has drifted past the user's threshold. */
  needsRebalance: boolean;
};

export async function getPortfolio(userId: string): Promise<Portfolio> {
  const [user, transactionCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { buckets: true },
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  const byBucket = new Map(user.buckets.map((b) => [b.bucketId, b]));
  const totalPaise = user.buckets.reduce((sum, b) => sum + b.balancePaise, 0);

  const positions: BucketPosition[] = BUCKETS.map((bucket) => {
    const row = byBucket.get(bucket.id);
    const balancePaise = row?.balancePaise ?? 0;
    const targetPct = row?.targetPct ?? 0;
    const minPct = row?.minPct ?? 0;
    const maxPct = row?.maxPct ?? 100;

    // With an empty portfolio every bucket is at 0% by definition, not
    // "100 points underweight" - reporting drift here would trip the agents
    // on a portfolio that holds nothing to move.
    const currentPct = totalPaise === 0 ? 0 : (balancePaise / totalPaise) * 100;
    const driftPct = totalPaise === 0 ? 0 : currentPct - targetPct;

    return {
      bucketId: bucket.id,
      name: bucket.name,
      ticker: bucket.ticker,
      balancePaise,
      targetPct,
      currentPct,
      driftPct,
      minPct,
      maxPct,
      // An empty portfolio is not "outside its band" - it holds nothing.
      capBreached:
        totalPaise > 0 && (currentPct < minPct || currentPct > maxPct),
    };
  });

  return {
    userId,
    totalPaise,
    transactionCount,
    driftThresholdPct: user.driftThresholdPct,
    riskProfile: user.riskProfile,
    sentimentTiltPct: user.sentimentTiltPct,
    autoRebalance: user.autoRebalance,
    positions,
    // Either trigger justifies a rebalance: ordinary drift, or a bucket that
    // has wandered outside the exposure band the user set for it.
    needsRebalance: positions.some(
      (p) => Math.abs(p.driftPct) > user.driftThresholdPct || p.capBreached,
    ),
  };
}

export type RecordTransactionInput = {
  merchant: string;
  category: string;
  amountPaise: number;
  roundUpPaise: number;
  bucketId: BucketId;
};

export type TransactionReceipt = {
  transactionId: string;
  merchant: string;
  amountPaise: number;
  roundUpPaise: number;
  bucketId: BucketId;
  bucketName: string;
  bucketTicker: string;
  /** Bucket balance *after* the credit - what the confirmation panel shows. */
  newBucketBalancePaise: number;
  newTotalPaise: number;
};

/**
 * Credits the round-up to a bucket. The insert and the balance increment go in
 * one transaction so a crash can never leave a logged purchase whose spare
 * change was never actually credited.
 */
export async function recordTransaction(
  userId: string,
  input: RecordTransactionInput,
): Promise<TransactionReceipt> {
  const { transaction, allocation } = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: { userId, ...input },
    });

    const allocation = await tx.bucketAllocation.update({
      where: { userId_bucketId: { userId, bucketId: input.bucketId } },
      data: { balancePaise: { increment: input.roundUpPaise } },
    });

    return { transaction, allocation };
  });

  const totals = await prisma.bucketAllocation.aggregate({
    where: { userId },
    _sum: { balancePaise: true },
  });

  const bucket = getBucket(input.bucketId);

  return {
    transactionId: transaction.id,
    merchant: transaction.merchant,
    amountPaise: transaction.amountPaise,
    roundUpPaise: transaction.roundUpPaise,
    bucketId: input.bucketId,
    bucketName: bucket.name,
    bucketTicker: bucket.ticker,
    newBucketBalancePaise: allocation.balancePaise,
    newTotalPaise: totals._sum.balancePaise ?? 0,
  };
}

export async function getRecentTransactions(userId: string, take = 5) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
