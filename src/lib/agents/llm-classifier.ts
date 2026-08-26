import "server-only";

import { classifyWithLexicon } from "@/lib/ai/lexicon";
import type { SentimentClassifier, Sentiment, Signal } from "./types";

/**
 * Sentiment via any OpenAI-compatible chat-completions endpoint.
 *
 * Almost every provider - Google Gemini, Groq, OpenRouter, Together, Mistral,
 * and a local Ollama - exposes this same shape, so one implementation covers all
 * of them and the choice becomes three environment variables rather than a code
 * change. That matters here because the free tiers are the ones people actually
 * reach for, and none of them are Anthropic.
 *
 * Falls back to the lexicon on any failure, so a rate limit or an expired key
 * degrades the label quality instead of breaking the page.
 */

// Generous on purpose: a 5-headline batch runs 5-7s against a hosted flash
// model, so a 15s ceiling left cold starts and slow first calls falling back to
// the lexicon with nothing but a log line to show for it.
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You label financial news headlines by their likely effect on a diversified retail ETF portfolio (Indian equities, Indian government bonds, global growth exposure).

Reply with JSON only - no prose, no markdown, no code fences. Shape:
{"labels":[{"id":"<the id given>","sentiment":"positive|neutral|negative"}]}

Return exactly one entry per headline, preserving the ids given.
- positive: likely supports asset prices or signals easing conditions
- negative: likely pressures asset prices or signals stress
- neutral: mixed, procedural, or no clear directional read`;

type ChatResponse = {
  choices?: { message?: { content?: unknown } }[];
  error?: { message?: string };
};

type LabelResponse = { labels?: { id?: unknown; sentiment?: unknown }[] };

function isSentiment(value: unknown): value is Sentiment {
  return value === "positive" || value === "neutral" || value === "negative";
}

export type LlmConfig = { baseUrl: string; apiKey: string; model: string };

/** Local runtimes (Ollama, LM Studio) serve without auth; remote ones never do. */
function isLocalHost(baseUrl: string): boolean {
  try {
    const { hostname } = new URL(baseUrl);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

/**
 * Reads the provider config, and returns null when a call would be pointless.
 *
 * The key check matters: a half-filled .env - provider URL pasted in, key still
 * empty - would otherwise fire an unauthenticated request on every page view,
 * get a 401, and fall back. That is a slow, log-spamming way to end up exactly
 * where the lexicon would have put us instantly. A local runtime is the one
 * case where a missing key is legitimate.
 */
export function readLlmConfig(): LlmConfig | null {
  const baseUrl = process.env.LLM_BASE_URL?.trim().replace(/\/+$/, "");
  const model = process.env.LLM_MODEL?.trim();
  const apiKey = process.env.LLM_API_KEY?.trim() ?? "";

  if (!baseUrl || !model) return null;
  if (!apiKey && !isLocalHost(baseUrl)) return null;

  return { baseUrl, apiKey, model };
}

/** Strips ``` fences some models add despite being told not to. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start !== -1 && end > start ? body.slice(start, end + 1) : body;
}

function withLexicon(signals: Signal[]): Signal[] {
  return signals.map((signal) => ({
    ...signal,
    sentiment: classifyWithLexicon(signal.title),
    sentimentEngine: "lexicon" as const,
  }));
}

export const llmSentimentClassifier: SentimentClassifier = {
  id: "llm-sentiment",

  async classify(signals: Signal[]): Promise<Signal[]> {
    if (signals.length === 0) return [];

    const config = readLlmConfig();
    if (!config) return withLexicon(signals);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(config.apiKey
            ? { authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify(
                signals.map((s) => ({ id: s.id, title: s.title })),
              ),
            },
          ],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        console.error(
          `[agents] LLM ${response.status}: ${data.error?.message ?? "request failed"} - using lexicon`,
        );
        return withLexicon(signals);
      }

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        console.error("[agents] LLM returned no text content - using lexicon");
        return withLexicon(signals);
      }

      const parsed = JSON.parse(extractJson(content)) as LabelResponse;
      const byId = new Map<string, Sentiment>();

      for (const label of parsed.labels ?? []) {
        if (typeof label.id === "string" && isSentiment(label.sentiment)) {
          byId.set(label.id, label.sentiment);
        }
      }

      if (byId.size === 0) {
        console.error("[agents] LLM returned no usable labels - using lexicon");
        return withLexicon(signals);
      }

      // Anything the model skipped still gets a label from the lexicon.
      return signals.map((signal) => {
        const sentiment = byId.get(signal.id);
        return sentiment
          ? { ...signal, sentiment, sentimentEngine: "llm" as const }
          : {
              ...signal,
              sentiment: classifyWithLexicon(signal.title),
              sentimentEngine: "lexicon" as const,
            };
      });
    } catch (error) {
      console.error("[agents] LLM classification failed; using lexicon", error);
      return withLexicon(signals);
    }
  },
};
