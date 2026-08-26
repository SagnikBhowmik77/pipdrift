"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { BUCKETS, type BucketId } from "@/lib/buckets";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { saveExposureCaps } from "./actions";
import { EMPTY_EXPOSURE_FORM_STATE } from "./form-state";

export type Band = { minPct: number; maxPct: number; targetPct: number };

const NUMBER_CLASS =
  "w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right tabular-nums text-slate-100 outline-none focus:border-mint/60 focus:ring-2 focus:ring-mint/20";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save exposure caps"}
    </button>
  );
}

export function ExposureForm({ initial }: { initial: Record<BucketId, Band> }) {
  const [state, formAction] = useActionState(
    saveExposureCaps,
    EMPTY_EXPOSURE_FORM_STATE,
  );

  const [bands, setBands] = useState(initial);

  function setBand(id: BucketId, key: "minPct" | "maxPct", value: number) {
    setBands((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
  }

  // Mirror the server's rules so problems surface before a round-trip.
  const localErrors: Partial<Record<BucketId, string>> = {};
  for (const bucket of BUCKETS) {
    const b = bands[bucket.id];
    if (b.minPct > b.maxPct) {
      localErrors[bucket.id] = "Minimum cannot exceed maximum.";
    } else if (b.targetPct < b.minPct || b.targetPct > b.maxPct) {
      localErrors[bucket.id] = `Target is ${b.targetPct}% - widen the band or change the target first.`;
    }
  }

  const minSum = BUCKETS.reduce((s, b) => s + bands[b.id].minPct, 0);
  const maxSum = BUCKETS.reduce((s, b) => s + bands[b.id].maxPct, 0);

  const feasibilityError =
    minSum > 100
      ? `Minimums add up to ${minSum}% - no allocation can satisfy them all.`
      : maxSum < 100
        ? `Maximums only add up to ${maxSum}% - that leaves ${100 - maxSum}% with nowhere to go.`
        : null;

  const blocked =
    Object.keys(localErrors).length > 0 || feasibilityError !== null;

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4">
        {BUCKETS.map((bucket) => {
          const band = bands[bucket.id];
          const error = localErrors[bucket.id] ?? state.fieldErrors[bucket.id];

          return (
            <div
              key={bucket.id}
              className={`rounded-xl border px-4 py-4 ${
                error ? "border-rose-500/40 bg-rose-500/5" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: BUCKET_COLORS[bucket.id] }}
                  />
                  {bucket.name}
                  <span className="font-mono text-xs text-slate-500">
                    {bucket.ticker}
                  </span>
                  <span className="text-xs text-slate-500">
                    target {band.targetPct}%
                  </span>
                </span>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`min-${bucket.id}`}
                      className="text-xs uppercase tracking-wide text-slate-500"
                    >
                      Min
                    </label>
                    <input
                      id={`min-${bucket.id}`}
                      name={`min-${bucket.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={band.minPct}
                      onChange={(e) =>
                        setBand(bucket.id, "minPct", Number(e.target.value))
                      }
                      aria-invalid={Boolean(error)}
                      className={NUMBER_CLASS}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`max-${bucket.id}`}
                      className="text-xs uppercase tracking-wide text-slate-500"
                    >
                      Max
                    </label>
                    <input
                      id={`max-${bucket.id}`}
                      name={`max-${bucket.id}`}
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={band.maxPct}
                      onChange={(e) =>
                        setBand(bucket.id, "maxPct", Number(e.target.value))
                      }
                      aria-invalid={Boolean(error)}
                      className={NUMBER_CLASS}
                    />
                  </div>
                </div>
              </div>

              {/* The band drawn against the full 0-100 range, with the target
                  marked, so an impossible setup is visible not just stated. */}
              <div
                aria-hidden
                className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/5"
              >
                <div
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${Math.min(band.minPct, 100)}%`,
                    width: `${Math.max(0, Math.min(band.maxPct, 100) - Math.min(band.minPct, 100))}%`,
                    background: BUCKET_COLORS[bucket.id],
                    opacity: 0.45,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-slate-100"
                  style={{ left: `${Math.min(band.targetPct, 100)}%` }}
                />
              </div>

              {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          feasibilityError
            ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
            : "border-mint/20 bg-mint/5 text-slate-400"
        }`}
      >
        {feasibilityError ?? (
          <>
            Minimums total{" "}
            <span className="tabular-nums text-slate-200">{minSum}%</span>,
            maximums total{" "}
            <span className="tabular-nums text-slate-200">{maxSum}%</span> - a
            100% allocation fits inside these bands.
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SaveButton disabled={blocked} />
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
