import "server-only";

/**
 * Outbound email, with a delivery path that always exists.
 *
 * A password reset is useless if sending is optional, but a side project has no
 * mail provider on day one. So there are three transports and the choice is
 * made from the environment:
 *
 *   RESEND_API_KEY  -> Resend's HTTP API (no SMTP library needed)
 *   MAIL_WEBHOOK_URL -> POST the message anywhere (Zapier, n8n, your own relay)
 *   neither          -> log it to the server console
 *
 * The console transport is not a stub that silently swallows mail: it prints
 * the full reset link, which makes local development and self-hosting work
 * without an account anywhere. What it must never do is pretend to have sent
 * something, so `send` reports which transport ran and the caller can surface
 * that honestly.
 */

export type Mail = {
  to: string;
  subject: string;
  text: string;
};

export type MailTransport = "resend" | "webhook" | "console";

export type MailResult = {
  transport: MailTransport;
  delivered: boolean;
  error?: string;
};

export function activeTransport(): MailTransport {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.MAIL_WEBHOOK_URL) return "webhook";
  return "console";
}

/** Address mail appears to come from. Resend rejects unverified domains. */
function fromAddress(): string {
  return process.env.MAIL_FROM ?? "Pipdrift <onboarding@resend.dev>";
}

const TIMEOUT_MS = 10_000;

async function sendViaResend(mail: Mail): Promise<MailResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      transport: "resend",
      delivered: false,
      error: `Resend ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  return { transport: "resend", delivered: true };
}

async function sendViaWebhook(mail: Mail): Promise<MailResult> {
  const response = await fetch(process.env.MAIL_WEBHOOK_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  return response.ok
    ? { transport: "webhook", delivered: true }
    : {
        transport: "webhook",
        delivered: false,
        error: `Webhook responded ${response.status}`,
      };
}

function sendViaConsole(mail: Mail): MailResult {
  console.info(
    [
      "",
      "──────── pipdrift mail (no transport configured) ────────",
      `to:      ${mail.to}`,
      `subject: ${mail.subject}`,
      "",
      mail.text,
      "─────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );

  return { transport: "console", delivered: true };
}

/** Never throws: a failed send must not take down the request that caused it. */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const transport = activeTransport();

  try {
    if (transport === "resend") return await sendViaResend(mail);
    if (transport === "webhook") return await sendViaWebhook(mail);
    return sendViaConsole(mail);
  } catch (error) {
    console.error("[mail] send failed", error);
    return {
      transport,
      delivered: false,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}
