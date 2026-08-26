import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Claude path has never run against the real API - nobody here has an
 * Anthropic key. That makes it the least-trusted code in the agent fleet, so
 * it is exercised against a mocked SDK instead: the parsing, the fallbacks and
 * the auth latch are all reachable without a credential.
 *
 * What this cannot prove is that the live API returns the shape assumed here.
 * The first real call is still the first real call.
 */

const create = vi.fn();

class AuthenticationError extends Error {}

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = { create };
    static AuthenticationError = AuthenticationError;
  }
  return { default: Anthropic };
});

function signal(id: string, title: string) {
  return { id, title, source: "Test", publishedAt: null };
}

function textResponse(body: string, stopReason = "end_turn") {
  return { stop_reason: stopReason, content: [{ type: "text", text: body }] };
}

async function loadClassifier() {
  // Fresh module each time: the auth latch is module-level state.
  vi.resetModules();
  return (await import("./sentiment-classifier")).claudeSentimentClassifier;
}

describe("claudeSentimentClassifier", () => {
  beforeEach(() => {
    create.mockReset();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns an empty array without calling the model", async () => {
    const classifier = await loadClassifier();

    expect(await classifier.classify([])).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });

  it("does not call the model when no credential is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const classifier = await loadClassifier();

    const [labelled] = await classifier.classify([signal("a", "Nifty rallies")]);

    expect(create).not.toHaveBeenCalled();
    expect(labelled.sentimentEngine).toBe("lexicon");
  });

  it("applies model labels and attributes them to claude", async () => {
    create.mockResolvedValue(
      textResponse('{"labels":[{"id":"a","sentiment":"positive"}]}'),
    );
    const classifier = await loadClassifier();

    const [labelled] = await classifier.classify([signal("a", "aaa bbb")]);

    expect(labelled.sentiment).toBe("positive");
    expect(labelled.sentimentEngine).toBe("claude");
  });

  it("sends one request for the whole batch", async () => {
    create.mockResolvedValue(
      textResponse(
        '{"labels":[{"id":"a","sentiment":"positive"},{"id":"b","sentiment":"negative"}]}',
      ),
    );
    const classifier = await loadClassifier();

    await classifier.classify([signal("a", "x"), signal("b", "y")]);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it("falls back to the lexicon for any signal the model skipped", async () => {
    create.mockResolvedValue(
      textResponse('{"labels":[{"id":"a","sentiment":"negative"}]}'),
    );
    const classifier = await loadClassifier();

    const results = await classifier.classify([signal("a", "x"), signal("b", "y")]);

    expect(results[0].sentimentEngine).toBe("claude");
    expect(results[1].sentimentEngine).toBe("lexicon");
  });

  it("ignores labels with an unrecognised sentiment", async () => {
    create.mockResolvedValue(
      textResponse('{"labels":[{"id":"a","sentiment":"euphoric"}]}'),
    );
    const classifier = await loadClassifier();

    expect((await classifier.classify([signal("a", "x")]))[0].sentimentEngine).toBe(
      "lexicon",
    );
  });

  it("falls back when the model returns unparseable text", async () => {
    create.mockResolvedValue(textResponse("sorry, here is some prose"));
    const classifier = await loadClassifier();

    expect((await classifier.classify([signal("a", "x")]))[0].sentimentEngine).toBe(
      "lexicon",
    );
  });

  it("falls back when the model refuses", async () => {
    create.mockResolvedValue(textResponse("{}", "refusal"));
    const classifier = await loadClassifier();

    expect((await classifier.classify([signal("a", "x")]))[0].sentimentEngine).toBe(
      "lexicon",
    );
  });

  it("falls back when the request throws", async () => {
    create.mockRejectedValue(new Error("network down"));
    const classifier = await loadClassifier();

    expect((await classifier.classify([signal("a", "x")]))[0].sentimentEngine).toBe(
      "lexicon",
    );
  });

  it("stops calling the model after credentials are rejected", async () => {
    create.mockRejectedValue(new AuthenticationError("bad key"));
    const classifier = await loadClassifier();

    await classifier.classify([signal("a", "x")]);
    await classifier.classify([signal("b", "y")]);

    // The latch means a keyless deployment pays one failed round-trip, not one
    // on every page view.
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("never returns a label it did not receive", async () => {
    create.mockResolvedValue(textResponse('{"labels":[]}'));
    const classifier = await loadClassifier();

    const results = await classifier.classify([signal("a", "x"), signal("b", "y")]);

    expect(results.every((r) => r.sentimentEngine === "lexicon")).toBe(true);
  });
});
