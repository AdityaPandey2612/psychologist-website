// Small isomorphic text helpers: sanitising, slugs, ids, HTML escaping.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const HTML_TAGS = /<\/?[a-zA-Z][^>]*>/g;

/**
 * Normalises user-supplied text: strips control characters and well-formed HTML
 * tags, trims, and caps the length. Output is still escaped wherever it is
 * rendered; this is defence in depth, not the only protection.
 */
export function sanitizeText(value: unknown, maxLength = 500, opts: { multiline?: boolean } = {}): string {
  if (typeof value !== "string") return "";
  let text = value.normalize("NFC").replace(CONTROL_CHARS, "").replace(HTML_TAGS, "");
  text = opts.multiline ? text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : text.replace(/\s+/g, " ");
  return text.trim().slice(0, maxLength);
}

/** Replaces `{{name}}` placeholders; unknown names become empty. Plain text in, plain text out. */
export function fillTokens(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => (key in values ? String(values[key]) : ""));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export const RESERVED_SLUGS = ["new", "results", "peer", "start", "api", "admin"];
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short random id with a prefix, e.g. `q_k3x9a2bd`. Used for sections, questions, choices. */
export function newId(prefix: string, length = 8): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return `${prefix}_${out}`;
}

/** URL-safe random token (default 32 bytes = 256 bits). */
export function randomToken(byteLength = 32): string {
  const bytes = randomBytes(byteLength);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

// Pragmatic email validation: one @, no spaces, a dotted domain, sane lengths.
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length < 6 || email.length > 254) return false;
  if (email.includes("..")) return false;
  const [local] = email.split("@");
  if (!local || local.length > 64 || local.startsWith(".") || local.endsWith(".")) return false;
  return EMAIL_PATTERN.test(email);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
