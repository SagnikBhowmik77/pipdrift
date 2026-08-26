import "server-only";

import { classifyWithLexicon } from "@/lib/ai/lexicon";
import type { SentimentClassifier, Signal } from "./types";

/**
 * The no-credentials engine. Deterministic, offline, and always available -
 * it is what runs when nothing else is configured.
 */
export const lexiconOnlyClassifier: SentimentClassifier = {
  id: "lexicon",

  async classify(signals: Signal[]): Promise<Signal[]> {
    return signals.map((signal) => ({
      ...signal,
      sentiment: classifyWithLexicon(signal.title),
      sentimentEngine: "lexicon" as const,
    }));
  },
};
