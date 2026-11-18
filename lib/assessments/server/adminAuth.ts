import { createPublicKey, verify, type KeyObject } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "./http";

// Admin authorisation for the assessment APIs.
//
// The existing admin area signs in with Firebase Authentication in the browser
// (see app/admin/AdminGuard.tsx). The API routes can't trust that client-side
// guard, so the browser sends its Firebase ID token and we verify it here:
// RS256 signature against Google's published keys, issuer, audience, expiry.
// No extra SDK or credentials are needed for this step.
//
// Who counts as an admin:
//   * ASSESSMENT_ADMIN_EMAILS set  -> only those addresses (recommended).
//   * not set                      -> any signed-in Firebase user, which matches
//                                     what AdminGuard already allows. The admin
//                                     dashboard shows a warning in that case.

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export interface AdminIdentity {
  uid: string;
  email?: string;
  access: "allowlist" | "any-signed-in";
}

export interface VerifiedToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
}

export type KeyResolver = (kid: string) => Promise<KeyObject | null>;

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

const globalForKeys = globalThis as typeof globalThis & {
  __firebaseKeys?: { keys: Map<string, KeyObject>; expires: number; lastFetch: number };
};

async function defaultKeyResolver(kid: string): Promise<KeyObject | null> {
  const cache = (globalForKeys.__firebaseKeys ??= { keys: new Map(), expires: 0, lastFetch: 0 });
  const now = Date.now();
  const fresh = now < cache.expires;
  if (fresh && cache.keys.has(kid)) return cache.keys.get(kid) ?? null;
  // Refetch when the cache is stale, or (at most once a minute) when the key id is unknown.
  if (!fresh || now - cache.lastFetch > 60_000) {
    cache.lastFetch = now;
    const res = await fetch(JWKS_URL, { cache: "no-store" });
    if (!res.ok) throw new ApiError(503, "auth_unavailable", "Could not reach the sign-in key service. Please try again.");
    const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1];
    const body = (await res.json()) as { keys?: Jwk[] };
    cache.keys = new Map(
      (body.keys ?? [])
        .filter((k) => k.kty === "RSA" && k.kid)
        .map((k) => [k.kid, createPublicKey({ key: k as unknown as import("node:crypto").JsonWebKey, format: "jwk" })]),
    );
    cache.expires = now + (maxAge ? Number(maxAge) * 1000 : 3_600_000);
  }
  return cache.keys.get(kid) ?? null;
}

const b64urlJson = (part: string): Record<string, unknown> => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

/** Verifies a Firebase Authentication ID token. Throws ApiError(401) when invalid. */
export async function verifyFirebaseIdToken(
  token: string,
  options: { projectId?: string; now?: number; getKey?: KeyResolver } = {},
): Promise<VerifiedToken> {
  const projectId = options.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, "not_configured", "The Firebase project id is not configured on the server.");
  const unauthorized = (message = "Please sign in again.") => new ApiError(401, "unauthorized", message);

  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 6000) throw unauthorized();

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch {
    throw unauthorized();
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw unauthorized();

  const key = await (options.getKey ?? defaultKeyResolver)(header.kid);
  if (!key) throw unauthorized();
  const valid = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
  if (!valid) throw unauthorized();

  const nowSec = Math.floor((options.now ?? Date.now()) / 1000);
  const skew = 60;
  const num = (v: unknown) => (typeof v === "number" ? v : NaN);
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw unauthorized();
  if (!(num(payload.exp) > nowSec - skew) || !(num(payload.iat) <= nowSec + skew)) throw unauthorized("Your session has expired. Please sign in again.");
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 128) throw unauthorized();

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : undefined,
    emailVerified: payload.email_verified === true,
  };
}

export function adminAllowlist(env: Record<string, string | undefined> = process.env): string[] {
  return (env.ASSESSMENT_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowed(verified: VerifiedToken, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  return Boolean(verified.email && allowlist.includes(verified.email));
}

export type AdminVerifier = (token: string) => Promise<VerifiedToken>;
let verifierOverride: AdminVerifier | undefined;

/** Test hook. */
export function setAdminVerifierForTests(fn: AdminVerifier | undefined): void {
  verifierOverride = fn;
}

export async function requireAdmin(req: NextRequest | Request): Promise<AdminIdentity> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  let rawToken = match ? match[1] : undefined;
  if (!rawToken && req.url) {
    try {
      const url = new URL(req.url);
      rawToken = url.searchParams.get("token") || undefined;
    } catch {
      // not a valid url
    }
  }
  if (!rawToken) throw new ApiError(401, "unauthorized", "Please sign in to the admin area.");

  const verified = await (verifierOverride ?? verifyFirebaseIdToken)(rawToken);
  const allowlist = adminAllowlist();
  if (!isAllowed(verified, allowlist)) throw new ApiError(403, "forbidden", "This account is not allowed to manage assessments.");

  return { uid: verified.uid, email: verified.email, access: allowlist.length ? "allowlist" : "any-signed-in" };
}
