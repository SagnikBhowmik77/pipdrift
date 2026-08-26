import { NextResponse } from "next/server";

import { getPortfolio } from "@/lib/portfolio";
import { runRebalanceTick } from "@/lib/rebalance";
import { getSessionUserIdOrNull } from "@/lib/session";

/**
 * One agent tick for the signed-in user.
 *
 * Reads each bucket's current vs target percentage, and when any bucket has
 * drifted past the user's configured threshold, moves balances to target and
 * writes a RebalanceEvent per breaching bucket. A tick that finds no breach is
 * still a 200 - it just reports an empty event list.
 */
export async function POST() {
  try {
    const userId = await getSessionUserIdOrNull();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 },
      );
    }
    const result = await runRebalanceTick(userId);
    const portfolio = await getPortfolio(userId);

    return NextResponse.json({
      ok: true,
      rebalanced: result.rebalanced,
      reason: result.reason,
      driftThresholdPct: result.driftThresholdPct,
      sentiment: result.sentiment,
      tilt: result.tilt,
      events: result.events,
      portfolio: {
        totalPaise: portfolio.totalPaise,
        positions: portfolio.positions.map((p) => ({
          bucketId: p.bucketId,
          balancePaise: p.balancePaise,
          currentPct: Number(p.currentPct.toFixed(2)),
          targetPct: p.targetPct,
          driftPct: Number(p.driftPct.toFixed(2)),
        })),
      },
    });
  } catch (error) {
    console.error("[api/rebalance] tick failed", error);
    return NextResponse.json(
      { ok: false, error: "Rebalance tick failed." },
      { status: 500 },
    );
  }
}

/** Dry run: report drift without moving anything or writing events. */
export async function GET() {
  try {
    const userId = await getSessionUserIdOrNull();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Sign in required." },
        { status: 401 },
      );
    }
    const portfolio = await getPortfolio(userId);

    return NextResponse.json({
      ok: true,
      driftThresholdPct: portfolio.driftThresholdPct,
      needsRebalance: portfolio.needsRebalance,
      totalPaise: portfolio.totalPaise,
      positions: portfolio.positions.map((p) => ({
        bucketId: p.bucketId,
        balancePaise: p.balancePaise,
        currentPct: Number(p.currentPct.toFixed(2)),
        targetPct: p.targetPct,
        driftPct: Number(p.driftPct.toFixed(2)),
        breached: Math.abs(p.driftPct) > portfolio.driftThresholdPct,
      })),
    });
  } catch (error) {
    console.error("[api/rebalance] drift read failed", error);
    return NextResponse.json(
      { ok: false, error: "Could not read drift." },
      { status: 500 },
    );
  }
}
