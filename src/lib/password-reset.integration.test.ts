import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedUser } from "@/test/factories";

/**
 * The reset-token lifecycle against a real database. These encode the security
 * properties, not just the happy path: a token must be single-use, expire, and
 * never be readable from the row that stores it.
 */

const sendMail = vi.fn();

vi.mock("./mailer", () => ({
  sendMail: (...args: unknown[]) => sendMail(...args),
  activeTransport: () => "console",
}));

/** The emailed link is the only place the raw token exists. */
function tokenFromLastMail(): string {
  const body = sendMail.mock.calls.at(-1)?.[0]?.text ?? "";
  return String(body).match(/token=([A-Za-z0-9_-]+)/)?.[1] ?? "";
}

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue({ transport: "console", delivered: true });
});

async function lib() {
  return import("./password-reset");
}

describe("password reset lifecycle", () => {
  it("emails a link for a real account", async () => {
    const user = await seedUser();
    const { requestPasswordReset } = await lib();

    await requestPasswordReset(user.email);

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(tokenFromLastMail()).not.toBe("");
  });

  it("sends nothing for an address with no account", async () => {
    const { requestPasswordReset } = await lib();

    await requestPasswordReset("nobody@example.test");

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("never stores the raw token", async () => {
    const user = await seedUser();
    const { requestPasswordReset } = await lib();
    await requestPasswordReset(user.email);

    const raw = tokenFromLastMail();
    const { prisma } = await import("./db");
    const row = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
    });

    expect(row?.tokenHash).toBeDefined();
    expect(row?.tokenHash).not.toBe(raw);
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("accepts a fresh token and changes the password", async () => {
    const user = await seedUser();
    const { requestPasswordReset, consumeResetToken } = await lib();
    await requestPasswordReset(user.email);

    const outcome = await consumeResetToken(tokenFromLastMail(), "a-new-password");
    expect(outcome.ok).toBe(true);

    const { prisma } = await import("./db");
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).not.toBe("not-a-real-hash");
  });

  it("refuses the same token twice", async () => {
    const user = await seedUser();
    const { requestPasswordReset, consumeResetToken } = await lib();
    await requestPasswordReset(user.email);
    const token = tokenFromLastMail();

    expect((await consumeResetToken(token, "first-password")).ok).toBe(true);

    const second = await consumeResetToken(token, "second-password");
    expect(second.ok).toBe(false);
    expect(second).toMatchObject({ reason: "used" });
  });

  it("invalidates an earlier link when a new one is requested", async () => {
    const user = await seedUser();
    const { requestPasswordReset, consumeResetToken } = await lib();

    await requestPasswordReset(user.email);
    const first = tokenFromLastMail();

    await requestPasswordReset(user.email);
    const second = tokenFromLastMail();

    expect(first).not.toBe(second);
    expect((await consumeResetToken(first, "pw")).ok).toBe(false);
    expect((await consumeResetToken(second, "pw")).ok).toBe(true);
  });

  it("rejects an expired token", async () => {
    const user = await seedUser();
    const { requestPasswordReset, consumeResetToken } = await lib();
    await requestPasswordReset(user.email);
    const token = tokenFromLastMail();

    const { prisma } = await import("./db");
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect(await consumeResetToken(token, "pw")).toMatchObject({
      ok: false,
      reason: "expired",
    });
  });

  it("rejects a token that was never issued", async () => {
    const { consumeResetToken } = await lib();

    expect(await consumeResetToken("not-a-real-token", "pw")).toMatchObject({
      ok: false,
      reason: "invalid",
    });
  });

  it("inspects without spending", async () => {
    const user = await seedUser();
    const { requestPasswordReset, inspectResetToken, consumeResetToken } = await lib();
    await requestPasswordReset(user.email);
    const token = tokenFromLastMail();

    expect((await inspectResetToken(token)).ok).toBe(true);
    expect((await inspectResetToken(token)).ok).toBe(true);
    expect((await consumeResetToken(token, "pw")).ok).toBe(true);
  });

  it("matches the address case-insensitively", async () => {
    const user = await seedUser();
    const { requestPasswordReset } = await lib();

    await requestPasswordReset(user.email.toUpperCase());

    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
