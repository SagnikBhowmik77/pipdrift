import "server-only";

import { prisma } from "./db";

/**
 * Fixed-window rate limiting.
 *
 * Password reset sends an email on every accepted submission, which makes an
 * unlimited endpoint a free way to flood someone's inbox and burn the mail
 * quota. Sign-in without a limit is an offline-speed password guesser. Both
 * need a ceiling, and it has to be shared across instances - a module-level Map
 * protects nothing on serverless, where consecutive requests may each land on a
 * fresh process.
 *
 * Fixed window rather than sliding: it is one row and one write per attempt,
 * and the failure mode (up to 2x the limit across a window boundary) is
 * irrelevant at these thresholds. Correctness here means "an attacker cannot
 * send thousands", not "exactly N per interval".
 */

export type RateLimitRule = {
  /** Attempts permitted inside one window. */
  limit: number;
  windowMs: number;
};

export const RULES = {
  /** Reset mail is the expensive one - per address. */
  passwordReset: { limit: 3, windowMs: 60 * 60 * 1000 },
  /** Credential stuffing protection, per address. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Signup abuse, per address prefix. */
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  /** Attempts left in this window, floored at zero. */
  remaining: number;
  /** When the window resets. */
  retryAt: Date;
};

/**
 * Records an attempt and reports whether it may proceed.
 *
 * Fails open. A limiter that takes the site down when its own table is
 * unreachable has turned a nuisance into an outage - the risk of letting a few
 * extra attempts through is much smaller than refusing every legitimate one.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const now = new Date();

  try {
    const existing = await prisma.rateLimit.findUnique({ where: { key } });

    const windowExpired =
      !existing || now.getTime() - existing.windowStart.getTime() >= rule.windowMs;

    if (windowExpired) {
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, windowStart: now },
        update: { count: 1, windowStart: now },
      });

      return {
        allowed: true,
        remaining: rule.limit - 1,
        retryAt: new Date(now.getTime() + rule.windowMs),
      };
    }

    const retryAt = new Date(existing.windowStart.getTime() + rule.windowMs);

    if (existing.count >= rule.limit) {
      return { allowed: false, remaining: 0, retryAt };
    }

    await prisma.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - existing.count - 1),
      retryAt,
    };
  } catch (error) {
    console.error("[rate-limit] check failed; allowing request", error);
    return {
      allowed: true,
      remaining: rule.limit,
      retryAt: new Date(now.getTime() + rule.windowMs),
    };
  }
}

/**
 * Best-effort cleanup of windows that can no longer deny anything.
 *
 * Without it the table grows one row per distinct key forever. Callers should
 * treat failure as unremarkable - the rows are harmless, just untidy.
 */
export async function pruneRateLimits(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  try {
    const { count } = await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - olderThanMs) } },
    });
    return count;
  } catch (error) {
    console.error("[rate-limit] prune failed", error);
    return 0;
  }
}
