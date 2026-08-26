"use server";

import { AuthError } from "next-auth";
import { unstable_rethrow } from "next/navigation";

import { signIn } from "@/lib/auth";
import { BUCKETS } from "@/lib/buckets";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { consumeRateLimit, RULES } from "@/lib/rate-limit";
import { DEFAULT_RISK_PROFILE, getRiskProfile } from "@/lib/risk-profiles";
import type { AuthFormState } from "./form-state";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerUser(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  const errors: AuthFormState["errors"] = {};

  if (!EMAIL_PATTERN.test(email)) errors.email = "Enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `That password is too short - use ${MIN_PASSWORD_LENGTH} characters or more.`;
  }
  if (name.length > 60) errors.name = "Keep it under 60 characters.";

  if (Object.keys(errors).length > 0) return { status: "error", errors };

  // Signup writes a user and three bucket rows, so an unbounded form is a way
  // to fill the database from a loop. Checked after validation so malformed
  // submissions do not consume anyone's allowance.
  const limit = await consumeRateLimit(`signup:${email}`, RULES.signup);

  if (!limit.allowed) {
    return {
      status: "error",
      errors: { form: "Too many attempts for that address. Try again later." },
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      status: "error",
      errors: { email: "An account with that email already exists." },
    };
  }

  const profile = getRiskProfile(DEFAULT_RISK_PROFILE);

  // The account and its three buckets are created together - a user without
  // buckets would break every drift calculation downstream.
  await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password),
      riskProfile: profile.id,
      buckets: {
        create: BUCKETS.map((bucket) => ({
          bucketId: bucket.id,
          targetPct: profile.targets[bucket.id],
        })),
      },
    },
  });

  return signInWithCredentials(email, password);
}

export async function loginUser(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      status: "error",
      errors: { form: "Enter your email and password." },
    };
  }

  // Per address, before any hash comparison: without this the form is an
  // online password guesser bounded only by network speed.
  const limit = await consumeRateLimit(`login:${email}`, RULES.login);

  if (!limit.allowed) {
    return {
      status: "error",
      errors: {
        form: "Too many sign-in attempts. Try again in a few minutes.",
      },
    };
  }

  return signInWithCredentials(email, password);
}

async function signInWithCredentials(
  email: string,
  password: string,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", { email, password, redirectTo: "/sandbox" });
  } catch (error) {
    // signIn signals success by throwing a redirect - that must propagate.
    unstable_rethrow(error);

    if (error instanceof AuthError) {
      return {
        status: "error",
        errors: { form: "That email and password do not match an account." },
      };
    }
    throw error;
  }

  return { status: "idle", errors: {} };
}
