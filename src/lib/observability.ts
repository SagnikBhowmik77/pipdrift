import "server-only";

/**
 * Error reporting with somewhere to go.
 *
 * A scheduled tick that throws in production writes to a log nobody reads, and
 * the first sign of trouble becomes a user noticing their portfolio stopped
 * moving. This gives failures a destination without committing the project to
 * a vendor: set ERROR_WEBHOOK_URL and every report is POSTed there (Sentry,
 * Slack, Discord, your own endpoint all accept JSON); set nothing and reports
 * are printed as structured single-line JSON, which is what log aggregators
 * want anyway.
 *
 * Reporting must never itself throw. A failure here would mask the original
 * error, which is the one thing an error reporter must not do.
 */

export type ErrorContext = Record<string, string | number | boolean | null>;

export type ErrorReport = {
  at: string;
  scope: string;
  message: string;
  stack?: string;
  context?: ErrorContext;
};

const TIMEOUT_MS = 5_000;

function toReport(
  scope: string,
  error: unknown,
  context?: ErrorContext,
): ErrorReport {
  const base = {
    at: new Date().toISOString(),
    scope,
    ...(context ? { context } : {}),
  };

  if (error instanceof Error) {
    return { ...base, message: error.message, stack: error.stack };
  }

  return { ...base, message: String(error) };
}

async function deliver(report: ErrorReport): Promise<void> {
  const url = process.env.ERROR_WEBHOOK_URL;

  if (!url) {
    // Single-line JSON: greppable, and parseable by any log pipeline.
    console.error(`[error] ${JSON.stringify(report)}`);
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (deliveryError) {
    // Fall back to the console so the original error is never lost because the
    // reporting channel was down.
    console.error(`[error] ${JSON.stringify(report)}`);
    console.error("[error] webhook delivery failed", deliveryError);
  }
}

/** Records a failure. Never throws, never rejects. */
export async function reportError(
  scope: string,
  error: unknown,
  context?: ErrorContext,
): Promise<void> {
  try {
    await deliver(toReport(scope, error, context));
  } catch {
    // Deliberately silent: nothing useful is left to do, and rethrowing here
    // would replace the caller's error with this one.
  }
}

/** True when reports leave the process rather than only hitting the console. */
export function hasErrorSink(): boolean {
  return Boolean(process.env.ERROR_WEBHOOK_URL);
}
