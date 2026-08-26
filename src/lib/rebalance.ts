import "server-only";

import { getBucket, type BucketId } from "./buckets";
import { prisma } from "./db";
import { collectSignals, readSentiment } from "./agents/registry";
import { getBroker, toOrderIntents } from "./brokers/registry";
import type { OrderReceipt } from "./brokers/types";
import type { SentimentReading, TickPayload } from "./agents/types";
import { getPortfolio, type BucketPosition } from "./portfolio";
import { applySentimentTilt, BUCKET_POSTURE } from "./sentiment-tilt";

/** Human-readable trigger recorded on each event, e.g. "drift > 5%". */
/** Headlines a single tick reads before forming a sentiment view. */
const TICK_SIGNAL_LIMIT = 20;

export function driftBreachSignal(thresholdPct: number): string {
  return `drift > ${thresholdPct}%`;
}

/** Trigger for a bucket that left its exposure band, e.g. "outside 10-40% cap". */
export function capBreachSignal(minPct: number, maxPct: number): string {
  return `outside ${minPct}-${maxPct}% cap`;
}

export type RebalanceEventPayload = {
  bucketId: BucketId;
  beforePct: number;
  afterPct: number;
  signal: string;
  createdAt: string;
};

export type TiltSummary = {
  /** Percentage points of authority the user granted the agents. */
  authorityPct: number;
  /** Per-bucket shift the sentiment actually produced this tick. */
  shifts: { bucketId: string; deltaPct: number; effectiveTargetPct: number }[];
  applied: boolean;
};

export type RebalanceResult = {
  rebalanced: boolean;
  reason: string;
  driftThresholdPct: number;
  events: RebalanceEventPayload[];
  /** What the registered sentiment sources made of this tick. */
  sentiment: SentimentReading;
  /** How that reading changed the targets, if the user enabled the tilt. */
  tilt: TiltSummary;
  /**
   * Orders the ledger move would have required. Empty on a tick that changed
   * nothing. With no broker connected every receipt reads "simulated" - the
   * ledger is authoritative here, and these record what a live venue would
   * have had to execute to make it true.
   */
  orders: OrderReceipt[];
};

/**
 * Split `totalPaise` across buckets by target percentage using largest
 * remainder: naive rounding either loses or invents pennies, and over enough
 * ticks that silently corrupts the ledger.
 */
export function planTargetPaise(
  positions: Pick<BucketPosition, "bucketId" | "targetPct">[],
  totalPaise: number,
): Map<BucketId, number> {
  const exact = positions.map((p) => ({
    bucketId: p.bucketId,
    ideal: (p.targetPct / 100) * totalPaise,
  }));

  const plan = new Map<BucketId, number>(
    exact.map((e) => [e.bucketId, Math.floor(e.ideal)]),
  );

  let remaining =
    totalPaise - [...plan.values()].reduce((sum, paise) => sum + paise, 0);

  // Hand the leftover pennies to the buckets that lost the most in the floor.
  const byRemainder = [...exact].sort(
    (a, b) => (b.ideal % 1) - (a.ideal % 1) || a.bucketId.localeCompare(b.bucketId),
  );

  let i = 0;
  while (remaining > 0 && byRemainder.length > 0) {
    const bucketId = byRemainder[i % byRemainder.length].bucketId;
    plan.set(bucketId, (plan.get(bucketId) ?? 0) + 1);
    remaining -= 1;
    i += 1;
  }

  return plan;
}

/**
 * One agent tick. Reads drift, and only when a bucket has breached the user's
 * threshold does it move balances to target and log what it did. A tick that
 * changes nothing writes nothing - the history stays a log of decisions.
 */
