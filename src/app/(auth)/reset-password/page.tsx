import Link from "next/link";

import { inspectResetToken } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password · Pipdrift" };

// The token is checked against the database on every render, so this page can
// never be statically cached.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const outcome = token ? await inspectResetToken(token) : null;

  if (!token || !outcome?.ok) {
    const reason =
      outcome && !outcome.ok
        ? outcome.reason === "expired"
          ? "That link has expired."
          : outcome.reason === "used"
            ? "That link has already been used."
            : "That link is not valid."
        : "That link is missing its token.";

    return (
      <main>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-50">
          Link no longer works
        </h1>
        <p className="mb-7 text-slate-400">
          {reason} Reset links work once and expire after an hour.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full rounded-xl bg-mint px-5 py-3.5 text-center text-base font-semibold text-ink transition hover:bg-mint-bright"
        >
          Request a new link
        </Link>
      </main>
    );
  }

  return (
    <main>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-slate-50">
        Choose a new password
      </h1>
      <p className="mb-7 text-slate-400">
        Then sign in with it. Any other reset links stop working.
      </p>
      <ResetForm token={token} />
    </main>
  );
}
