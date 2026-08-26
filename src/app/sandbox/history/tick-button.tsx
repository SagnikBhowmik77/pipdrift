"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TickResponse = {
  ok: boolean;
  rebalanced?: boolean;
  reason?: string;
  events?: unknown[];
  error?: string;
};

/** Drives /api/rebalance by hand, so the endpoint is exercisable from the UI. */
export function RebalanceTickButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runTick() {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rebalance", { method: "POST" });
      const data = (await response.json()) as TickResponse;

      if (!response.ok || !data.ok) {
        setMessage(data.error ?? "Tick failed.");
        return;
      }

      setMessage(
        data.rebalanced
          ? `Rebalanced - ${data.events?.length ?? 0} event(s) written.`
          : (data.reason ?? "No drift breach."),
      );
      router.refresh();
    } catch {
      setMessage("Could not reach the rebalance endpoint.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={runTick}
        disabled={pending}
        className="rounded-xl bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Running tick…" : "Run rebalance tick"}
      </button>
      {message && (
        <p role="status" className="mt-2 max-w-xs text-sm text-slate-400">
          {message}
        </p>
      )}
    </div>
  );
}
