"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { loginUser, registerUser } from "./actions";
import { EMPTY_AUTH_FORM_STATE } from "./form-state";

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-mint/60 focus:ring-2 focus:ring-mint/20";
const LABEL_CLASS = "block text-sm font-medium text-slate-300";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-mint px-5 py-3.5 text-base font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-rose-400">{message}</p>;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [state, formAction] = useActionState(
    isSignup ? registerUser : loginUser,
    EMPTY_AUTH_FORM_STATE,
  );

  // React 19 resets uncontrolled fields once a form action completes, so a
  // validation error would otherwise wipe everything the user typed. Holding
  // the non-secret fields in state keeps them across a failed attempt; the
  // password is deliberately left to clear.
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.errors.form && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {state.errors.form}
        </p>
      )}

      {isSignup && (
        <div>
          <label htmlFor="name" className={LABEL_CLASS}>
            Name <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={60}
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={INPUT_CLASS}
          />
          <FieldError message={state.errors.name} />
        </div>
      )}

      <div>
        <label htmlFor="email" className={LABEL_CLASS}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(state.errors.email)}
          className={INPUT_CLASS}
        />
        <FieldError message={state.errors.email} />
      </div>

      <div>
        <label htmlFor="password" className={LABEL_CLASS}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          aria-invalid={Boolean(state.errors.password)}
          className={INPUT_CLASS}
        />
        <FieldError message={state.errors.password} />
        {isSignup && !state.errors.password && (
          <p className="mt-1.5 text-sm text-slate-500">At least 8 characters.</p>
        )}
        {!isSignup && (
          <p className="mt-2 text-right text-sm">
            <Link
              href="/forgot-password"
              className="text-slate-400 underline-offset-4 transition hover:text-slate-200 hover:underline"
            >
              Forgot your password?
            </Link>
          </p>
        )}
      </div>

      <SubmitButton
        label={isSignup ? "Create account" : "Sign in"}
        pendingLabel={isSignup ? "Creating account…" : "Signing in…"}
      />

      <p className="text-center text-sm text-slate-400">
        {isSignup ? "Already have an account? " : "New to Pipdrift? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="text-mint underline-offset-4 hover:underline"
        >
          {isSignup ? "Sign in" : "Create one"}
        </Link>
      </p>
    </form>
  );
}
