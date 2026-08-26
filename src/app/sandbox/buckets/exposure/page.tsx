import Link from "next/link";

import { Card, CardTitle, DashboardShell } from "@/components/dashboard-shell";
import type { BucketId } from "@/lib/buckets";
import { getPortfolio } from "@/lib/portfolio";
import { getSessionUserId } from "@/lib/session";
import { ExposureForm, type Band } from "./exposure-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Exposure caps · Pipdrift",
};

export default async function ExposurePage() {
  const userId = await getSessionUserId();
  const portfolio = await getPortfolio(userId);

  const initial = Object.fromEntries(
    portfolio.positions.map((p) => [
      p.bucketId,
      { minPct: p.minPct, maxPct: p.maxPct, targetPct: p.targetPct },
    ]),
  ) as Record<BucketId, Band>;

  const breached = portfolio.positions.filter((p) => p.capBreached);

  return (
    <DashboardShell
      title="Exposure caps"
      subtitle="The band each bucket must stay inside. A bucket that leaves its band is rebalanced even when drift alone would not trigger it."
      active="/sandbox/buckets"
    >
      <div className="max-w-2xl space-y-5">
        {breached.length > 0 && (
          <p
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400"
          >
            {breached.map((p) => p.name).join(", ")}{" "}
            {breached.length === 1 ? "is" : "are"} currently outside{" "}
            {breached.length === 1 ? "its" : "their"} band. The next tick will
            pull {breached.length === 1 ? "it" : "them"} back to target.
          </p>
        )}

        <Card>
          <CardTitle>Per-ETF bands</CardTitle>
          {/* Keyed on the saved bands so a save elsewhere reaches these inputs
              instead of leaving them on their mount-time values. */}
          <ExposureForm
            key={portfolio.positions
              .map((p) => `${p.minPct}-${p.maxPct}-${p.targetPct}`)
              .join("|")}
            initial={initial}
          />
        </Card>

        <p className="text-sm text-slate-400">
          Caps constrain the target you can set on the{" "}
          <Link
            href="/sandbox/buckets"
            className="text-mint underline-offset-4 hover:underline"
          >
            buckets page
          </Link>
          . Change a target first if you need a band that excludes it.
        </p>
      </div>
    </DashboardShell>
  );
}
