import { Card, DashboardShell, EmptyState } from "@/components/dashboard-shell";
import {
  activeEngineName,
  collectSignals,
  SIGNAL_SOURCES,
} from "@/lib/agents/registry";
import type { Sentiment } from "@/lib/agents/types";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Market signals · Pipdrift",
};

const SENTIMENT_STYLES: Record<Sentiment, { label: string; className: string }> = {
  positive: { label: "Positive", className: "border-mint/40 bg-mint/10 text-mint" },
  neutral: {
    label: "Neutral",
    className: "border-white/15 bg-white/5 text-slate-300",
  },
  negative: {
    label: "Negative",
    className: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

export default async function SignalsPage() {
  await getSessionUserId();

  const signals = await collectSignals(5);
  // Report the engine that actually produced the labels, not the one that is
  // configured - a provider that errors falls back, and the UI must say so.
  const usedModel = signals.some(
    (s) => s.sentimentEngine === "claude" || s.sentimentEngine === "llm",
  );
  const engine = activeEngineName();

  return (
    <DashboardShell
      title="Market signals"
      subtitle="What the agents are reading, and how each headline reads for a diversified portfolio."
      active="/sandbox/signals"
    >
      {signals.length === 0 ? (
        <EmptyState
          title="No signals available"
          body="No registered source returned anything and nothing is cached yet. The feed refreshes automatically - try again shortly."
          cta={{ href: "/docs/agents", label: "Add a signal source" }}
        />
      ) : (
        <div className="space-y-4">
          <Card className="p-0">
            <ul className="divide-y divide-white/5">
              {signals.map((signal) => {
                const style = SENTIMENT_STYLES[signal.sentiment ?? "neutral"];

                return (
                  <li key={signal.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      {signal.url ? (
                        <a
                          href={signal.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-slate-100 underline-offset-4 transition hover:text-mint hover:underline"
                        >
                          {signal.title}
                        </a>
                      ) : (
                        <span className="flex-1 text-slate-100">{signal.title}</span>
                      )}
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${style.className}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {signal.source}
                      {signal.publishedAt && ` · ${relativeTime(signal.publishedAt)}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="flex flex-wrap justify-between gap-3 text-xs text-slate-500">
            <p>
              {SIGNAL_SOURCES.length}{" "}
              {SIGNAL_SOURCES.length === 1 ? "source" : "sources"} registered ·{" "}
              {usedModel
                ? `sentiment labeled by ${engine}`
                : "sentiment labeled by the built-in lexicon - set LLM_BASE_URL, LLM_MODEL and LLM_API_KEY to use a model"}
            </p>
            <a
              href="/docs/agents"
              className="text-mint underline-offset-4 hover:underline"
            >
              Add your own source →
            </a>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
