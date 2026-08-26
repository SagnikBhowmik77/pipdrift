import Link from "next/link";

import { MarketingShell } from "@/components/marketing-shell";
import { SENTIMENT_SOURCES, SIGNAL_SOURCES } from "@/lib/agents/registry";

export const metadata = {
  title: "Agents module · Pipdrift",
  description:
    "How to plug a custom signal source or a new bucket into the Pipdrift agent pipeline.",
};

function Code({ children }: { children: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
      <pre className="p-4 text-sm leading-relaxed">
        <code className="font-mono text-slate-300">{children}</code>
      </pre>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-[2.5rem_1fr]">
      <span
        aria-hidden
        className="font-mono text-2xl tabular-nums leading-none text-mint"
      >
        {String(n).padStart(2, "0")}
      </span>
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-50">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

export default function AgentsDocsPage() {
  return (
    <MarketingShell
      title="Fork the agent pipeline"
      subtitle="Every signal the agents read comes from a registered TypeScript module. Adding your own means writing one object and adding one line - nothing in the rebalancing engine changes."
      active="/docs/agents"
    >
      <div className="space-y-8">
        <Step n={1} title="Implement the SignalSource interface">
          <p className="text-slate-400">
            The contract lives in{" "}
            <code className="font-mono text-sm text-slate-300">
              src/lib/agents/types.ts
            </code>
            . A source answers one question: what is happening right now?
          </p>
          <Code>{`export type SignalSource = {
  id: string;          // unique slug, used as the registry key
  name: string;        // shown in the UI as attribution
  description: string; // one line: what does this source watch?
  fetchSignals(limit: number): Promise<Signal[]>;
};

export type Signal = {
  id: string;               // unique within the source
  title: string;            // headline, indicator name, alert
  url?: string;             // where a reader can verify it
  source: string;           // display name of the origin
  publishedAt: string | null;
  sentiment?: Sentiment;    // filled in by the classifier
  sentimentEngine?: "claude" | "lexicon";
};`}</Code>
          <p className="text-slate-400">
            <strong className="font-medium text-slate-200">
              fetchSignals must never throw.
            </strong>{" "}
            A broken upstream should degrade the panel, not take the page down -
            return an empty array instead.
          </p>
        </Step>

        <Step n={2} title="Write your source">
          <p className="text-slate-400">
            Copy{" "}
            <code className="font-mono text-sm text-slate-300">
              src/lib/agents/rss-source.ts
            </code>{" "}
            as a starting shape. Here is a complete source that watches a
            hypothetical rates endpoint:
          </p>
          <Code>{`// src/lib/agents/repo-rate-source.ts
import "server-only";

import type { Signal, SignalSource } from "./types";

export const repoRateSource: SignalSource = {
  id: "repo-rate",
  name: "RBI repo rate",
  description: "Policy rate changes, which move the bond bucket first.",

  async fetchSignals(limit): Promise<Signal[]> {
    try {
      const res = await fetch("https://example.com/api/repo-rate", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];

      const rows = (await res.json()) as { id: string; note: string; at: string }[];

      return rows.slice(0, limit).map((row) => ({
        id: \`repo-\${row.id}\`,
        title: row.note,
        source: "RBI",
        publishedAt: row.at,
      }));
    } catch {
      return []; // degrade, never throw
    }
  },
};`}</Code>
        </Step>

        <Step n={3} title="Register it">
          <p className="text-slate-400">
            One line in{" "}
            <code className="font-mono text-sm text-slate-300">
              src/lib/agents/registry.ts
            </code>
            . Sources are queried in parallel; a failing one contributes nothing
            rather than rejecting the batch.
          </p>
          <Code>{`import { repoRateSource } from "./repo-rate-source";
import { rssHeadlineSource } from "./rss-source";

export const SIGNAL_SOURCES: SignalSource[] = [
  rssHeadlineSource,
  repoRateSource, // ← your source
];`}</Code>
          <p className="text-slate-400">
            That is the whole integration.{" "}
            <Link
              href="/sandbox/signals"
              className="text-mint underline-offset-4 hover:underline"
            >
              /sandbox/signals
            </Link>{" "}
            picks it up on the next request.
          </p>
        </Step>

        <Step n={4} title="Write a sentiment source">
          <p className="text-slate-400">
            A signal source answers <em>what happened</em>. A sentiment source
            answers <em>what the fleet should make of it</em>: it receives the
            tick payload the rebalance agent assembled and returns a directional
            score plus the tags that explain it.
          </p>
          <Code>{`export type TickPayload = {
  at: string;                  // ISO timestamp of this tick
  userId: string;
  totalPaise: number;
  driftThresholdPct: number;
  positions: TickPosition[];   // balance, current %, target %, drift % per bucket
  signals: Signal[];           // everything the signal sources returned
};

export type SentimentReading = {
  score: number;    // -1 (bearish) .. 1 (bullish)
  tags: string[];   // the rules or terms that drove the score
  label: "positive" | "neutral" | "negative";
};

export type SentimentSource = {
  id: string;
  name: string;
  description: string;
  evaluate(tick: TickPayload): Promise<SentimentReading>;
};`}</Code>

          <p className="text-slate-400">
            A complete, runnable example - it leans bearish when the bond bucket
            is badly underweight while headlines are negative:
          </p>
          <Code>{`// src/lib/agents/defensive-source.ts
import "server-only";

import { scoreSentiment } from "@/lib/ai/lexicon";
import type { SentimentReading, SentimentSource, TickPayload } from "./types";

export const defensiveSource: SentimentSource = {
  id: "defensive-tilt",
  name: "Defensive tilt",
  description: "Bearish when bonds are underweight and the news is negative.",

  async evaluate(tick: TickPayload): Promise<SentimentReading> {
    const bonds = tick.positions.find((p) => p.bucketId === "bonds");
    const underweight = bonds ? bonds.driftPct < -2 : false;

    const scores = tick.signals.map((s) => scoreSentiment(s.title).score);
    const mean = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    const score = underweight ? Math.min(mean, -0.2) : mean;
    const tags = underweight ? ["bonds-underweight"] : [];

    return {
      score,
      tags,
      label: score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral",
    };
  },
};

// register it in registry.ts:
export const SENTIMENT_SOURCES: SentimentSource[] = [
  headlineSentimentSource,
  defensiveSource, // ← yours
];`}</Code>

          <p className="text-slate-400">
            <strong className="font-medium text-slate-200">
              Where the rebalance agent reads from:
            </strong>{" "}
            <code className="font-mono text-sm text-slate-300">
              runRebalanceTick
            </code>{" "}
            in{" "}
            <code className="font-mono text-sm text-slate-300">
              src/lib/rebalance.ts
            </code>{" "}
            builds the payload, calls{" "}
            <code className="font-mono text-sm text-slate-300">readSentiment</code>,
            and returns the averaged reading on every{" "}
            <code className="font-mono text-sm text-slate-300">
              POST /api/rebalance
            </code>{" "}
            response. Note that drift is still the only thing that moves money -
            the reading is reported and logged, not acted on, so a source you add
            cannot silently reallocate a portfolio until you wire it into the
            trigger yourself.
          </p>
        </Step>

        <Step n={5} title="Swap the sentiment classifier">
          <p className="text-slate-400">
            The default classifier asks Claude and falls back to a deterministic
            lexicon when no credentials are present. Implement{" "}
            <code className="font-mono text-sm text-slate-300">
              SentimentClassifier
            </code>{" "}
            to use your own model:
          </p>
          <Code>{`export type SentimentClassifier = {
  id: string;
  classify(signals: Signal[]): Promise<Signal[]>;
};

// then, in registry.ts:
export const SENTIMENT_CLASSIFIER: SentimentClassifier = myClassifier;`}</Code>
          <p className="text-slate-400">
            Set{" "}
            <code className="font-mono text-sm text-slate-300">
              ANTHROPIC_API_KEY
            </code>{" "}
            to enable the Claude path on the stock classifier. Always set{" "}
            <code className="font-mono text-sm text-slate-300">
              sentimentEngine
            </code>{" "}
            so the UI can say which path produced a label rather than implying
            model output it did not get.
          </p>
        </Step>

        <Step n={6} title="Add a bucket">
          <p className="text-slate-400">
            Buckets are declared in{" "}
            <code className="font-mono text-sm text-slate-300">
              src/lib/buckets.ts
            </code>
            . Add an entry, give it a color, and set targets that still sum to
            100%:
          </p>
          <Code>{`// 1. src/lib/buckets.ts - extend the union and the list
export type BucketId = "equities" | "bonds" | "emerging" | "gold";

export const BUCKETS: Bucket[] = [
  // …existing three…
  { id: "gold", name: "Gold", ticker: "GOLDBEES",
    blurb: "Sovereign gold exposure - the inflation hedge." },
];

// 2. src/lib/chart-palette.ts - the pie needs a validated color
export const BUCKET_COLORS: Record<BucketId, string> = {
  equities: "#3987e5", bonds: "#d95926",
  emerging: "#199e70", gold: "#c98500",
};

// 3. src/lib/risk-profiles.ts - every preset must still total 100`}</Code>
          <p className="text-slate-400">
            Risk-profile targets are asserted to sum to 100 at module load, so a
            preset you forget to update fails fast at boot rather than quietly
            skewing an allocation. Bucket rows are created per user at signup -
            existing accounts need a backfill for the new bucket.
          </p>
        </Step>

        <Step n={7} title="Know the invariants">
          <ul className="space-y-3 text-slate-400">
            <li>
              <strong className="font-medium text-slate-200">
                Money is integer paise.
              </strong>{" "}
              Never introduce float rupees. The rebalancer splits totals with
              largest-remainder allocation so buckets always sum back to the exact
              total.
            </li>
            <li>
              <strong className="font-medium text-slate-200">
                Drift is only meaningful on a funded portfolio.
              </strong>{" "}
              An empty portfolio reports zero drift rather than &ldquo;100 points
              underweight&rdquo;, so the agents never fire on nothing.
            </li>
            <li>
              <strong className="font-medium text-slate-200">
                A tick that changes nothing writes nothing.
              </strong>{" "}
              Rebalance events are a log of decisions, not of polls.
            </li>
          </ul>
        </Step>
      </div>

      <section className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-sm font-medium text-slate-300">
          Registered in this deployment right now
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Read live from the registry - if this list is wrong, the registry is.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Signal sources
            </dt>
            <dd className="mt-1 space-y-1">
              {SIGNAL_SOURCES.map((source) => (
                <p key={source.id} className="text-slate-400">
                  <code className="font-mono text-slate-300">{source.id}</code> -{" "}
                  {source.description}
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Sentiment sources
            </dt>
            <dd className="mt-1 space-y-1">
              {SENTIMENT_SOURCES.map((source) => (
                <p key={source.id} className="text-slate-400">
                  <code className="font-mono text-slate-300">{source.id}</code> -{" "}
                  {source.description}
                </p>
              ))}
            </dd>
          </div>
        </dl>
      </section>
    </MarketingShell>
  );
}
