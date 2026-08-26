"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { BUCKETS, type BucketId } from "@/lib/buckets";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { saveBucketConfig } from "./actions";
import { EMPTY_BUCKET_FORM_STATE } from "./form-state";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save targets"}
    </button>
  );
}

export function BucketForm({
  initialTargets,
  initialThreshold,
}: {
  initialTargets: Record<BucketId, number>;
  initialThreshold: number;
}) {
  const [state, formAction] = useActionState(
    saveBucketConfig,
    EMPTY_BUCKET_FORM_STATE,
  );

  const [targets, setTargets] = useState<Record<BucketId, number>>(initialTargets);
  const [threshold, setThreshold] = useState(initialThreshold);

  // Mirrors the server's rule so the user sees the problem before submitting,
  // not after a round-trip.
  const sum = BUCKETS.reduce((total, b) => total + targets[b.id], 0);
  const sumIsValid = sum === 100;

  function setTarget(id: BucketId, value: number) {
    setTargets((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-5">
        {BUCKETS.map((bucket) => (
          <div key={bucket.id}>
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor={`target-${bucket.id}`}
                className="flex items-center gap-2 text-sm text-slate-200"
              >
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: BUCKET_COLORS[bucket.id] }}
                />
                {bucket.name}
                <span className="font-mono text-xs text-slate-500">
                  {bucket.ticker}
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                <input
                  id={`target-${bucket.id}`}
                  name={`target-${bucket.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={targets[bucket.id]}
                  onChange={(e) => setTarget(bucket.id, Number(e.target.value))}
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right tabular-nums text-slate-100 outline-none focus:border-mint/60 focus:ring-2 focus:ring-mint/20"
                />
                <span className="text-sm text-slate-500">%</span>
              </div>
            </div>

            {/* The slider and the number box drive the same state, so either
                one can be used and both always agree. */}
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={targets[bucket.id]}
              onChange={(e) => setTarget(bucket.id, Number(e.target.value))}
              aria-label={`${bucket.name} target percentage`}
              className="mt-3 w-full accent-mint"
              style={{ accentColor: BUCKET_COLORS[bucket.id] }}
            />
          </div>
        ))}
      </div>

      <div
        className={`flex items-baseline justify-between rounded-xl border px-4 py-3 ${
          sumIsValid
            ? "border-mint/20 bg-mint/5"
            : "border-amber-500/30 bg-amber-500/5"
        }`}
      >
        <span className="text-sm text-slate-400">Total allocation</span>
        <span
          className={`font-semibold tabular-nums ${
            sumIsValid ? "text-mint" : "text-amber-400"
          }`}
        >
          {sum}% {sumIsValid ? "" : "- must be 100%"}
        </span>
      </div>

      <div>
        <label
          htmlFor="threshold"
          className="block text-sm font-medium text-slate-300"
        >
          Rebalance drift threshold
        </label>
        <p className="mt-1 text-sm text-slate-500">
          Agents rebalance once any bucket sits this many percentage points away
          from its target. This is the value{" "}
          <code className="font-mono text-xs text-slate-400">/api/rebalance</code>{" "}
          compares against.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Drift threshold in percentage points"
            className="flex-1 accent-mint"
          />
          <div className="flex items-center gap-1.5">
            <input
              id="threshold"
              name="threshold"
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right tabular-nums text-slate-100 outline-none focus:border-mint/60 focus:ring-2 focus:ring-mint/20"
            />
            <span className="text-sm text-slate-500">%</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SaveButton disabled={!sumIsValid} />
        {state.message && (
          <p
            role="status"
            className={`text-sm ${
              state.status === "error" ? "text-rose-400" : "text-mint"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
