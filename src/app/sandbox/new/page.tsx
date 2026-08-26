import { Card, CardTitle, DashboardShell } from "@/components/dashboard-shell";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { formatPaise } from "@/lib/currency";
import { getPortfolio } from "@/lib/portfolio";
import { getSessionUserId } from "@/lib/session";
import { TransactionForm } from "./transaction-form";

// Gated at render, not just in the action: without this the page is static and
// a signed-out visitor fills in the whole form before the submit bounces them
// to /login, losing what they typed.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log a purchase · Pipdrift",
};

export default async function NewTransactionPage() {
  const userId = await getSessionUserId();
  const portfolio = await getPortfolio(userId);

  return (
    <DashboardShell
      title="Log a purchase"
      subtitle="Pipdrift rounds it up to the next rupee and invests the difference."
      active="/sandbox/new"
    >
      {/* A 512px form alone in a 1100px column reads as an unfinished page.
          The right rail is not filler: it shows the balances this form is about
          to change, so the result of the action is visible before taking it. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:gap-10">
        <div>
          <TransactionForm />
        </div>

        <div className="space-y-5 lg:max-w-sm">
          <Card>
            <CardTitle>Where it lands</CardTitle>
            <ul className="space-y-3.5">
              {portfolio.positions.map((position) => (
                <li key={position.bucketId}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: BUCKET_COLORS[position.bucketId] }}
                      />
                      <span className="truncate text-slate-200">
                        {position.name}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-300">
                      {formatPaise(position.balancePaise)}
                    </span>
                  </div>
                  <div
                    aria-hidden
                    className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(position.currentPct, 1.5)}%`,
                        background: BUCKET_COLORS[position.bucketId],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-5 flex items-baseline justify-between border-t border-white/[0.08] pt-4 text-sm">
              <span className="text-slate-400">Total</span>
              <span className="tabular-nums text-slate-100">
                {formatPaise(portfolio.totalPaise)}
              </span>
            </p>
          </Card>

          <Card>
            <CardTitle>How the round-up works</CardTitle>
            <p className="text-sm leading-relaxed text-slate-400">
              A purchase of {formatPaise(12840)} rounds to {formatPaise(12900)},
              and the {formatPaise(60)} difference is what gets invested. Amounts
              are held as integer paise, so nothing is lost to rounding no matter
              how many purchases you log.
            </p>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
