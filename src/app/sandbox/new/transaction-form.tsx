"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { BUCKETS, DEFAULT_BUCKET } from "@/lib/buckets";
import { CATEGORIES } from "@/lib/categories";
import { formatPaise, parseAmountToPaise, roundUpPaise } from "@/lib/currency";
import { createTransaction } from "./actions";
import { EMPTY_FORM_STATE, type Receipt } from "./form-state";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-mint px-5 py-3.5 text-base font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Investing spare change…" : "Round up & invest"}
    </button>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-sm text-rose-400">{message}</p>;
}

/**
 * Live preview of the round-up. The same pure helpers run here and in the
 * server action, so what the user sees before submitting is exactly what gets
 * credited to the bucket.
 */
function RoundUpPreview({ amount }: { amount: string }) {
  const paise = parseAmountToPaise(amount);

  if (paise === null || paise === 0) {
    return (
      <p className="text-sm text-slate-400">
        Enter a purchase amount to see the spare change.
      </p>
    );
  }

  const spare = roundUpPaise(paise);

  if (spare === 0) {
    return (
      <p className="text-sm text-slate-400">
        {formatPaise(paise)} already lands on a whole rupee - no spare change to
        invest.
      </p>
    );
  }

  return (
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-sm text-slate-400">
        {formatPaise(paise)} rounds up to {formatPaise(paise + spare)}
      </p>
      <p className="text-2xl font-semibold tabular-nums text-mint">
        +{formatPaise(spare)}
      </p>
    </div>
  );
}

/** Post-submit confirmation: what was taken, where it went, what it holds now. */
function ConfirmationPanel({
  receipt,
  onLogAnother,
}: {
  receipt: Receipt;
  onLogAnother: () => void;
}) {
  const rows = [
    {
      label: "Round-up invested",
      value: `+${formatPaise(receipt.roundUpPaise)}`,
      accent: true,
    },
    {
      label: "Credited to",
      value: `${receipt.bucketName} · ${receipt.bucketTicker}`,
      accent: false,
    },
    {
      label: `New ${receipt.bucketName} balance`,
      value: formatPaise(receipt.newBucketBalancePaise),
      accent: false,
    },
    {
      label: "Portfolio total",
      value: formatPaise(receipt.newTotalPaise),
      accent: false,
    },
  ];

  return (
    <div role="status" className="rounded-2xl border border-mint/30 bg-mint/5 p-6">
      <p className="text-sm text-slate-400">
        {receipt.merchant} · {formatPaise(receipt.amountPaise)} rounded up to{" "}
        {formatPaise(receipt.amountPaise + receipt.roundUpPaise)}
      </p>

      <dl className="mt-5 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-sm text-slate-400">{row.label}</dt>
            <dd
              className={
                row.accent
                  ? "text-xl font-semibold tabular-nums text-mint"
                  : "font-medium tabular-nums text-slate-100"
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onLogAnother}
          className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright"
        >
          Log another
        </button>
        <Link
          href="/sandbox"
          className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/30"
        >
          View portfolio
        </Link>
      </div>
    </div>
  );
}

export function TransactionForm() {
  const [state, formAction] = useActionState(createTransaction, EMPTY_FORM_STATE);
  const [amount, setAmount] = useState("");

  // useActionState has no reset, so "Log another" records which receipt was
  // dismissed. Bumping the form key alongside it remounts the uncontrolled
  // fields, giving a genuinely blank form instead of the previous values.
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const showReceipt =
    state.status === "success" && dismissedId !== state.receipt.transactionId;

  const labelClass = "block text-sm font-medium text-slate-300";
  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-mint/60 focus:ring-2 focus:ring-mint/20";

  if (showReceipt && state.status === "success") {
    return (
      <ConfirmationPanel
        receipt={state.receipt}
        onLogAnother={() => {
          setAmount("");
          setDismissedId(state.receipt.transactionId);
        }}
      />
    );
  }

  return (
    <form
      key={dismissedId ?? "new"}
      action={formAction}
      className="space-y-6"
      noValidate
    >
      <div>
        <label htmlFor="merchant" className={labelClass}>
          Merchant
        </label>
        <input
          id="merchant"
          name="merchant"
          type="text"
          maxLength={60}
          placeholder="Chai Point"
          autoComplete="off"
          aria-invalid={Boolean(state.errors.merchant)}
          className={inputClass}
        />
        <FieldError message={state.errors.merchant} />
      </div>

      <div>
        <label htmlFor="amount" className={labelClass}>
          Amount
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 pt-0.5 text-base text-slate-500">
            ₹
          </span>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="128.40"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-invalid={Boolean(state.errors.amount)}
            className={`${inputClass} pl-8 tabular-nums`}
          />
        </div>
        <FieldError message={state.errors.amount} />
      </div>

      <div className="rounded-xl border border-mint/20 bg-mint/5 px-4 py-3.5">
        <RoundUpPreview amount={amount} />
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={CATEGORIES[0]}
          aria-invalid={Boolean(state.errors.category)}
          className={inputClass}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category} className="bg-ink">
              {category}
            </option>
          ))}
        </select>
        <FieldError message={state.errors.category} />
      </div>

      <fieldset>
        <legend className={labelClass}>Send the spare change to</legend>
        <div className="mt-2 space-y-2">
          {BUCKETS.map((bucket) => (
            <label
              key={bucket.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/20 has-checked:border-mint/60 has-checked:bg-mint/10"
            >
              <input
                type="radio"
                name="bucket"
                value={bucket.id}
                defaultChecked={bucket.id === DEFAULT_BUCKET}
                className="mt-1 size-4 accent-mint"
              />
              <span>
                <span className="block text-sm font-medium text-slate-100">
                  {bucket.name}{" "}
                  <span className="font-mono text-xs text-slate-400">
                    {bucket.ticker}
                  </span>
                </span>
                <span className="block text-sm text-slate-400">{bucket.blurb}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={state.errors.bucket} />
      </fieldset>

      <SubmitButton />
    </form>
  );
}
