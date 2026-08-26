import Link from "next/link";

import { BUCKETS } from "@/lib/buckets";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { getRiskProfile } from "@/lib/risk-profiles";
import { auth } from "@/lib/auth";
import { Parallax } from "@/components/parallax";
import { Reveal } from "@/components/reveal";
import { ScrollProgress } from "@/components/scroll-progress";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  {
    title: "A purchase comes in",
    body: "Post a transaction through the form or the signed webhook. The engine rounds it to the next rupee in integer paise - never floats, so the ledger cannot quietly lose money.",
  },
  {
    title: "The round-up lands in a bucket",
    body: "Three NSE-listed ETFs by default - equities, government bonds, global growth. Change the tickers, the mix, or the number of buckets; they are one array in one file.",
  },
  {
    title: "Agents read the market and correct drift",
    body: "Each tick pulls twenty headlines from five feeds, labels them with a model, and tilts targets within authority you grant - then rebalances anything past your threshold and logs what tripped it.",
  },
];

const PIPELINE_POINTS = [
  {
    title: "Every signal is a module",
    body: "Signal sources and sentiment sources are small TypeScript objects. Add one, register it in one line, and the fleet starts reading it.",
  },
  {
    title: "The drift threshold is yours",
    body: "You set the number that triggers a rebalance, and every event is logged with the before %, the after %, and what tripped it.",
  },
  {
    title: "Self-hosted, not server-locked",
    body: "SQLite locally, Postgres in production, one command either way. Nothing phones home, and no account is required to run the engine.",
  },
];

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);

  // Read the real preset rather than hardcoding percentages that drift out of
  // sync the moment the presets change.
  const balanced = getRiskProfile("balanced");

  return (
    <div className="min-h-screen">
      <ScrollProgress />

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-6">
        <span className="font-semibold tracking-tight text-slate-50">Pipdrift</span>
        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/pricing"
            className="text-slate-400 transition hover:text-slate-200"
          >
            Pricing
          </Link>
          <Link
            href="/docs/agents"
            className="text-slate-400 transition hover:text-slate-200"
          >
            Docs
          </Link>
          {signedIn ? (
            <Link
              href="/sandbox"
              className="rounded-xl bg-mint px-4 py-2 font-semibold text-ink transition hover:bg-mint-bright"
            >
              Open sandbox
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-400 transition hover:text-slate-200"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-mint px-4 py-2 font-semibold text-ink transition hover:bg-mint-bright"
              >
                Open sandbox
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-20">
        <section className="grid items-center gap-12 py-14 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint/25 bg-mint/5 px-3 py-1.5 text-xs font-medium text-mint">
              Open rebalancing engine, MIT licensed
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-balance text-slate-50 sm:text-5xl lg:text-6xl">
              A robo-advisor you can read, fork, and run yourself.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
              Pipdrift is an open rebalancing engine. It rounds spare change into
              ETF buckets, reads the market, and moves the mix back to target when
              it drifts. Every threshold, signal source, and bucket is a TypeScript
              module you can read in an afternoon, and run on your own machine,
              with nobody in the middle.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/docs/agents"
                className="rounded-xl bg-mint px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-mint-bright"
              >
                Read the engine docs
              </Link>
              <Link
                href={signedIn ? "/sandbox" : "/signup"}
                className="rounded-xl border border-white/15 px-6 py-3.5 text-base font-medium text-slate-200 transition hover:border-white/30"
              >
                Try the live sandbox
              </Link>
            </div>

            <p className="mt-5 text-sm text-slate-500">
              Runs on your own machine. No custody, no advisory fee, no lock-in.
              The hosted sandbox places no orders: no broker is connected and
              nothing is bought or sold.
            </p>
          </div>

          {/* The hero visual is the product's actual arithmetic, not an
              illustration: one purchase, its round-up, and where it lands. */}
          <Parallax speed={-0.05}>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs text-slate-500">This morning</p>
              <div className="mt-3 flex items-baseline justify-between gap-4">
                <span className="text-slate-300">Chai Point</span>
                <span className="tabular-nums text-slate-400">₹128.40</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-white/5 pt-3">
                <span className="text-slate-300">Rounded up to ₹129.00</span>
                <span className="text-2xl font-semibold tabular-nums text-mint">
                  +₹0.60
                </span>
              </div>

              <p className="mt-7 text-xs text-slate-500">
                Split across your buckets
              </p>
              <ul className="mt-3 space-y-3">
                {BUCKETS.map((bucket) => {
                  const share = balanced.targets[bucket.id];
                  return (
                    <li key={bucket.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2.5 rounded-full"
                            style={{ background: BUCKET_COLORS[bucket.id] }}
                          />
                          <span className="text-slate-200">{bucket.name}</span>
                          <span className="font-mono text-xs text-slate-500">
                            {bucket.ticker}
                          </span>
                        </span>
                        <span className="tabular-nums text-slate-400">
                          {share}%
                        </span>
                      </div>
                      <div
                        aria-hidden
                        className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${share}%`,
                            background: BUCKET_COLORS[bucket.id],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Parallax>
        </section>

        <Reveal
          as="section"
          className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-8"
        >
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-slate-50">
            Fork the agent pipeline
          </h2>
          <p className="mt-4 max-w-2xl text-slate-400">
            Acorns rebalances quarterly on drift it will not publish. Betterment
            rebalances daily on rules it will not publish. Every one of them asks
            you to hand over the money first. Pipdrift ships the engine instead:
            clone it, read the drift rule, change it, and run it yourself.
          </p>

          <ul className="mt-8 divide-y divide-white/10 border-t border-white/10">
            {PIPELINE_POINTS.map((point, i) => (
              <Reveal
                as="li"
                key={point.title}
                delay={i * 80}
                className="grid gap-2 py-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-10"
              >
                <h3 className="font-medium text-slate-100">{point.title}</h3>
                <p className="max-w-[65ch] text-sm leading-relaxed text-slate-400">
                  {point.body}
                </p>
              </Reveal>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/docs/agents"
              className="rounded-xl bg-mint px-6 py-3 font-semibold text-ink transition hover:bg-mint-bright"
            >
              Read the agents docs
            </Link>
            <Link
              href="/blog/open-agent-pipeline"
              className="rounded-xl border border-white/15 px-6 py-3 font-medium text-slate-200 transition hover:border-white/30"
            >
              Why this matters
            </Link>
          </div>
        </Reveal>

        <section className="border-t border-white/10 py-14">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-50">
            What the engine does on every tick
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 110}>
                <h3 className="font-medium text-slate-100">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {step.body}
                </p>
              </Reveal>
            ))}
          </div>
        </section>

        <Reveal
          as="section"
          className="rounded-2xl border border-white/10 bg-white/5 p-8"
        >
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-slate-50">
            Set it and forget it, without &ldquo;pay someone and hope&rdquo;
          </h2>
          <p className="mt-3 max-w-2xl text-slate-400">
            Most robo-advisors rebalance on a schedule you cannot see, using
            thresholds they will not publish. Pipdrift&rsquo;s engine is a handful
            of TypeScript modules: read the drift rule, change it, or plug in your
            own signal source and run the whole thing yourself.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href={signedIn ? "/sandbox" : "/signup"}
              className="rounded-xl bg-mint px-6 py-3 font-semibold text-ink transition hover:bg-mint-bright"
            >
              Open sandbox
            </Link>
            <Link
              href="/docs/agents"
              className="rounded-xl border border-white/15 px-6 py-3 font-medium text-slate-200 transition hover:border-white/30"
            >
              Read the agents docs
            </Link>
          </div>
        </Reveal>
      </main>

      <footer className="mx-auto w-full max-w-5xl border-t border-white/10 px-5 py-8 text-sm text-slate-500">
        <nav className="mb-4 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/pricing" className="transition hover:text-slate-300">
            Pricing
          </Link>
          <Link href="/faq" className="transition hover:text-slate-300">
            FAQ
          </Link>
          <Link href="/docs/agents" className="transition hover:text-slate-300">
            Agents docs
          </Link>
        </nav>
        Pipdrift is a sandbox. Balances are a ledger, no orders are placed, and
        nothing here is investment advice.
      </footer>
    </div>
  );
}
