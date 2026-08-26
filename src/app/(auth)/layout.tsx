import Link from "next/link";
import type { ReactNode } from "react";

import { BUCKETS } from "@/lib/buckets";
import { BUCKET_COLORS } from "@/lib/chart-palette";
import { PortfolioScene } from "@/components/portfolio-scene";

/**
 * Split layout: the form on one side, the product's behaviour on the other.
 *
 * The panel is not decoration for its own sake - it shows the thing the app
 * does. Round-ups drift out of position, the agent ticks, they are pulled back.
 * Someone who has never heard of Pipdrift can watch it once and understand the
 * pitch before they have typed anything.
 *
 * It is hidden below `lg`, where a sign-in screen should be the form and
 * nothing else.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lg:grid lg:min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12 lg:mx-0 lg:min-h-0 lg:max-w-none lg:px-16">
        <div className="w-full lg:max-w-md">
          <Link
            href="/"
            className="mb-8 block text-center text-lg font-semibold tracking-tight text-slate-50 lg:text-left"
          >
            Pipdrift
          </Link>
          {children}
        </div>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-white/10 bg-ink-soft lg:block">
        <div className="absolute inset-0">
          <PortfolioScene />
        </div>

        {/* Keeps the copy legible over whatever the simulation is doing. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-ink-soft via-ink-soft/80 to-transparent"
        />

        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md text-lg leading-relaxed text-slate-200">
            Three rings, one per bucket. Every particle is a round-up in orbit.
            They spread as the portfolio drifts - then the agent ticks, and the
            rings pull tight again.
          </p>

          <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
            {BUCKETS.map((bucket) => (
              <li key={bucket.id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: BUCKET_COLORS[bucket.id] }}
                />
                <span className="text-slate-300">{bucket.name}</span>
                <span className="font-mono text-xs text-slate-500">
                  {bucket.ticker}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
