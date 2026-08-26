import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import {
  AUM_THRESHOLD_LABEL,
  FEATURE_MATRIX,
  MANAGED_FEE_PCT,
  TIERS,
} from "@/lib/pricing";
import { WaitlistForm } from "./waitlist-form";

export const metadata = {
  title: "Pricing · Pipdrift",
  description:
    "Free Personal tier, and a 0.20% Managed tier that only applies above the AUM threshold.",
};

function Check({ on }: { on: boolean }) {
  return on ? (
    <span className="text-mint" aria-label="Included">
      ✓
    </span>
  ) : (
    <span className="text-slate-600" aria-label="Not included">
      -
    </span>
  );
}

export default function PricingPage() {
  return (
    <MarketingShell
      title="Pricing"
      subtitle="Free until your portfolio is big enough that the extra controls pay for themselves."
      active="/pricing"
    >
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          {TIERS.map((tier) => {
            const managed = tier.id === "managed";

            return (
              <section
                key={tier.id}
                className={`flex flex-col rounded-2xl border p-6 ${
                  managed
                    ? "border-white/10 bg-white/5"
                    : "border-mint/40 bg-mint/5"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-50">
                    {tier.name}
                  </h2>
                  {!managed && (
                    <span className="rounded-full bg-mint/15 px-2.5 py-1 text-xs font-medium text-mint">
                      Available now
                    </span>
                  )}
                </div>

                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight text-slate-50">
                    {tier.price}
                  </span>
                  <span className="text-sm text-slate-400">AUM fee</span>
                </p>
                <p className="mt-2 text-sm text-slate-400">{tier.priceNote}</p>

                <p className="mt-5 text-sm leading-relaxed text-slate-300">
                  {tier.pitch}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm text-slate-300"
                    >
                      <span aria-hidden className="mt-0.5 text-mint">
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                {managed ? (
                  <p className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                    <strong className="font-medium text-slate-200">
                      Threshold disclosure.
                    </strong>{" "}
                    The {MANAGED_FEE_PCT}% annual fee applies only to the portion
                    of your portfolio above {AUM_THRESHOLD_LABEL}. Below that
                    balance the Managed tier costs nothing. A portfolio of{" "}
                    {AUM_THRESHOLD_LABEL} pays ₹0; one at twice that pays{" "}
                    {MANAGED_FEE_PCT}% on the second half only.
                  </p>
                ) : (
                  <Link
                    href="/sandbox"
                    className="mt-6 rounded-xl bg-mint px-5 py-3 text-center text-sm font-semibold text-ink transition hover:bg-mint-bright"
                  >
                    {tier.cta}
                  </Link>
                )}
              </section>
            );
          })}
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-1 text-lg font-semibold text-slate-50">
            What you get in each tier
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Everything that makes Pipdrift inspectable is in the free tier. The
            Managed tier adds controls, not access.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">
                Feature comparison between the Personal and Managed tiers
              </caption>
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="pb-3 text-left font-medium">
                    Feature
                  </th>
                  <th scope="col" className="pb-3 text-center font-medium">
                    Personal
                  </th>
                  <th scope="col" className="pb-3 text-center font-medium">
                    Managed
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row) => (
                  <tr key={row.feature} className="border-t border-white/5">
                    <th
                      scope="row"
                      className="py-2.5 pr-4 text-left font-normal text-slate-300"
                    >
                      {row.feature}
                    </th>
                    <td className="py-2.5 text-center">
                      <Check on={row.personal} />
                    </td>
                    <td className="py-2.5 text-center">
                      <Check on={row.managed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-mint/20 bg-mint/5 p-6">
          <h2 className="text-lg font-semibold text-slate-50">
            Managed tier waitlist
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Tax-aware rebalancing and exposure caps are still being built. Leave
            an email and we will tell you when they ship - no other mail.
          </p>
          <WaitlistForm />
        </section>

        <p className="text-sm text-slate-500">
          Questions about fees, taxes, or lock-up?{" "}
          <Link href="/faq" className="text-mint underline-offset-4 hover:underline">
            Read the FAQ
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
