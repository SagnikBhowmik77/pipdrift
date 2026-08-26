import { describe, expect, it } from "vitest";

import { consumeRateLimit, pruneRateLimits, RULES } from "./rate-limit";

/**
 * The limiter guards the two endpoints an attacker gets for free: password
 * reset, which sends mail, and sign-in, which checks credentials.
 */

let n = 0;
const freshKey = (prefix: string) => `${prefix}:${(n += 1)}:${Date.now()}`;

const rule = { limit: 3, windowMs: 60_000 };

describe("consumeRateLimit", () => {
  it("allows attempts up to the limit and denies the next", async () => {
    const key = freshKey("basic");

    for (let i = 0; i < rule.limit; i++) {
      expect((await consumeRateLimit(key, rule)).allowed).toBe(true);
    }

    expect((await consumeRateLimit(key, rule)).allowed).toBe(false);
  });

  it("counts down the remaining allowance", async () => {
    const key = freshKey("remaining");

    expect((await consumeRateLimit(key, rule)).remaining).toBe(2);
    expect((await consumeRateLimit(key, rule)).remaining).toBe(1);
    expect((await consumeRateLimit(key, rule)).remaining).toBe(0);
  });

  it("keeps separate keys independent", async () => {
    const a = freshKey("a");
    const b = freshKey("b");

    for (let i = 0; i < rule.limit; i++) await consumeRateLimit(a, rule);

    expect((await consumeRateLimit(a, rule)).allowed).toBe(false);
    expect((await consumeRateLimit(b, rule)).allowed).toBe(true);
  });

  it("stays denied for repeated attempts inside the window", async () => {
    const key = freshKey("locked");
    for (let i = 0; i < rule.limit + 3; i++) await consumeRateLimit(key, rule);

    expect((await consumeRateLimit(key, rule)).allowed).toBe(false);
  });

  it("allows again once the window has passed", async () => {
    const key = freshKey("window");
    const brief = { limit: 1, windowMs: 40 };

    expect((await consumeRateLimit(key, brief)).allowed).toBe(true);
    expect((await consumeRateLimit(key, brief)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect((await consumeRateLimit(key, brief)).allowed).toBe(true);
  });

  it("reports when the caller may retry", async () => {
    const key = freshKey("retry");
    const before = Date.now();

    const result = await consumeRateLimit(key, rule);

    expect(result.retryAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.retryAt.getTime()).toBeLessThanOrEqual(
      before + rule.windowMs + 1_000,
    );
  });

  it("ships with a reset rule tighter than the login rule", async () => {
    // Reset sends email, so it must be the more restrictive of the two.
    expect(RULES.passwordReset.limit).toBeLessThan(RULES.login.limit);
  });
});

describe("pruneRateLimits", () => {
  it("removes windows old enough to be meaningless", async () => {
    const key = freshKey("stale");
    await consumeRateLimit(key, rule);

    const { prisma } = await import("./db");
    await prisma.rateLimit.update({
      where: { key },
      data: { windowStart: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    await pruneRateLimits(24 * 60 * 60 * 1000);

    expect(await prisma.rateLimit.findUnique({ where: { key } })).toBeNull();
  });

  it("leaves live windows alone", async () => {
    const key = freshKey("live");
    await consumeRateLimit(key, rule);

    await pruneRateLimits(24 * 60 * 60 * 1000);

    const { prisma } = await import("./db");
    expect(await prisma.rateLimit.findUnique({ where: { key } })).not.toBeNull();
  });
});
