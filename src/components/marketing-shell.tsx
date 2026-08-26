import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chrome for the public marketing pages (/pricing, /faq). Same surfaces, type
 * scale, and spacing as the dashboard shell, but with the signed-out nav -
 * these pages are read before anyone has an account.
 */

const NAV = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/docs/agents", label: "Docs" },
] as const;

export function MarketingShell({
  title,
  subtitle,
  active,
  children,
}: {
  title: string;
  subtitle?: string;
  active?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-ink-soft/60">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-4">
          <Link href="/" className="font-semibold tracking-tight text-slate-50">
            Pipdrift
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={
                  active === item.href
                    ? "text-mint"
                    : "text-slate-400 transition hover:text-slate-200"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/sandbox"
            className="ml-auto rounded-xl bg-mint px-4 py-2 text-sm font-semibold text-ink transition hover:bg-mint-bright"
          >
            Open sandbox
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-50">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-lg text-slate-400">{subtitle}</p>
          )}
        </div>
        {children}
      </main>

      <footer className="mx-auto w-full max-w-4xl border-t border-white/10 px-5 py-8 text-sm text-slate-500">
        Pipdrift is a sandbox. Balances are a ledger, no orders are placed, and
        nothing here is investment advice.
      </footer>
    </div>
  );
}
