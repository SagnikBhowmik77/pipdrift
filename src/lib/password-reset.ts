import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "./db";
import { sendMail } from "./mailer";
import { hashPassword } from "./password";

/**
 * Password reset tokens.
 *
 * Rules this file exists to enforce:
 *   - the raw token is emailed and never stored, only its SHA-256
 *   - a token works once, then `usedAt` closes it
 *   - tokens expire, so a forgotten inbox is not a standing key
 *   - requesting a reset never reveals whether an account exists
 *   - a successful reset invalidates every other outstanding token
 */

const TOKEN_BYTES = 32;
const TTL_MS = 60 * 60 * 1000; // one hour

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function resetUrl(token: string): string {
  const base = (
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3100"
  ).replace(/\/+$/, "");

  return `${base}/reset-password?token=${token}`;
}

/**
 * Starts a reset if the address belongs to an account.
 *
 * Always resolves the same way regardless of whether the user exists - the
 * caller shows one message either way, so this endpoint cannot be used to
 * enumerate who has an account.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalised = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalised } });

  if (!user) return;

  // Supersede anything still outstanding, so a second request invalidates the
  // first link rather than leaving two live keys to the same account.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });

  await sendMail({
    to: user.email,
    subject: "Reset your Pipdrift password",
    text: [
      "Someone asked to reset the password on this Pipdrift account.",
      "",
      "Open this link to choose a new one. It works once and expires in an hour:",
      resetUrl(token),
      "",
      "If this wasn't you, ignore this email - nothing has changed.",
    ].join("\n"),
  });
}

export type ResetOutcome =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Checks a token without spending it, for rendering the form. */
export async function inspectResetToken(token: string): Promise<ResetOutcome> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true };
}

/**
 * Spends a token and sets the new password.
 *
 * The lookup is by hash, so the comparison is already constant-length; the
 * explicit timingSafeEqual guards the final confirmation against a
 * near-miss oracle.
 */
export async function consumeResetToken(
  token: string,
  newPassword: string,
): Promise<ResetOutcome> {
  const tokenHash = hashToken(token);

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) return { ok: false, reason: "invalid" };
  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const expected = Buffer.from(record.tokenHash, "hex");
  const actual = Buffer.from(tokenHash, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "invalid" };
  }

  const passwordHash = await hashPassword(newPassword);

  // One transaction: the password changes and every outstanding token for this
  // user closes together, so a reset can never leave a second live link behind.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true };
}
