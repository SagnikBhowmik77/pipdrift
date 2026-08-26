import Link from "next/link";

import { Card, CardTitle, DashboardShell } from "@/components/dashboard-shell";
import type { BucketId } from "@/lib/buckets";
import { getPortfolio } from "@/lib/portfolio";
import { getSessionUserId } from "@/lib/session";
import { BucketForm } from "./bucket-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buckets · Pipdrift",
};

export default async function BucketsPage() {
  const userId = await getSessionUserId();
  const portfolio = await getPortfolio(userId);

  const initialTargets = Object.fromEntries(
    portfolio.positions.map((p) => [p.bucketId, p.targetPct]),
  ) as Record<BucketId, number>;

  return (
    <DashboardShell
      title="Buckets"
      subtitle="Set the target mix and how far it may drift before the agents act."
      active="/sandbox/buckets"
    >
      {/* Form on the left, the two ways out of this page on the right. The
          links used to sit under the form as loose sentences, which left the
          right half of a wide screen empty and buried the navigation. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:gap-10">
        <Card>
          <CardTitle>Target allocation</CardTitle>
          {/* Keyed on the saved config so applying a preset remounts the form.
              Without this the inputs keep their mount-time state, and a later
              "Save targets" would write the pre-preset numbers back. */}
          <BucketForm
            key={`${initialTargets.equities}-${initialTargets.bonds}-${initialTargets.emerging}-${portfolio.driftThresholdPct}`}
            initialTargets={initialTargets}
            initialThreshold={portfolio.driftThresholdPct}
          />
        </Card>

        <div className="space-y-3 lg:max-w-sm">
          <Link
            href="/sandbox/buckets/exposure"
            className="block rounded-xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-white/[0.16] hover:bg-white/[0.045]"
          >
            <h3 className="text-sm font-medium text-slate-100">
              Set exposure caps
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              Hard minimum and maximum per ETF, so a bucket can never run away
              from you even under a tilt.
            </p>
          </Link>

          <Link
            href="/sandbox/profile"
            className="block rounded-xl border border-white/[0.08] bg-white/[0.025] p-5 transition hover:border-white/[0.16] hover:bg-white/[0.045]"
          >
            <h3 className="text-sm font-medium text-slate-100">
              Choose a risk profile
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
              Conservative, Balanced, or Growth. A preset rewrites all three
              targets at once.
            </p>
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
