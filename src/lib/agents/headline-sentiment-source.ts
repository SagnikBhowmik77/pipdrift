import "server-only";

import { scoreSentiment } from "@/lib/ai/lexicon";
import {
  NEUTRAL_READING,
  type Sentiment,
  type SentimentEngine,
  type SentimentReading,
  type SentimentSource,
  type Signal,
  type TickPayload,
} from "./types";

/**
 * The reference SentimentSource: averages a per-headline score across
 * everything the tick collected. Copy this file as the shape for your own.
 */

/** Engines whose label is a model's judgement rather than a word match. */
const MODEL_ENGINES: ReadonlySet<SentimentEngine> = new Set(["llm", "claude"]);

const LABEL_SCORE: Record<Sentiment, number> = {
  positive: 1,
  neutral: 0,
  negative: -1,
};

/**
 * Shrinkage prior, measured in headlines.
 *
 * A tick reads five headlines from one feed. Without this, five unanimous
 * labels average to 1.0 and spend the user's entire tilt authority on a sample
 * that thin - arithmetic that is confident in a way the evidence is not. The
 * mean is therefore pulled toward neutral by n / (n + CONFIDENCE_PRIOR): five
 * headlines keep half their strength, twenty keep four fifths, and one stray
 * headline barely moves anything. Raise it to make the agent more cautious.
 */
const CONFIDENCE_PRIOR = 5;

/** Share of the raw mean a sample of this many headlines may express. */
export function confidenceWeight(sampleSize: number): number {
  if (sampleSize <= 0) return 0;
  return sampleSize / (sampleSize + CONFIDENCE_PRIOR);
}

/**
 * Prefers the classifier's label over re-reading the headline.
 *
 * The tick arrives with sentiment already set by whichever engine the registry
 * picked. Re-scoring the title with the lexicon here would throw that away and
 * make the tilt lexicon-driven no matter what ran upstream - the model call
 * would be paid for and then ignored. So a model label converts to its numeric
 * form, and the lexicon is used only where a model did not label.
 *
 * Tags name the actual driver: matched terms for lexicon scores, "llm:positive"
 * and the like for model ones, so a reading never implies word matches that did
 * not happen.
 */
function scoreSignal(signal: Signal): { score: number; tags: string[] } {
  if (
    signal.sentiment &&
    signal.sentimentEngine &&
    MODEL_ENGINES.has(signal.sentimentEngine)
  ) {
    return {
      score: LABEL_SCORE[signal.sentiment],
      tags: [`${signal.sentimentEngine}:${signal.sentiment}`],
    };
  }

  const { score, tags } = scoreSentiment(signal.title);
  return { score, tags };
}

export const headlineSentimentSource: SentimentSource = {
  id: "headline-sentiment",
  name: "Headline sentiment",
  description:
    "Averages the classifier's read across the headlines collected this tick, damped by sample size, falling back to a weighted lexicon score with negation handling.",

  async evaluate(tick: TickPayload): Promise<SentimentReading> {
    if (tick.signals.length === 0) return NEUTRAL_READING;

    const scored = tick.signals.map(scoreSignal);
    const mean = scored.reduce((sum, s) => sum + s.score, 0) / scored.length;

    // Confidence scales with how much evidence this tick actually saw.
    const weighted = mean * confidenceWeight(scored.length);

    // Keep the strongest handful of drivers rather than every matched word.
    const tags = [...new Set(scored.flatMap((s) => s.tags))].slice(0, 6);
    const score = Math.round(weighted * 100) / 100;

    return {
      score,
      tags,
      label: score > 0.15 ? "positive" : score < -0.15 ? "negative" : "neutral",
    };
  },
};