export async function runRebalanceTick(userId: string): Promise<RebalanceResult> {
  const portfolio = await getPortfolio(userId);
  const threshold = portfolio.driftThresholdPct;

  // Assemble the payload every registered sentiment source sees, then read it.
  // The reading is reported and logged; it does not currently move money on its
  // own - drift is still the only trigger.
  const tick: TickPayload = {
    at: new Date().toISOString(),
    userId,
    totalPaise: portfolio.totalPaise,
    driftThresholdPct: threshold,
    positions: portfolio.positions.map((p) => ({
      bucketId: p.bucketId,
      balancePaise: p.balancePaise,
      currentPct: round2(p.currentPct),
      targetPct: p.targetPct,
      driftPct: round2(p.driftPct),
    })),
    // Read wider than the panel shows: the tilt is damped by sample size, so
    // more headlines across more outlets is what earns it any confidence.
    signals: await collectSignals(TICK_SIGNAL_LIMIT),
  };

  const sentiment = await readSentiment(tick);

  // The agents decision point: sentiment shifts the targets, bounded by the
  // authority the user granted and clamped to their exposure caps.
  const tiltResults = applySentimentTilt(
    portfolio.positions.map((p) => ({
      bucketId: p.bucketId,
      targetPct: p.targetPct,
      minPct: p.minPct,
      maxPct: p.maxPct,
      posture: BUCKET_POSTURE[p.bucketId] ?? 0,
    })),
    sentiment.score,
    portfolio.sentimentTiltPct,
  );

  const effectiveTarget = new Map(
    tiltResults.map((t) => [t.bucketId, t.effectiveTargetPct]),
  );
  const tiltApplied = tiltResults.some((t) => t.deltaPct !== 0);

  const tilt = {
    authorityPct: portfolio.sentimentTiltPct,
    applied: tiltApplied,
    shifts: tiltResults.map((t) => ({
      bucketId: t.bucketId,
      deltaPct: t.deltaPct,
      effectiveTargetPct: t.effectiveTargetPct,
    })),
  };

  // Drift is measured against the tilted target, so a tilt can itself open a
  // gap wide enough to trigger the rebalance that acts on it.
  const positions = portfolio.positions.map((p) => {
    const target = effectiveTarget.get(p.bucketId) ?? p.targetPct;
    return {
      ...p,
      targetPct: target,
      driftPct: portfolio.totalPaise === 0 ? 0 : p.currentPct - target,
    };
  });

  if (portfolio.totalPaise === 0) {
    return {
      rebalanced: false,
      reason: "Portfolio is empty - nothing to rebalance.",
      driftThresholdPct: threshold,
      events: [],
      orders: [],
      sentiment,
      tilt,
    };
  }

  // Two independent triggers: ordinary drift past the threshold, or a bucket
  // sitting outside the exposure band the user set for it.
  const breached = positions.filter(
    (p) => Math.abs(p.driftPct) > threshold || p.capBreached,
  );

  if (breached.length === 0) {
    return {
      rebalanced: false,
      reason: `All buckets within ${threshold}% of target and inside their exposure caps.`,
      driftThresholdPct: threshold,
      events: [],
      orders: [],
      sentiment,
      tilt,
    };
  }

  const capBreaches = breached.filter((p) => p.capBreached).length;

  const plan = planTargetPaise(positions, portfolio.totalPaise);

  const created = await prisma.$transaction(async (tx) => {
    for (const position of positions) {
      const targetPaise = plan.get(position.bucketId) ?? 0;
      if (targetPaise === position.balancePaise) continue;

      await tx.bucketAllocation.update({
        where: { userId_bucketId: { userId, bucketId: position.bucketId } },
        data: { balancePaise: targetPaise },
      });
    }

    // An event per breaching bucket. afterPct is the target the balance was
    // just moved to, so the row reads as a real before/after.
    return Promise.all(
      breached.map((position) =>
        tx.rebalanceEvent.create({
          data: {
            userId,
            bucketId: position.bucketId,
            beforePct: round2(position.currentPct),
            afterPct: round2(position.targetPct),
            signal: position.capBreached
              ? capBreachSignal(position.minPct, position.maxPct)
              : driftBreachSignal(threshold),
          },
        }),
      ),
    );
  });

  // The ledger has moved; these are the orders that would have been needed to
  // make it true at a venue. With no broker connected they come back marked
  // "simulated", which is what keeps the audit trail honest.
  const receipts = await getBroker().placeOrders(
    toOrderIntents(
      positions.map((position) => ({
        bucketId: position.bucketId,
        symbol: getBucket(position.bucketId).ticker,
        fromPaise: position.balancePaise,
        toPaise: plan.get(position.bucketId) ?? 0,
      })),
    ),
  );

  return {
    rebalanced: true,
    orders: receipts,
    reason:
      capBreaches > 0
        ? `${breached.length} bucket(s) rebalanced - ${capBreaches} outside their exposure cap.`
        : tiltApplied
          ? `${breached.length} bucket(s) rebalanced against targets tilted ${sentiment.label} by sentiment.`
          : `${breached.length} bucket(s) drifted past ${threshold}%.`,
    driftThresholdPct: threshold,
    sentiment,
    tilt,
    events: created.map((event) => ({
      bucketId: event.bucketId as BucketId,
      beforePct: event.beforePct,
      afterPct: event.afterPct,
      signal: event.signal,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function getRebalanceHistory(userId: string, take = 50) {
  return prisma.rebalanceEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export type RebalanceSummary = {
  thisMonth: number;
  lastRebalanceAt: Date | null;
  driftThresholdPct: number;
};

/** Header stats for /sandbox/history. */
export async function getRebalanceSummary(
  userId: string,
): Promise<RebalanceSummary> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [thisMonth, latest, user] = await Promise.all([
    prisma.rebalanceEvent.count({
      where: { userId, createdAt: { gte: monthStart } },
    }),
    prisma.rebalanceEvent.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { driftThresholdPct: true },
    }),
  ]);

  return {
    thisMonth,
    lastRebalanceAt: latest?.createdAt ?? null,
    driftThresholdPct: user.driftThresholdPct,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
