import type { Sentiment } from "@/lib/agents/types";

/**
 * Deterministic sentiment scoring for financial headlines.
 *
 * This is the engine that runs when no model credentials are configured, so it
 * has to be good on its own rather than a token fallback. Three things do the
 * work a naive word-list gets wrong:
 *
 *   1. Terms are weighted. "crash" is not the same size as "slips".
 *   2. Longer phrases win. "rate cut" and "rate hike" share a word and point in
 *      opposite directions; matching the phrase first settles it.
 *   3. Negation flips. "without tariffs" and "no rate hike" are not bearish,
 *      which is exactly where flat word-lists produce their worst calls.
 *
 * Pure and dependency-free: no credentials, no network, runs anywhere.
 */

export type ScoredSentiment = {
  sentiment: Sentiment;
  /** Normalised into -1..1, where negative is bearish for a diversified book. */
  score: number;
  /** The terms that actually drove the score - surfaced for explainability. */
  tags: string[];
};

/** Weighted terms. Multi-word entries are matched before single words. */
const TERM_WEIGHTS: Record<string, number> = {
  // ── Strongly bullish ────────────────────────────────────────────────
  "record high": 3,
  "all-time high": 3,
  "rate cut": 3,
  "rate cuts": 3,
  "cuts rates": 3,
  "stimulus": 2,
  rally: 2,
  rallies: 2,
  surge: 2,
  surges: 2,
  soar: 2,
  soars: 2,
  jumps: 2,
  bullish: 2,
  rebound: 2,
  rebounds: 2,
  upgrade: 2,
  upgraded: 2,
  "beats estimates": 2,
  inflows: 2,
  "fii buying": 2,
  // ── Mildly bullish ──────────────────────────────────────────────────
  gain: 1,
  gains: 1,
  climb: 1,
  climbs: 1,
  rises: 1,
  higher: 1,
  optimism: 1,
  boost: 1,
  recovery: 1,
  profit: 1,
  outperform: 1,
  eases: 1,
  "growth": 1,
  "gdp growth": 2,
  // ── Mildly bearish ──────────────────────────────────────────────────
  slips: -1,
  dips: -1,
  falls: -1,
  fall: -1,
  drop: -1,
  drops: -1,
  lower: -1,
  weak: -1,
  weakens: -1,
  weaker: -1,
  weakness: -1,
  caution: -1,
  concerns: -1,
  skepticism: -1,
  slowdown: -1,
  provisioning: -1,
  // ── Strongly bearish ────────────────────────────────────────────────
  crash: -3,
  crashes: -3,
  crashed: -3,
  plunge: -3,
  plunges: -3,
  slump: -3,
  slumps: -3,
  slide: -1,
  slides: -1,
  crisis: -3,
  recession: -3,
  default: -3,
  selloff: -3,
  "sell-off": -3,
  "rate hike": -3,
  "rate hikes": -3,
  "hike fears": -3,
  tumble: -2,
  tumbles: -2,
  sinks: -2,
  downgrade: -2,
  downgraded: -2,
  bearish: -2,
  layoffs: -2,
  outflows: -2,
  "fii selling": -2,
  "profit booking": -2,
  "yields hit": -2,
  "yields rise": -2,
  inflation: -2,
  tariff: -2,
  tariffs: -2,
  fears: -2,
  warns: -2,
  warning: -2,
  losses: -2,
  npa: -2,
};

/**
 * Tokens that invert the term that follows them. Scoped to a short window,
 * because "no" three clauses away is not negating anything.
 */
const NEGATORS = new Set([
  "no",
  "not",
  "without",
  "never",
  "avoids",
  "avoided",
  "escapes",
  "escaped",
  "despite",
  "eases",
  "unlikely",
]);

const NEGATION_WINDOW = 3;

/** Longest first, so "rate cut" is consumed before the bare word "cut". */
const TERMS_BY_LENGTH = Object.keys(TERM_WEIGHTS).sort(
  (a, b) => b.length - a.length,
);

/** How strong the total must be before we call it anything but neutral. */
const NEUTRAL_BAND = 1;

/** Saturates the raw weight sum into -1..1 without a hard clip at the edges. */
function normalise(total: number): number {
  return Math.round(Math.tanh(total / 4) * 100) / 100;
}

function isNegated(words: string[], matchIndex: number): boolean {
  const from = Math.max(0, matchIndex - NEGATION_WINDOW);
  return words.slice(from, matchIndex).some((w) => NEGATORS.has(w));
}

export function scoreSentiment(title: string): ScoredSentiment {
  const text = ` ${title.toLowerCase().replace(/[^a-z0-9\s-]/g, " ")} `;
  const words = text.split(/\s+/).filter(Boolean);

  let total = 0;
  const tags: string[] = [];
  let remaining = text;

  for (const term of TERMS_BY_LENGTH) {
    const needle = ` ${term} `;
    if (!remaining.includes(needle)) continue;

    // Consume the match so a phrase is not counted again by its own words.
    remaining = remaining.replace(new RegExp(escapeRegExp(needle), "g"), " ");

    const head = term.split(" ")[0];
    const negated = isNegated(words, words.indexOf(head));
    const weight = TERM_WEIGHTS[term] * (negated ? -1 : 1);

    total += weight;
    tags.push(negated ? `not:${term}` : term);
  }

  const score = normalise(total);

  const sentiment: Sentiment =
    total >= NEUTRAL_BAND ? "positive" : total <= -NEUTRAL_BAND ? "negative" : "neutral";

  return { sentiment, score, tags };
}

/** Convenience wrapper for callers that only need the label. */
export function classifyWithLexicon(title: string): Sentiment {
  return scoreSentiment(title).sentiment;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
