import "server-only";

import { claudeSentimentClassifier } from "./sentiment-classifier";
import { llmSentimentClassifier, readLlmConfig } from "./llm-classifier";
import { lexiconOnlyClassifier } from "./lexicon-classifier";
import { headlineSentimentSource } from "./headline-sentiment-source";
import { rssHeadlineSource } from "./rss-source";
import {
  NEUTRAL_READING,
  type SentimentClassifier,
  type SentimentReading,
  type Signal,
  type SentimentSource,
  type SignalSource,
  type TickPayload,
} from "./types";

/**
 * The fleet. Add a module to one of these arrays and it takes effect
 * everywhere - no other file needs to change.
 */
export const SIGNAL_SOURCES: SignalSource[] = [rssHeadlineSource];

export const SENTIMENT_SOURCES: SentimentSource[] = [headlineSentimentSource];

/**
 * Chosen at call time from the environment, so switching providers is a config
 * change and never a code change:
 *
 *   LLM_BASE_URL + LLM_MODEL  -> any OpenAI-compatible provider (incl. free ones)
 *   ANTHROPIC_API_KEY         -> Claude
 *   neither                   -> the built-in lexicon
 */
export function getSentimentClassifier(): SentimentClassifier {
  if (readLlmConfig()) return llmSentimentClassifier;
  if (process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN) {
    return claudeSentimentClassifier;
  }
  return lexiconOnlyClassifier;
}

/** Name of the engine that would run right now, for display. */
export function activeEngineName(): string {
  const config = readLlmConfig();
  if (config) return config.model;
  if (process.env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_AUTH_TOKEN) {
    return "claude-opus-5";
  }
  return "built-in lexicon";
}

export function getSignalSource(id: string): SignalSource | undefined {
  return SIGNAL_SOURCES.find((source) => source.id === id);
}

/** Labelled signals, cached so one headline is never classified twice. */
type ClassifiedCache = {
  fetchedAt: number;
  /** Identity of the underlying headlines, so a new pull invalidates. */
  signature: string;
  signals: Signal[];
};

/**
 * Classification is the expensive step - a model round-trip - and the headline
 * feed only refreshes every five minutes. Without this, /sandbox/signals and
 * the agent tick each paid for their own call over the same headlines, doubling
 * both latency and quota for identical answers.
 */
const CLASSIFIED_TTL_MS = 5 * 60 * 1000;

let classifiedCache: ClassifiedCache | null = null;

function signatureOf(signals: Signal[]): string {
  return signals.map((s) => s.id).join("|");
}

/**
 * Pulls from every registered signal source and labels the result. Sources are
 * queried in parallel; a failing one contributes nothing rather than rejecting
 * the whole batch.
 *
 * Callers ask for different amounts - the panel wants five, a tick wants twenty
 * - so the cache holds the largest batch classified so far and serves prefixes
 * of it. A request for more than is cached reclassifies.
 */
export async function collectSignals(limitPerSource = 5) {
  const batches = await Promise.all(
    SIGNAL_SOURCES.map(async (source) => {
      try {
        return await source.fetchSignals(limitPerSource);
      } catch (error) {
        console.error(`[agents] signal source ${source.id} failed`, error);
        return [];
      }
    }),
  );

  const signals = batches.flat();
  const signature = signatureOf(signals);

  const cached = classifiedCache;
  if (
    cached &&
    Date.now() - cached.fetchedAt < CLASSIFIED_TTL_MS &&
    cached.signals.length >= signals.length &&
    cached.signature.startsWith(signature)
  ) {
    return cached.signals.slice(0, signals.length);
  }

  const classified = await getSentimentClassifier().classify(signals);

  if (classified.length > 0) {
    classifiedCache = {
      fetchedAt: Date.now(),
      signature: signatureOf(classified),
      signals: classified,
    };
  }

  return classified;
}

/**
 * Runs every registered sentiment source against the tick and averages their
 * readings. This is what the rebalance agent reads: it is reported alongside
 * each tick and recorded on the events a tick writes.
 */
export async function readSentiment(
  tick: TickPayload,
): Promise<SentimentReading> {
  if (SENTIMENT_SOURCES.length === 0) return NEUTRAL_READING;

  const readings = await Promise.all(
    SENTIMENT_SOURCES.map(async (source) => {
      try {
        return await source.evaluate(tick);
      } catch (error) {
        console.error(`[agents] sentiment source ${source.id} failed`, error);
        return NEUTRAL_READING;
      }
    }),
  );

  const mean =
    readings.reduce((sum, r) => sum + r.score, 0) / readings.length;
  const score = Math.round(mean * 100) / 100;

  return {
    score,
    tags: [...new Set(readings.flatMap((r) => r.tags))].slice(0, 8),
    label: score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral",
  };
}
