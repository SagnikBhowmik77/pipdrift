import Link from "next/link";
import type { ReactNode } from "react";

import { SignOutButton } from "./sign-out-button";
import { PaperBadge, TradingDisclosure } from "./trading-disclosure";

/**
 * Shared chrome + card primitives for every /sandbox page.
 *
 * Layout is a persistent sidebar plus a fluid content column. The previous
 * version centred everything inside `max-w-4xl`, which on a 1440px display left
 * roughly 270px of dead space down each side and made a dashboard read like a
 * blog post. A tool that is returned to daily should use the width it is given
 * and keep navigation in the same place on every screen.
 *
 * Below `lg` the sidebar becomes a horizontal bar, because a fixed rail on a
 * phone costs more than it returns.
 */

const NAV: { href: string; label: string; group: string }[] = [
  { href: "/sandbox", label: "Portfolio", group: "Money" },
  { href: "/sandbox/new", label: "Log purchase", group: "Money" },
  { href: "/sandbox/history", label: "History", group: "Money" },
  { href: "/sandbox/buckets", label: "Buckets", group: "Strategy" },
  { href: "/sandbox/buckets/exposure", label: "Exposure caps", group: "Strategy" },
  { href: "/sandbox/profile", label: "Risk profile", group: "Strategy" },
  { href: "/sandbox/signals", label: "Signals", group: "Agents" },
  { href: "/docs/agents", label: "Docs", group: "Agents" },
];

const GROUPS = ["Money", "Strategy", "Agents"] as const;

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "relative block rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-mint/10 font-medium text-mint"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
      ].join(" ")}
    >
      {/* The active marker is a rail, not a background fill: it survives being
          scanned quickly down a column of similar labels. */}
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-mint"
        />
      )}
      {label}
    </Link>
  );
}

export function DashboardShell({
  title,
  subtitle,
  active,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  active?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-white/10 bg-ink-soft/50 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col gap-6 px-4 py-4 lg:px-5 lg:py-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="font-semibold tracking-tight text-slate-50"
            >
              Pipdrift
            </Link>
            <PaperBadge />
          </div>

          <nav className="flex flex-wrap gap-x-1 gap-y-1 lg:flex-1 lg:flex-col lg:flex-nowrap lg:gap-y-6">
            {GROUPS.map((group) => (
              <div key={group} className="lg:w-full">
                <p className="hidden px-3 pb-1.5 text-xs font-medium text-slate-600 lg:block">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1 lg:block lg:space-y-0.5">
                  {NAV.filter((item) => item.group === group).map((item) => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={active === item.href}
                    />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="hidden lg:block">
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4 lg:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-50 lg:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-0.5 truncate text-sm text-slate-400">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <span className="lg:hidden">
                <SignOutButton />
              </span>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        <TradingDisclosure />
      </div>
    </div>
  );
}

/**
 * Surface primitive. `bg-white/[0.04]` over the ink ground rather than a solid
 * fill - a card that is a lighter shade of the page reads as raised without
 * needing a heavy border.
 */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function CardTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-medium text-slate-300">{children}</h2>
      {aside}
    </div>
  );
}

/**
 * A number worth reading at a glance.
 *
 * `tone` colours the trend line only - never the figure itself, so the value
 * stays legible and the judgement about it stays visibly separate.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const hintTone =
    tone === "positive"
      ? "text-mint"
      : tone === "negative"
        ? "text-rose-400"
        : "text-slate-500";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1.5 text-[28px] font-medium leading-tight tabular-nums tracking-[-0.02em] text-slate-50">
        {value}
      </p>
      {hint && <p className={`mt-1.5 text-sm ${hintTone}`}>{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-6 py-12 text-center">
      <p className="font-medium text-slate-200">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-block rounded-lg bg-mint px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-mint-bright"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-mint px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mint-bright"
    >
      {children}
    </Link>
  );
}
