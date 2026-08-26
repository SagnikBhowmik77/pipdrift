/**
 * The plug-in surface for the agent fleet.
 *
 * A signal source is any module that can answer "what is happening right now?"
 * in a form the rebalancer can reason about. The RSS headline reader is one
 * implementation; a forked deployment can add its own without touching the
 * engine, which is the entire point of the forkable positioning.
 *
 * Nothing here is server-only - the types are shared with client components.
 */

export type Sentiment = "positive" | "neutral" | "negative";

/**
 * Which engine produced a label. The UI reports this verbatim so a rules-based
 * label is never presented as model output.
 */
export type SentimentEngine = "claude" | "llm" | "lexicon";

/** One observation from the outside world. */
export type Signal = {
  /** Stable id for this observation, unique within its source. */
  id: string;
  /** Human-readable summary - a headline, an indicator name, an alert. */
  title: string;
  /** Where a reader can verify it. Optional: not every signal has a URL. */
  url?: string;
  /** Display name of the origin, e.g. "CNBC Markets". */
  source: string;
  /** ISO timestamp, or null when the source does not report one. */
  publishedAt: string | null;
  /** Directional read for a diversified portfolio, once classified. */
  sentiment?: Sentiment;
  /** How the sentiment was produced - surfaced in the UI, never implied. */
  sentimentEngine?: SentimentEngine;
};

/**
 * Implement this and register it in `src/lib/agents/registry.ts` to add a new
 * source. `fetchSignals` must never throw: a broken upstream should degrade the
 * panel, not take the page down.
 */
export type SignalSource = {
  /** Unique slug, used as the registry key. */
  id: string;
  /** Shown in the UI as the panel's attribution. */
  name: string;
  /** One line explaining what this source watches. */
  description: string;
  /** Return at most `limit` signals, newest first. Return [] on failure. */
  fetchSignals(limit: number): Promise<Signal[]>;
};

/**
 * A classifier turns raw signals into labeled ones. The default implementation
 * asks Claude and falls back to a lexicon; swap it to use your own model.
 */
export type SentimentClassifier = {
  id: string;
  classify(signals: Signal[]): Promise<Signal[]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sentiment sources
//
// A signal source (above) answers "what happened?". A sentiment source answers
// "what should the fleet make of it?" - it receives the tick payload the
// rebalance agent assembled and returns a directional score plus the tags that
// explain it. This is the extension point documented at /docs/agents.
// ─────────────────────────────────────────────────────────────────────────────

/** A snapshot of one bucket at tick time. */
export type TickPosition = {
  bucketId: string;
  balancePaise: number;
  currentPct: number;
  targetPct: number;
  driftPct: number;
};

/** Everything the rebalance agent knows when it runs one tick. */
export type TickPayload = {
  /** ISO timestamp of the tick. */
  at: string;
  userId: string;
  totalPaise: number;
  driftThresholdPct: number;
  positions: TickPosition[];
  /** Signals collected from every registered SignalSource this tick. */
  signals: Signal[];
};

export type SentimentReading = {
  /** -1 (bearish) to 1 (bullish) for a diversified portfolio. */
  score: number;
  /** Short machine-readable reasons - the terms or rules that drove the score. */
  tags: string[];
  /** Bucketed form of the score, for display. */
  label: Sentiment;
};

/**
 * Implement this and register it in `src/lib/agents/registry.ts` to give the
 * fleet a new way of reading the world. `evaluate` must never throw - return a
 * neutral reading if your upstream is unavailable.
 */
export type SentimentSource = {
  id: string;
  name: string;
  description: string;
  evaluate(tick: TickPayload): Promise<SentimentReading>;
};

export const NEUTRAL_READING: SentimentReading = {
  score: 0,
  tags: [],
  label: "neutral",
};
