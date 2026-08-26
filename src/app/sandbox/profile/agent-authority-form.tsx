"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { MAX_TILT_PCT } from "@/lib/sentiment-tilt";
import { saveAgentAuthority } from "./actions";
import { EMPTY_AUTHORITY_STATE } from "./form-state";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save agent settings"}
    </button>
  );
}

export function AgentAuthorityForm({
  initialTilt,
  initialAuto,
}: {
  initialTilt: number;
  initialAuto: boolean;
}) {
  const [state, formAction] = useActionState(
    saveAgentAuthority,
    EMPTY_AUTHORITY_STATE,
  );

  const [tilt, setTilt] = useState(initialTilt);
  const [auto, setAuto] = useState(initialAuto);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="autoRebalance"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="mt-1 size-4 accent-mint"
          />
          <span>
            <span className="block text-sm font-medium text-slate-100">
              Let the agents run unattended
            </span>
            <span className="mt-1 block text-sm text-slate-400">
              The scheduler checks your portfolio on its own and rebalances when
              your rules say it should. Turn this off and nothing moves unless
              you run a tick yourself.
            </span>
          </span>
        </label>
      </div>

      <div className="border-t border-white/5 pt-6">
        <label htmlFor="tilt" className="block text-sm font-medium text-slate-300">
          Sentiment authority
        </label>
        <p className="mt-1 text-sm text-slate-400">
          How far the agents may shift your targets based on what they read in
          the news, in percentage points. At <strong>0</strong> the news is
          reported but never moves money - that is the default, and the safe
          choice. Any tilt is still clamped to your exposure caps.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <input
            id="tilt-range"
            type="range"
            min={0}
            max={MAX_TILT_PCT}
            step={0.5}
            value={tilt}
            onChange={(e) => setTilt(Number(e.target.value))}
            aria-label="Sentiment authority in percentage points"
            className="flex-1 accent-mint"
          />
          <div className="flex items-center gap-1.5">
            <input
              id="tilt"
              name="sentimentTiltPct"
              type="number"
              min={0}
              max={MAX_TILT_PCT}
              step={0.5}
              value={tilt}
              onChange={(e) => setTilt(Number(e.target.value))}
              className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-right tabular-nums text-slate-100 outline-none focus:border-mint/60 focus:ring-2 focus:ring-mint/20"
            />
            <span className="text-sm text-slate-500">pts</span>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          {tilt === 0
            ? "Off - sentiment is logged on every tick but changes nothing."
            : `At maximum conviction the agents may move up to ${tilt} percentage points between your risk-on and risk-off buckets.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <SaveButton />
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
