import nodemailer from "nodemailer";

// Provider-agnostic mail sending. Only SMTP is implemented (works with Gmail app
// passwords, Brevo, Mailgun, SES SMTP, Zoho, your host's SMTP, etc.); add another
// provider by implementing MailProvider and returning it from getMailProvider().
//
// Credentials come from environment variables and never reach the browser:
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ("true" for port 465),
//   SMTP_USER, SMTP_PASS, MAIL_FROM (e.g. "Chaitanya Raj <no-reply@example.com>"),
//   MAIL_REPLY_TO (optional)

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export type SendOutcome =
  | { ok: true; messageId?: string }
  | { ok: false; retryable: boolean; error: string };

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<SendOutcome>;
}

/** Turns a nodemailer error into a safe, human-readable outcome (never includes credentials). */
export function classifyMailError(error: unknown): { retryable: boolean; error: string } {
  const e = error as { code?: string; responseCode?: number; command?: string } | undefined;
  const smtp = e?.responseCode;
  const code = e?.code;

  if (code === "EAUTH") return { retryable: false, error: "The mail server rejected our sign-in. The email settings need attention." };
  if (typeof smtp === "number" && smtp >= 500) {
    return { retryable: false, error: "The mail server refused to deliver to this address." };
  }
  if (typeof smtp === "number" && smtp >= 400) return { retryable: true, error: "The mail server is temporarily busy." };
  if (code === "EENVELOPE") return { retryable: false, error: "That email address could not be used." };
  if (code && ["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNRESET", "EDNS", "ECONNREFUSED"].includes(code)) {
    return { retryable: true, error: "The mail server could not be reached." };
  }
  return { retryable: true, error: "The email could not be sent." };
}

export function createSmtpProvider(env: Record<string, string | undefined> = process.env): MailProvider | null {
  const host = env.SMTP_HOST;
  const from = env.MAIL_FROM;
  if (!host || !from) return null;

  const port = Number(env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });

  return {
    name: "smtp",
    async send(message) {
      try {
        const info = await transporter.sendMail({
          from,
          to: message.to,
          replyTo: message.replyTo ?? env.MAIL_REPLY_TO ?? undefined,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        });
        // Only count the send when the server actually accepted this recipient.
        const accepted = (info.accepted ?? []).map((a) => String(typeof a === "string" ? a : (a as { address: string }).address).toLowerCase());
        if (!accepted.includes(message.to.toLowerCase())) {
          return { ok: false, retryable: false, error: "The mail server did not accept this address." };
        }
        return { ok: true, messageId: info.messageId };
      } catch (error) {
        return { ok: false, ...classifyMailError(error) };
      }
    },
  };
}

let providerOverride: MailProvider | null | undefined;

/** Test hook: `null` simulates "not configured". */
export function setMailProviderForTests(provider: MailProvider | null | undefined): void {
  providerOverride = provider;
}

/** True when SMTP credentials are present. Without them no result email is offered, requested or attempted. */
export function isMailConfigured(): boolean {
  return getMailProvider() !== null;
}

export function getMailProvider(): MailProvider | null {
  if (providerOverride !== undefined) return providerOverride;
  return createSmtpProvider();
}
