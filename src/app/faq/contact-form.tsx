"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { sendContactMessage } from "@/lib/enquiries";
import { EMPTY_ENQUIRY_STATE } from "@/lib/enquiry-state";

const FIELD_CLASS =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-mint/60 focus:ring-2 focus:ring-mint/20";

function SendButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-mint px-5 py-3 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send question"}
    </button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(
    sendContactMessage,
    EMPTY_ENQUIRY_STATE,
  );

  if (state.status === "success") {
    return (
      <p role="status" className="mt-5 text-sm font-medium text-mint">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-5 space-y-3" noValidate>
      <div>
        <label htmlFor="contact-email" className="sr-only">
          Your email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={state.status === "error"}
          className={FIELD_CLASS}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="sr-only">
          Your question
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          maxLength={1000}
          placeholder="What would you like to know?"
          className={`${FIELD_CLASS} resize-y`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SendButton />
        {state.status === "error" && (
          <p role="alert" className="text-sm text-rose-400">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
