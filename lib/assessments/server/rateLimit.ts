import { ApiError } from "./http";

// In-memory sliding-window limiter, same approach as app/api/contact. Serverless
// instances don't share memory, so this blunts bursts per instance rather than
// being a global guarantee; the submit endpoint is additionally idempotent and
// resend attempts are capped per submission in the database.

const globalForLimit = globalThis as typeof globalThis & { __assessmentHits?: Map<string, number[]> };
const hits = (globalForLimit.__assessmentHits ??= new Map<string, number[]>());

export interface Limit {
  /** Logical bucket, e.g. "submit". */
  name: string;
  max: number;
  windowMs: number;
}

export function checkRateLimit(key: string, limit: Limit, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const bucket = `${limit.name}:${key}`;
  const recent = (hits.get(bucket) ?? []).filter((t) => now - t < limit.windowMs);
  if (recent.length >= limit.max) {
    hits.set(bucket, recent);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((recent[0] + limit.windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(bucket, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every((t) => now - t > 3_600_000)) hits.delete(k);
  }
  return { allowed: true, retryAfter: 0 };
}

export function enforceRateLimit(key: string, limit: Limit): void {
  // Lets automated local test runs exceed the limits; never honoured in production.
  if (process.env.NODE_ENV !== "production" && process.env.ASSESSMENT_DISABLE_RATE_LIMIT === "1") return;
  const { allowed, retryAfter } = checkRateLimit(key, limit);
  if (!allowed) {
    throw new ApiError(429, "rate_limited", "Too many requests. Please wait a moment and try again.", { retryAfter });
  }
}

export const LIMITS = {
  submit: { name: "submit", max: 6, windowMs: 60 * 60 * 1000 },
  submitBurst: { name: "submit-burst", max: 2, windowMs: 10 * 1000 },
  resultRead: { name: "result-read", max: 120, windowMs: 60 * 1000 },
  email: { name: "email", max: 5, windowMs: 10 * 60 * 1000 },
  report: { name: "report", max: 20, windowMs: 60 * 60 * 1000 },
  upload: { name: "upload", max: 30, windowMs: 60 * 60 * 1000 },
  peer: { name: "peer", max: 10, windowMs: 60 * 60 * 1000 },
  start: { name: "start", max: 30, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, Limit>;
