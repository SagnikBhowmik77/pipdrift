"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { requestReset } from "../reset-actions";
import { EMPTY_FORGOT_STATE } from "../reset-state";

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-mint/60 focus:ring-2 focus:ring-mint/20";
const LABEL_CLASS = "block text-sm font-medium text-slate-300";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-mint px-5 py-3.5 text-base font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export function ForgotForm() {
  const [state, formAction] = useActionState(requestReset, EMPTY_FORGOT_STATE);
  const [email, setEmail] = useState("");

  if (state.status === "sent") {
    return (
      <div className="space-y-5">
        <p
          role="status"
          className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3.5 text-sm text-slate-200"
        >
          If an account exists for that address, a reset link is on its way. It
          works once and expires in an hour.
        </p>

        {state.devLink && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            No mail provider is configured on this deployment, so nothing was
            actually emailed - {state.devLink}.
          </p>
        )}

        <Link
          href="/login"
          className="block text-center text-sm text-slate-400 transition hover:text-slate-200"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

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
        {state.errors.email && (
          <p className="mt-1.5 text-sm text-rose-400">{state.errors.email}</p>
        )}
      </div>

      <SubmitButton />

      <Link
        href="/login"
        className="block text-center text-sm text-slate-400 transition hover:text-slate-200"
      >
        Back to sign in
      </Link>
    </form>
  );
}
