import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { classifyWithLexicon } from "@/lib/ai/lexicon";
import type { SentimentClassifier, Sentiment, Signal } from "./types";

/**
 * Labels signals with Claude, falling back to a deterministic lexicon.
 *
 * The fallback is not a nicety: a fresh clone, CI, or an offline fork has no
 * credentials, and /sandbox/signals must still render labeled headlines. Every
 * signal carries `sentimentEngine` so the UI reports which path actually ran
 * and never implies model output it did not get.
 */

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You label financial news headlines by their likely effect on a diversified retail ETF portfolio (Indian equities, Indian government bonds, global growth exposure).

Reply with JSON only - no prose, no code fences. Shape:
{"labels":[{"id":"<the id given>","sentiment":"positive|neutral|negative"}]}

Return exactly one entry per headline, preserving the ids given.
- positive: likely supports asset prices or signals easing conditions
- negative: likely pressures asset prices or signals stress
- neutral: mixed, procedural, or no clear directional read`;

type LabelResponse = { labels?: { id?: unknown; sentiment?: unknown }[] };

function isSentiment(value: unknown): value is Sentiment {
  return value === "positive" || value === "neutral" || value === "negative";
}

/**
 * Whether a Claude call is worth attempting.
 *
 * The SDK resolves credentials from several sources, so this checks the ones a
 * server process can actually have rather than assuming ANTHROPIC_API_KEY. When
 * a call fails for an auth reason we latch this off, so a keyless deployment
 * pays the failed round-trip once rather than on every page view.
 */
let claudeDisabled = false;

function claudeIsConfigured(): boolean {
  if (claudeDisabled) return false;
  // A base URL is not a credential - including it here would make a proxied
  // deployment attempt a keyless call on every page view before latching off.
  return Boolean(
    process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN,
  );
}

function withLexicon(signals: Signal[]): Signal[] {
  return signals.map((signal) => ({
    ...signal,
    sentiment: classifyWithLexicon(signal.title),
    sentimentEngine: "lexicon" as const,
  }));
}

export const claudeSentimentClassifier: SentimentClassifier = {
  id: "claude-sentiment",

  async classify(signals: Signal[]): Promise<Signal[]> {
    if (signals.length === 0) return [];
    if (!claudeIsConfigured()) return withLexicon(signals);

    try {
      const client = new Anthropic();

      // One call for the whole batch - five separate requests to label one
      // panel would be five round-trips for no extra accuracy.
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: JSON.stringify(
              signals.map((s) => ({ id: s.id, title: s.title })),
            ),
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        console.warn("[agents] model declined to label; using lexicon");
        return withLexicon(signals);
      }

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();

      const parsed = JSON.parse(text) as LabelResponse;
      const byId = new Map<string, Sentiment>();

      for (const label of parsed.labels ?? []) {
        if (typeof label.id === "string" && isSentiment(label.sentiment)) {
          byId.set(label.id, label.sentiment);
        }
      }

      // Anything the model skipped still gets a label from the lexicon.
      return signals.map((signal) => {
        const sentiment = byId.get(signal.id);
        return sentiment
          ? { ...signal, sentiment, sentimentEngine: "claude" as const }
          : {
              ...signal,
              sentiment: classifyWithLexicon(signal.title),
              sentimentEngine: "lexicon" as const,
            };
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        console.error("[agents] Claude credentials rejected; lexicon from now on");
        claudeDisabled = true;
      } else {
        console.error("[agents] classification failed; using lexicon", error);
      }
      return withLexicon(signals);
    }
  },
};
