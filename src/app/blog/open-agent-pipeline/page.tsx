import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";

export const metadata = {
  title: "Why open agent pipelines beat black-box robo-advisors · Pipdrift",
  description:
    "Every robo-advisor rebalances. None of them will tell you when, or why. Here is what that costs you, and what an inspectable pipeline changes.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-4 text-2xl font-semibold tracking-tight text-balance text-slate-50">
      {children}
    </h2>
  );
}

export default function OpenAgentPipelinePost() {
  return (
    <MarketingShell
      title="Why open agent pipelines beat black-box robo-advisors"
      subtitle="Every robo-advisor rebalances your money. Not one of them will tell you exactly when, or why. That gap is the whole argument."
    >
      <article className="max-w-2xl text-slate-300 [&_p]:mt-4 [&_p]:leading-relaxed">
        <p className="text-sm text-slate-500">
          6 min read · for people who read the source before the marketing page
        </p>

        <p>
          If you have ever opened Acorns or Betterment and wondered what actually
          happened to your money last Tuesday, you already understand the problem.
          Something rebalanced. Some threshold was crossed. Some model decided
          your emerging-markets sleeve was 3% too heavy. You will not be told
          which, because the rule that made the decision is not something these
          products publish.
        </p>

        <p>
          For most of the industry&rsquo;s history that was fine, because the
          people using robo-advisors could not have read the rule anyway. That is
          no longer true. A meaningful share of people putting their first salary
          into index funds write software for a living, or are two semesters away
          from it. Handing that person an opaque allocation engine and asking them
          to trust it is a strange thing to do.
        </p>

        <H2>What &ldquo;black box&rdquo; actually means here</H2>

        <p>
          It is worth being precise, because the incumbents are not hiding
          something sinister - they are just not showing you anything.
        </p>

        <p>
          Acorns rebalances on a quarterly review triggered by allocation drift.
          Betterment rebalances daily. Wealthfront rebalances regularly and pairs
          it with tax-loss harvesting. All three descriptions are accurate and all
          three are useless if you want to know what will happen to{" "}
          <em>your</em> portfolio on Tuesday. None of them publish the drift
          threshold. None of them expose the rule as something you can read,
          test, or disagree with. Robinhood avoids the problem by not rebalancing
          at all and leaving the discipline to you.
        </p>

        <p>
          So the market splits into two bad options: automation you cannot
          inspect, or inspection with no automation.
        </p>

        <H2>Opacity has a real cost, and it is not philosophical</H2>

        <p>
          A hidden threshold is not just unsatisfying - it costs money in ways you
          cannot audit.
        </p>

        <p>
          Every rebalance is a sale, and every sale is a taxable event. A tighter
          drift band means more rebalances, more disposals, and more short-term
          gains. That is a genuine trade-off between allocation discipline and tax
          drag, and it is <em>your</em> trade-off - it depends on your bracket,
          your horizon, and how much tracking error you can live with. When the
          threshold is a constant inside someone else&rsquo;s server, that
          decision has been made for you by a company optimising for its average
          customer, who is not you.
        </p>

        <p>
          The same goes for concentration. If you want a hard ceiling on emerging
          markets because you already have exposure through your job or your
          family&rsquo;s business, a product that will not show you its allocation
          rules cannot honour that, and cannot even tell you it is not honouring
          it.
        </p>

        <H2>What an open pipeline changes</H2>

        <p>
          Pipdrift&rsquo;s rebalancing engine is a handful of TypeScript modules.
          The drift threshold is a number you set on a page, not a constant we
          ship. Every rebalance writes a row with the bucket, the percentage
          before, the percentage after, and the signal that triggered it - so the
          history is a log of decisions you can argue with, not a list of things
          that happened to you.
        </p>

        <p>
          The extension points are the interesting part. A signal source is an
          object with an id and one method that returns observations. A sentiment
          source receives the payload the rebalance agent assembled - balances,
          drift, the headlines it collected - and returns a score with the tags
          that explain it. Implement either, add one line to a registry, and the
          fleet starts reading it. That is the entire integration.
        </p>

        <p>
          Which means the CS student who wants to plug in a custom sentiment feed
          over a weekend can actually do it, and the engineer who thinks our drift
          rule is wrong can change it and run their own. Neither of those is a
          feature request you file. It is a fork.
        </p>

        <H2>The honest limits</H2>

        <p>
          Two things this argument does not claim. Open source is not a
          performance edge - a transparent rebalancer and an opaque one following
          the same rule produce the same returns. And inspectable does not mean
          risk-free: you can read our code and still choose a threshold that
          churns your portfolio into a tax bill.
        </p>

        <p>
          What transparency buys is narrower and more valuable than
          &ldquo;better returns&rdquo;. It is the ability to know what your money
          is doing, to change the rule when the rule is wrong for you, and to
          leave with the logic if you leave the product. For a generation that
          grew up reading changelogs, &ldquo;set it and forget it&rdquo; should
          not have to mean &ldquo;pay someone and hope&rdquo;. It can mean{" "}
          <strong className="font-medium text-slate-100">
            trust the agents you can actually inspect.
          </strong>
        </p>

        <div className="mt-12 rounded-2xl border border-mint/20 bg-mint/5 p-6">
          <h2 className="text-lg font-semibold text-slate-50">
            See the whole thing running
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            The sandbox is free and takes an email. Log a purchase, set your own
            drift threshold, and run a rebalance tick to watch what it writes
            down.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/sandbox"
              className="rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mint-bright"
            >
              Open the sandbox
            </Link>
            <Link
              href="/docs/agents"
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30"
            >
              Read the agents docs
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-slate-500">
          Pipdrift is a sandbox: balances are a ledger, no orders are placed, and
          nothing here is investment or tax advice.
        </p>
      </article>
    </MarketingShell>
  );
}
