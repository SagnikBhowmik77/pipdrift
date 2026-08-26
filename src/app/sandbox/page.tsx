import { AllocationPie } from "@/components/allocation-pie";
import {
  Card,
  CardTitle,
  DashboardShell,
  EmptyState,
  PrimaryLink,
  StatTile,
} from "@/components/dashboard-shell";
import { formatPaise } from "@/lib/currency";
import { getRecentAgentRuns } from "@/lib/agent-runner";
import { getPortfolio, getRecentTransactions } from "@/lib/portfolio";
import { getRiskProfile } from "@/lib/risk-profiles";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Portfolio · Pipdrift",
};

export default async function SandboxPage() {
  const userId = await getSessionUserId();
  const [portfolio, recent, runs] = await Promise.all([
    getPortfolio(userId),
    getRecentTransactions(userId, 8),
    getRecentAgentRuns(userId, 6),
  ]);

  if (portfolio.transactionCount === 0) {
    return (
      <DashboardShell
        title="Portfolio"
        subtitle="Your spare change, allocated across three ETF buckets."
        active="/sandbox"
      >
        <EmptyState
          title="No spare change yet"
          body="Log a purchase and Pipdrift will round it up to the next rupee, then credit the difference to the bucket you choose."
          cta={{ href: "/sandbox/new", label: "Log your first purchase" }}
        />
      </DashboardShell>
    );
  }

  const profile = getRiskProfile(portfolio.riskProfile);
  const widest = portfolio.positions.reduce((worst, p) =>
    Math.abs(p.driftPct) > Math.abs(worst.driftPct) ? p : worst,
  );

  return (
    <DashboardShell
      title="Portfolio"
      subtitle="Your spare change, allocated across three ETF buckets."
      active="/sandbox"
      actions={<PrimaryLink href="/sandbox/new">Log a purchase</PrimaryLink>}
    >
      <div className="space-y-5">
        {/* Summary before detail: four numbers that answer "is anything wrong?"
            without the reader having to interpret a chart first. */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Invested"
            value={formatPaise(portfolio.totalPaise)}
            hint={`${portfolio.transactionCount} ${
              portfolio.transactionCount === 1 ? "purchase" : "purchases"
            }`}
          />
          <StatTile
            label="Status"
            value={portfolio.needsRebalance ? "Drift breach" : "In range"}
            hint={
              portfolio.needsRebalance
                ? "Agents will correct on the next tick"
                : `All buckets within ±${portfolio.driftThresholdPct}%`
            }
            tone={portfolio.needsRebalance ? "negative" : "positive"}
          />
          <StatTile
            label="Widest drift"
            value={`${widest.driftPct > 0 ? "+" : ""}${widest.driftPct.toFixed(1)}%`}
            hint={widest.name}
            tone={
              Math.abs(widest.driftPct) > portfolio.driftThresholdPct
                ? "negative"
                : "neutral"
            }
          />
          <StatTile
            label="Risk profile"
            value={profile.name}
            hint={
              portfolio.sentimentTiltPct > 0
                ? `Agents may tilt ±${portfolio.sentimentTiltPct}%`
                : "Sentiment tilt off"
            }
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <Card>
            <CardTitle>Allocation</CardTitle>
            <AllocationPie slices={portfolio.positions} />
          </Card>

          {/* Not a second copy of the allocation table - the pie card already
              carries those numbers. This answers the question the marketing
              makes and nothing else on this screen proves: are the agents
              actually running? */}
          <Card>
            <CardTitle
              aside={
                <a
                  href="/sandbox/history"
                  className="text-xs text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
                >
                  All events
                </a>
              }
            >
              Agent activity
            </CardTitle>

            {runs.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No ticks recorded yet. The agents write a row on every pass,
                including passes that change nothing.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {runs.map((run) => (
                  <li key={run.id} className="flex items-start gap-4 py-3 first:pt-0">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-300">
                        {run.summary}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        <time dateTime={run.createdAt.toISOString()}>
                          {run.createdAt.toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                        <span className="font-mono">{run.trigger}</span>
                        {run.sentimentScore !== null && (
                          <span className="tabular-nums">
                            sentiment {run.sentimentScore > 0 ? "+" : ""}
                            {run.sentimentScore.toFixed(2)}
                          </span>
                        )}
                      </span>
                    </span>
                    {run.eventsWritten > 0 && (
                      <span className="shrink-0 rounded-full bg-mint/10 px-2 py-0.5 text-xs font-medium text-mint">
                        {run.eventsWritten} moved
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardTitle
            aside={
              <a
                href="/sandbox/history"
                className="text-xs text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
              >
                Full history
              </a>
            }
          >
            Recent round-ups
          </CardTitle>

          <ul className="grid gap-x-8 gap-y-0 md:grid-cols-2">
            {recent.map((tx) => (
              <li
                key={tx.id}
                className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2.5 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-200">
                    {tx.merchant}
                  </span>
                  <span className="text-xs text-slate-500">
                    {tx.category} · {formatPaise(tx.amountPaise)}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-mint">
                  +{formatPaise(tx.roundUpPaise)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </DashboardShell>
  );
}
