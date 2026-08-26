import Link from "next/link";

import { Card, CardTitle, DashboardShell } from "@/components/dashboard-shell";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { getPortfolio } from "@/lib/portfolio";
import { getRiskProfile, RISK_PROFILES } from "@/lib/risk-profiles";
import { getSessionUserId } from "@/lib/session";
import { Toast } from "@/components/toast";
import { getLastAgentRun } from "@/lib/agent-runner";
import { applyRiskProfile } from "../buckets/actions";
import { AgentAuthorityForm } from "./agent-authority-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Risk profile · Pipdrift",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ applied?: string; conflict?: string }>;
}) {
  const userId = await getSessionUserId();
  const [portfolio, params, lastRun] = await Promise.all([
    getPortfolio(userId),
    searchParams,
    getLastAgentRun(userId),
  ]);

  // Confirm only what actually persisted. Driving the toast off the query
  // param alone would let a hand-typed or shared URL claim a change that never
  // happened.
  const appliedId = params.applied;
  const applied =
    appliedId && portfolio.riskProfile === appliedId
      ? getRiskProfile(appliedId)
      : null;

  const isCustom = !RISK_PROFILES.some((p) => p.id === portfolio.riskProfile);

  return (
    <DashboardShell
      title="Risk profile"
      subtitle="Pick a preset and Pipdrift rewrites all three bucket targets to match."
      active="/sandbox/profile"
    >
      {params.conflict && (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400"
        >
          That preset would push a bucket outside its exposure cap, so nothing
          was changed. Widen the band on the{" "}
          <Link
            href="/sandbox/buckets/exposure"
            className="underline underline-offset-4"
          >
            exposure caps page
          </Link>{" "}
          first.
        </p>
      )}

      {applied && (
        <Toast
          key={`${applied.id}-${portfolio.positions.map((p) => p.targetPct).join("-")}`}
          message={`Switched to ${applied.name} - targets updated to ${applied.targets.equities}/${applied.targets.bonds}/${applied.targets.emerging}.`}
        />
      )}

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {RISK_PROFILES.map((profile) => {
            const active = portfolio.riskProfile === profile.id;

            return (
              <form key={profile.id} action={applyRiskProfile} className="contents">
                <input type="hidden" name="profile" value={profile.id} />
                <button
                  type="submit"
                  aria-current={active ? "true" : undefined}
                  className={`flex flex-col gap-3 rounded-2xl border p-5 text-left transition ${
                    active
                      ? "border-mint/60 bg-mint/10"
                      : "border-white/10 bg-white/5 hover:border-white/25"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-100">{profile.name}</span>
                    {active && (
                      <span className="text-xs font-medium text-mint">Active</span>
                    )}
                  </span>
                  <span className="text-sm text-slate-400">{profile.blurb}</span>

                  {/* The split bar is the preset: reading the mix should not
                      require parsing three numbers. */}
                  <span aria-hidden className="flex h-2 overflow-hidden rounded-full">
                    {(["equities", "bonds", "emerging"] as const).map((id) => (
                      <span
                        key={id}
                        style={{
                          width: `${profile.targets[id]}%`,
                          background: BUCKET_COLORS[id],
                        }}
                      />
                    ))}
                  </span>

                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {profile.targets.equities}/{profile.targets.bonds}/
                    {profile.targets.emerging}
                  </span>
                </button>
              </form>
            );
          })}
        </div>

        <Card>
          <CardTitle>Agent authority</CardTitle>
          <p className="mb-5 text-sm text-slate-400">
            {lastRun
              ? `Last tick ${lastRun.trigger === "scheduled" ? "ran on schedule" : "was run by hand"}: ${lastRun.summary}`
              : "The agents have not run a tick for you yet."}
          </p>
          {/* Keyed on the saved settings so a save reaches these inputs. */}
          <AgentAuthorityForm
            key={`${portfolio.sentimentTiltPct}-${portfolio.autoRebalance}`}
            initialTilt={portfolio.sentimentTiltPct}
            initialAuto={portfolio.autoRebalance}
          />
        </Card>

        <Card>
          <CardTitle>Current targets</CardTitle>
          <p className="mb-4 text-sm text-slate-400">
            {isCustom
              ? "You are on a custom mix - set by hand rather than from a preset."
              : `Following the ${portfolio.riskProfile} preset.`}
          </p>
          <ul className="space-y-2">
            {portfolio.positions.map((position) => (
              <li
                key={position.bucketId}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ background: BUCKET_COLORS[position.bucketId] }}
                  />
                  <span className="text-slate-200">{position.name}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {position.ticker}
                  </span>
                </span>
                <span className="tabular-nums text-slate-100">
                  {position.targetPct}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-slate-400">
            Need something in between?{" "}
            <Link
              href="/sandbox/buckets"
              className="text-mint underline-offset-4 hover:underline"
            >
              Set targets by hand
            </Link>{" "}
            on the buckets page.
          </p>
        </Card>
      </div>
    </DashboardShell>
  );
}
