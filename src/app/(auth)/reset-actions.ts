"use server";

import { redirect } from "next/navigation";

import { activeTransport } from "@/lib/mailer";
import { consumeRateLimit, RULES } from "@/lib/rate-limit";
import {
  consumeResetToken,
  requestPasswordReset,
} from "@/lib/password-reset";
import type { ForgotFormState, ResetFormState } from "./reset-state";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Always reports success.
 *
 * Telling the user "no account with that address" would turn this form into a
 * membership oracle for anyone with a list of emails. The work happens either
 * way; the response does not vary.
 */
export async function requestReset(
  _prev: ForgotFormState,
  formData: FormData,
): Promise<ForgotFormState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", errors: { email: "Enter a valid email address." } };
  }

  // Per address: this endpoint sends mail, so an unlimited one is a free inbox
  // flood and a way to burn the mail quota. The limit is applied before any
  // send and regardless of whether the account exists, so it cannot be probed
  // to tell the two cases apart.
  const limit = await consumeRateLimit(
    `reset:${email.toLowerCase()}`,
    RULES.passwordReset,
  );

  if (!limit.allowed) {
    return {
      status: "error",
      errors: {
        form: "Too many reset requests for that address. Try again later.",
      },
    };
  }

  try {
    await requestPasswordReset(email);
  } catch (error) {
    console.error("[auth] password reset request failed", error);
    return {
      status: "error",
      errors: { form: "Could not start a reset just now. Try again shortly." },
    };
  }

  // With no mail provider configured the link only reached the server log,
  // which a user cannot read. Say so rather than claiming an email went out.
  return {
    status: "sent",
    errors: {},
    ...(activeTransport() === "console"
      ? { devLink: "check the server console for the reset link" }
      : {}),
  };
}

export async function submitReset(
  _prev: ResetFormState,
  formData: FormData,
): Promise<ResetFormState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      status: "error",
      errors: {
        password: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
    };
  }

  if (password !== confirm) {
    return { status: "error", errors: { confirm: "Both entries must match." } };
  }

  const outcome = await consumeResetToken(token, password);

  if (!outcome.ok) {
    const message =
      outcome.reason === "expired"
        ? "That link has expired. Request a new one."
        : outcome.reason === "used"
          ? "That link has already been used. Request a new one."
          : "That link is not valid. Request a new one.";

    return { status: "error", errors: { form: message } };
  }

  redirect("/login?reset=1");
}
