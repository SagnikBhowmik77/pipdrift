import { Card, DashboardShell, EmptyState } from "@/components/dashboard-shell";
import { getBucket, isBucketId } from "@/lib/buckets";
import { getRebalanceHistory, getRebalanceSummary } from "@/lib/rebalance";
import { getSessionUserId } from "@/lib/session";
import { RebalanceTickButton } from "./tick-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rebalance history · Pipdrift",
};

// Fixed locale and timezone: the server and the browser must format these
// identically or React reports a hydration mismatch.
const STAMP = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default async function HistoryPage() {
  const userId = await getSessionUserId();
  const [events, summary] = await Promise.all([
    getRebalanceHistory(userId),
    getRebalanceSummary(userId),
  ]);

  return (
    <DashboardShell
      title="Rebalance history"
      subtitle="Every time the agents moved money, and what tripped them."
      active="/sandbox/history"
      actions={<RebalanceTickButton />}
    >
      <div className="space-y-5">
        <Card>
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-slate-400">Rebalances this month</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-50">
                {summary.thisMonth}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Last rebalance</dt>
              <dd className="mt-1 text-lg font-medium text-slate-100">
                {summary.lastRebalanceAt
                  ? STAMP.format(summary.lastRebalanceAt)
                  : "Never"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400">Drift threshold in effect</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums text-slate-100">
                ±{summary.driftThresholdPct}%
              </dd>
            </div>
          </dl>
        </Card>

        {events.length === 0 ? (
          <EmptyState
            title="No rebalances yet"
            body="The agents only write a row when a bucket actually breaches your drift threshold. Run a tick to check the portfolio now."
            cta={{ href: "/sandbox/buckets", label: "Review drift threshold" }}
          />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                Rebalance events, newest first
              </caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="pb-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="pb-3 font-medium">
                    Bucket
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Before
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    After
                  </th>
                  <th scope="col" className="pb-3 text-right font-medium">
                    Signal
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t border-white/5">
                    <td className="py-3 pr-4 text-slate-400">
                      {STAMP.format(event.createdAt)}
                    </td>
                    <td className="py-3 pr-4 text-slate-200">
                      {isBucketId(event.bucketId)
                        ? getBucket(event.bucketId).name
                        : event.bucketId}
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-400">
                      {event.beforePct.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right tabular-nums text-slate-100">
                      {event.afterPct.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right">
                      <span className="rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-slate-400">
                        {event.signal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
