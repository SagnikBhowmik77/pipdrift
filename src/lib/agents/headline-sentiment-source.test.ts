import { describe, expect, it } from "vitest";

import {
  confidenceWeight,
  headlineSentimentSource,
} from "./headline-sentiment-source";
import type { Sentiment, SentimentEngine, Signal, TickPayload } from "./types";

/**
 * This source produces the number that tilts allocations, so the thing worth
 * guarding is provenance: a model label must actually drive the score, and a
 * reading must never claim reasons it did not use.
 */

function signal(
  id: string,
  title: string,
  sentiment?: Sentiment,
  sentimentEngine?: SentimentEngine,
): Signal {
  return {
    id,
    title,
    source: "Test Feed",
    publishedAt: null,
    ...(sentiment ? { sentiment } : {}),
    ...(sentimentEngine ? { sentimentEngine } : {}),
  };
}

function tick(signals: Signal[]): TickPayload {
  return {
    at: new Date().toISOString(),
    userId: "user_test",
    totalPaise: 100_000,
    driftThresholdPct: 3,
    positions: [],
    signals,
  };
}

const evaluate = (signals: Signal[]) =>
  headlineSentimentSource.evaluate(tick(signals));

describe("headlineSentimentSource", () => {
  it("returns a neutral reading when the tick collected nothing", async () => {
    const reading = await evaluate([]);

    expect(reading.score).toBe(0);
    expect(reading.label).toBe("neutral");
  });

  it("uses model labels rather than re-reading the headline", async () => {
    // Titles carry no lexicon signal at all; only the labels can produce a score.
    const reading = await evaluate([
      signal("a", "aaa bbb ccc", "positive", "llm"),
      signal("b", "ddd eee fff", "positive", "llm"),
    ]);

    // Mean is 1, damped by a two-headline sample: 1 * 2/7 = 0.29.
    expect(reading.score).toBeCloseTo(0.29, 2);
    expect(reading.label).toBe("positive");
  });

  it("maps negative model labels to a bearish score", async () => {
    const reading = await evaluate([
      signal("a", "aaa bbb", "negative", "llm"),
      signal("b", "ccc ddd", "negative", "claude"),
    ]);

    expect(reading.score).toBeCloseTo(-0.29, 2);
    expect(reading.label).toBe("negative");
  });

  it("averages mixed labels instead of taking the loudest", async () => {
    const reading = await evaluate([
      signal("a", "x", "positive", "llm"),
      signal("b", "y", "negative", "llm"),
      signal("c", "z", "neutral", "llm"),
      signal("d", "w", "positive", "llm"),
    ]);

    // (1 - 1 + 0 + 1) / 4 = 0.25, damped by 4/(4+5).
    expect(reading.score).toBeCloseTo(0.11, 2);
  });

  it("attributes the score to the engine that produced it", async () => {
    const reading = await evaluate([signal("a", "x", "positive", "llm")]);

    expect(reading.tags).toContain("llm:positive");
  });

  it("falls back to the lexicon when no model labelled the signal", async () => {
    const lexiconOnly = await evaluate([
      signal("a", "Nifty rallies as inflation eases and growth beats forecasts"),
    ]);

    // A lexicon read still produces a score, and its tags are matched terms -
    // never an engine attribution it did not earn.
    expect(lexiconOnly.tags.every((t) => !t.startsWith("llm:"))).toBe(true);
    expect(typeof lexiconOnly.score).toBe("number");
  });

  it("ignores a label the lexicon engine attached", async () => {
    // sentimentEngine "lexicon" is not a model judgement, so the title is read.
    const reading = await evaluate([
      signal("a", "aaa bbb ccc", "positive", "lexicon"),
    ]);

    expect(reading.score).toBe(0);
    expect(reading.tags).not.toContain("lexicon:positive");
  });

  it("keeps the score inside -1..1 for any mix", async () => {
    const labels: Sentiment[] = ["positive", "negative", "neutral"];
    for (let n = 1; n <= 12; n++) {
      const signals = Array.from({ length: n }, (_, i) =>
        signal(`s${i}`, `headline ${i}`, labels[i % 3], "llm"),
      );
      const reading = await evaluate(signals);

      expect(reading.score).toBeGreaterThanOrEqual(-1);
      expect(reading.score).toBeLessThanOrEqual(1);
    }
  });

  it("caps how many drivers it reports", async () => {
    const signals = Array.from({ length: 20 }, (_, i) =>
      signal(`s${i}`, `headline ${i}`, "positive", "llm"),
    );

    expect((await evaluate(signals)).tags.length).toBeLessThanOrEqual(6);
  });

  it("keeps the neutral band - a weak reading is not a direction", async () => {
    // One positive in ten is 0.1, inside the +/-0.15 band.
    const signals = Array.from({ length: 10 }, (_, i) =>
      signal(`s${i}`, `h${i}`, i === 0 ? "positive" : "neutral", "llm"),
    );

    const reading = await evaluate(signals);
    // 0.1 raw, damped further by 10/(10+5) - comfortably inside the band.
    expect(reading.score).toBeCloseTo(0.07, 2);
    expect(reading.label).toBe("neutral");
  });
});

describe("confidenceWeight", () => {
  it("gives no weight to an empty sample", () => {
    expect(confidenceWeight(0)).toBe(0);
    expect(confidenceWeight(-3)).toBe(0);
  });

  it("holds a thin sample well short of full strength", () => {
    // The live tick reads five headlines; it should express half its mean.
    expect(confidenceWeight(5)).toBeCloseTo(0.5, 6);
    expect(confidenceWeight(1)).toBeLessThan(0.2);
  });

  it("grows with evidence but never reaches certainty", () => {
    expect(confidenceWeight(20)).toBeCloseTo(0.8, 6);
    expect(confidenceWeight(10_000)).toBeLessThan(1);
  });

  it("is monotonic in sample size", () => {
    for (let n = 1; n < 50; n++) {
      expect(confidenceWeight(n + 1)).toBeGreaterThan(confidenceWeight(n));
    }
  });

  it("keeps a unanimous five-headline tick from spending full authority", async () => {
    const unanimous = Array.from({ length: 5 }, (_, i) =>
      signal(`s${i}`, `headline ${i}`, "positive", "llm"),
    );

    const reading = await evaluate(unanimous);

    expect(reading.score).toBeCloseTo(0.5, 2);
    expect(reading.score).toBeLessThan(1);
  });
});
