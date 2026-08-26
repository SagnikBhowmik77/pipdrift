"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { submitReset } from "../reset-actions";
import { EMPTY_RESET_STATE } from "../reset-state";

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
      {pending ? "Saving…" : "Set new password"}
    </button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(submitReset, EMPTY_RESET_STATE);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.errors.form && (
        <p
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
        >
          {state.errors.form}{" "}
          <Link href="/forgot-password" className="underline">
            Request a new link
          </Link>
          .
        </p>
      )}

      <div>
        <label htmlFor="password" className={LABEL_CLASS}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.errors.password)}
          className={INPUT_CLASS}
        />
        {state.errors.password && (
          <p className="mt-1.5 text-sm text-rose-400">{state.errors.password}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirm" className={LABEL_CLASS}>
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.errors.confirm)}
          className={INPUT_CLASS}
        />
        {state.errors.confirm && (
          <p className="mt-1.5 text-sm text-rose-400">{state.errors.confirm}</p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
