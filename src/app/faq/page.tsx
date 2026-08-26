import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import {
  AUM_THRESHOLD_LABEL,
  MANAGED_FEE_PCT,
} from "@/lib/pricing";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "FAQ · Pipdrift",
  description:
    "Security, fees, lock-up, taxes, and how Pipdrift differs from Acorns.",
};

type Faq = { question: string; answer: React.ReactNode };

const FAQS: Faq[] = [
  {
    question: "How are my funds secured?",
    answer: (
      <>
        <p>
          Pipdrift never takes custody of your money. In production, deposits sit
          with a SEBI-registered broker-dealer partner in an account in your own
          name - Pipdrift holds the instruction layer, not the assets. That means
          if Pipdrift disappeared tomorrow, your holdings would still be yours and
          still be with the broker.
        </p>
        <p>
          Credentials are stored as argon2id hashes, never in plain text, and
          sessions are signed. The rebalancing engine is open source, so you can
          read exactly what it is authorised to do rather than take our word for
          it.
        </p>
        <p className="text-slate-500">
          The current build is a sandbox: balances are a ledger and no broker is
          connected yet.
        </p>
      </>
    ),
  },
  {
    question: "Is there a lock-up on my spare change?",
    answer: (
      <>
        <p>
          No. There is no minimum holding period, no notice period, and no exit
          fee. Round-ups are ordinary ETF purchases, so withdrawing means selling
          units and settling on the exchange&rsquo;s normal cycle - typically T+1
          for NSE-listed funds.
        </p>
        <p>
          The only thing that takes time is settlement, and that is the
          exchange&rsquo;s clock, not a Pipdrift restriction.
        </p>
      </>
    ),
  },
  {
    question: "What does it cost?",
    answer: (
      <>
        <p>
          The <strong className="font-medium text-slate-200">Personal</strong>{" "}
          tier is free: 0% AUM fee, no monthly charge, and it includes the three
          default buckets, the sandbox rebalancing engine, your own drift
          threshold, and the full forkable pipeline.
        </p>
        <p>
          The <strong className="font-medium text-slate-200">Managed</strong> tier
          costs {MANAGED_FEE_PCT}% annually, charged{" "}
          <strong className="font-medium text-slate-200">
            only on the portion of your portfolio above {AUM_THRESHOLD_LABEL}
          </strong>
          . Below that balance it costs nothing. It adds advanced risk profiles,
          per-ETF exposure caps, and tax-aware rebalancing.
        </p>
        <p>
          Brokerage, exchange, and statutory charges are set by the broker and
          the exchange, not by Pipdrift.{" "}
          <Link href="/pricing" className="text-mint underline-offset-4 hover:underline">
            See the full comparison
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    question: "How are taxes on rebalance events handled?",
    answer: (
      <>
        <p>
          A rebalance sells units in an overweight bucket and buys in an
          underweight one, and a sale is a taxable event. In India that means
          short-term capital gains on equity ETF units held under a year, and
          long-term treatment beyond it - at the rates in force for your holding
          period and fund type.
        </p>
        <p>
          Two things reduce the damage. Your drift threshold is yours to set: a
          wider band means fewer rebalances and fewer disposals, which is exactly
          why the threshold is a visible control rather than a hidden constant.
          And the Managed tier adds tax-aware rebalancing, which prefers lots
          that have crossed into long-term treatment and favours directing new
          round-ups into underweight buckets before selling anything.
        </p>
        <p>
          Every disposal is recorded in your{" "}
          <Link
            href="/sandbox/history"
            className="text-mint underline-offset-4 hover:underline"
          >
            rebalance history
          </Link>{" "}
          with before and after percentages and the signal that triggered it, so
          your return has a paper trail.
        </p>
        <p className="text-slate-500">
          Pipdrift is not a tax adviser and none of this is tax advice - check
          your own situation with a professional.
        </p>
      </>
    ),
  },
  {
    question: "How is this different from Acorns?",
    answer: (
      <>
        <p>
          Round-ups are the same idea. What happens next is not.
        </p>
        <ul className="ml-5 list-disc space-y-2 marker:text-slate-600">
          <li>
            <strong className="font-medium text-slate-200">
              The agent pipeline is open.
            </strong>{" "}
            Every signal source and the rebalancing engine are TypeScript modules
            you can read, change, and run yourself. No competitor in this category
            publishes theirs.
          </li>
          <li>
            <strong className="font-medium text-slate-200">
              The drift threshold is explicit and yours.
            </strong>{" "}
            Acorns rebalances quarterly on drift it does not publish; Betterment
            rebalances daily on rules it does not publish. Pipdrift shows you the
            number and lets you set it.
          </li>
          <li>
            <strong className="font-medium text-slate-200">
              Signals are forkable.
            </strong>{" "}
            Plug in your own sentiment source or a new asset bucket in a weekend -{" "}
            <Link
              href="/docs/agents"
              className="text-mint underline-offset-4 hover:underline"
            >
              the docs show you how
            </Link>
            .
          </li>
          <li>
            <strong className="font-medium text-slate-200">
              Fees do not punish small balances.
            </strong>{" "}
            Flat monthly fees are brutal on a ₹5,000 portfolio. Personal is free
            at any size.
          </li>
        </ul>
      </>
    ),
  },
];

export default function FaqPage() {
  return (
    <MarketingShell
      title="Frequently asked questions"
      subtitle="The five things people actually want to know before trusting an app with their spare change."
      active="/faq"
    >
      <div className="space-y-3">
        {FAQS.map((faq, i) => (
          <details
            key={faq.question}
            open={i === 0}
            className="group rounded-2xl border border-white/10 bg-white/5 px-6 open:bg-white/[0.07]"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-slate-100 marker:content-none">
              {faq.question}
              <span
                aria-hidden
                className="shrink-0 text-xl leading-none text-slate-500 transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <div className="space-y-3 pb-6 text-sm leading-relaxed text-slate-400 [&_p]:max-w-prose">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-mint/20 bg-mint/5 p-6">
        <h2 className="text-lg font-semibold text-slate-50">
          Still have a question?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-400">
          Ask it here and we will reply by email. If it comes up more than once it
          ends up on this page.
        </p>
        <ContactForm />
      </section>
    </MarketingShell>
  );
}
