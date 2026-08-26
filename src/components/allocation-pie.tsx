"use client";

import { useId, useState } from "react";

import type { BucketId } from "@/lib/buckets";
import { BUCKET_COLORS, CHART_SURFACE } from "@/lib/chart-palette";
import { formatPaise } from "@/lib/currency";

export type Slice = {
  bucketId: BucketId;
  name: string;
  ticker: string;
  balancePaise: number;
  currentPct: number;
  targetPct: number;
};

const SIZE = 220;
const RADIUS = 100;
const CENTER = SIZE / 2;

/**
 * Math.cos/Math.sin are not bit-identical across JS engines, so the server and
 * the browser can disagree in the last decimal places. That difference lands in
 * the `d` attribute and React reports a hydration mismatch - quantising the
 * coordinates makes both sides emit the same string. Three decimals is far
 * finer than a 220px viewBox can show.
 */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Polar → cartesian with 12 o'clock as 0°, which is where a pie should start. */
function pointOnCircle(angleDeg: number, radius: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: round(CENTER + radius * Math.cos(radians)),
    y: round(CENTER + radius * Math.sin(radians)),
  };
}

function arcPath(startDeg: number, endDeg: number): string {
  const start = pointOnCircle(startDeg, RADIUS);
  const end = pointOnCircle(endDeg, RADIUS);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${CENTER} ${CENTER}`,
    `L ${start.x} ${start.y}`,
    `A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

/** One string - React rejects an array of children inside <title>. */
function describeAllocation(funded: Slice[]): string {
  const parts = funded.map((s) => `${s.name} ${s.currentPct.toFixed(1)}%`);
  return `Portfolio allocation by bucket. ${parts.join(", ")}.`;
}

export function AllocationPie({ slices }: { slices: Slice[] }) {
  const [hovered, setHovered] = useState<BucketId | null>(null);
  const titleId = useId();

  const total = slices.reduce((sum, s) => sum + s.balancePaise, 0);
  const funded = slices.filter((s) => s.balancePaise > 0);

  // A lone funded bucket is a full circle - an arc from 0° to 360° collapses to
  // a zero-length path and renders nothing.
  const isSingleSlice = funded.length === 1;

  let cursor = 0;
  const wedges = funded.map((slice) => {
    const sweep = (slice.balancePaise / total) * 360;
    const wedge = { slice, start: cursor, end: cursor + sweep };
    cursor += sweep;
    return wedge;
  });

  const active = hovered ? slices.find((s) => s.bucketId === hovered) : null;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-labelledby={titleId}
          className="max-w-full"
        >
          <title id={titleId}>{describeAllocation(funded)}</title>

          {isSingleSlice ? (
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill={BUCKET_COLORS[funded[0].bucketId]}
              stroke={CHART_SURFACE}
              strokeWidth={2}
            />
          ) : (
            wedges.map(({ slice, start, end }) => (
              <path
                key={slice.bucketId}
                d={arcPath(start, end)}
                fill={BUCKET_COLORS[slice.bucketId]}
                stroke={CHART_SURFACE}
                strokeWidth={2}
                opacity={hovered && hovered !== slice.bucketId ? 0.45 : 1}
                onMouseEnter={() => setHovered(slice.bucketId)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-default transition-opacity"
              />
            ))
          )}
        </svg>

        {active && (
          <div className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center">
            <span className="rounded-lg border border-white/10 bg-ink px-3 py-1.5 text-xs text-slate-200 shadow-lg">
              {active.name} · {formatPaise(active.balancePaise)} ·{" "}
              {active.currentPct.toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Doubles as the legend and the table view: identity is never carried by
          color alone, and every value is readable without hovering.

          The scroller matters on a phone: four numeric columns cannot compress
          below their content, and without this the whole page scrolls sideways
          instead of the table. */}
      <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[288px] text-sm">
        <caption className="sr-only">
          Bucket allocation: current share, target share, and balance
        </caption>
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th scope="col" className="pb-2 font-medium">
              Bucket
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Now
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Target
            </th>
            <th scope="col" className="pb-2 text-right font-medium">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr
              key={slice.bucketId}
              onMouseEnter={() => setHovered(slice.bucketId)}
              onMouseLeave={() => setHovered(null)}
              className="border-t border-white/5"
            >
              <th scope="row" className="py-2.5 pr-3 font-normal">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: BUCKET_COLORS[slice.bucketId] }}
                  />
                  <span className="text-slate-200">{slice.name}</span>
                  <span className="font-mono text-xs text-slate-500">
                    {slice.ticker}
                  </span>
                </span>
              </th>
              <td className="py-2.5 text-right tabular-nums text-slate-100">
                {slice.currentPct.toFixed(1)}%
              </td>
              <td className="py-2.5 text-right tabular-nums text-slate-400">
                {slice.targetPct.toFixed(0)}%
              </td>
              <td className="py-2.5 text-right tabular-nums text-slate-100">
                {formatPaise(slice.balancePaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
