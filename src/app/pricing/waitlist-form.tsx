"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { joinWaitlist } from "@/lib/enquiries";
import { EMPTY_ENQUIRY_STATE } from "@/lib/enquiry-state";

function JoinButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Adding…" : "Join waitlist"}
    </button>
  );
}

export function WaitlistForm() {
  const [state, formAction] = useActionState(joinWaitlist, EMPTY_ENQUIRY_STATE);

  if (state.status === "success") {
    return (
      <p role="status" className="mt-5 text-sm font-medium text-mint">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-5 space-y-3" noValidate>
      <div className="flex flex-wrap gap-3">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={state.status === "error"}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-mint/60 focus:ring-2 focus:ring-mint/20"
        />
        <JoinButton />
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-rose-400">
          {state.message}
        </p>
      )}
    </form>
  );
}
