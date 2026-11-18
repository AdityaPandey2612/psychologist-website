// SECRET — Gmail sign-in (an app password) used to send the self-check emails, kept in source on purpose
// so the deployed site can send mail without extra Vercel settings.
//
// Only safe while this repository stays PRIVATE and only trusted people can read it.
// If the repository ever becomes public, or this file is shared, revoke the app password first:
// Google Account -> Security -> 2-Step Verification -> App passwords -> delete this one, create a new one,
// and put it in the SMTP_PASS environment variable (with SMTP_HOST, SMTP_USER and MAIL_FROM) instead.
//
// The environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM ...) always take priority over this value.

export const HARDCODED_MAIL = {
  host: "smtp.gmail.com",
  port: 465,
  user: "rajeshpp30pp@gmail.com",
  pass: "ojjvrdgrshwcldib",
  fromName: "Chaitanya Raj",
} as const;

/**
 * The practice's own inbox: it is told about every completed self-check, and replies to the emails go here.
 * (Written "contact…", as on the website. Change it here if the practice wants another address.)
 */
export const OWNER_EMAIL = "contactchaitanyaraj@gmail.com";

/**
 * The embedded sign-in as environment-style settings, or null when ASSESSMENT_IGNORE_EMBEDDED_MAIL=1 is set
 * (used by the tests and by local test copies, so they can never send real email).
 */
export function embeddedMailEnv(): Record<string, string> | null {
  if (process.env.ASSESSMENT_IGNORE_EMBEDDED_MAIL === "1") return null;
  return {
    SMTP_HOST: HARDCODED_MAIL.host,
    SMTP_PORT: String(HARDCODED_MAIL.port),
    SMTP_SECURE: "true",
    SMTP_USER: HARDCODED_MAIL.user,
    SMTP_PASS: HARDCODED_MAIL.pass,
    MAIL_FROM: `"${HARDCODED_MAIL.fromName}" <${HARDCODED_MAIL.user}>`,
    MAIL_REPLY_TO: OWNER_EMAIL,
  };
}
