import { NextResponse, type NextRequest } from "next/server";
import { StoreNotConfiguredError } from "./store";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError(400, "bad_request", message, details);
export const notFound = (message = "Not found.") => new ApiError(404, "not_found", message);
export const conflict = (message: string, details?: unknown) => new ApiError(409, "conflict", message, details);
export const unprocessable = (message: string, details?: unknown) => new ApiError(422, "invalid", message, details);

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    const headers: Record<string, string> = { ...NO_STORE };
    if (error.status === 429 && typeof (error.details as { retryAfter?: number } | undefined)?.retryAfter === "number") {
      headers["Retry-After"] = String((error.details as { retryAfter: number }).retryAfter);
    }
    return NextResponse.json(
      { error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) } },
      { status: error.status, headers },
    );
  }
  if (error instanceof StoreNotConfiguredError) {
    return NextResponse.json({ error: { code: "not_configured", message: error.message } }, { status: 503, headers: NO_STORE });
  }
  // Never echo internals (or answers) to the client; log only the error type and message.
  console.error("[assessments] Unexpected error:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown");
  return NextResponse.json(
    { error: { code: "server_error", message: "Something went wrong. Please try again." } },
    { status: 500, headers: NO_STORE },
  );
}

/** Wraps a route handler so thrown ApiErrors become JSON error responses. */
export function route<Ctx>(handler: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await handler(req, ctx);
    } catch (error) {
      return fail(error);
    }
  };
}

export async function readJson(req: NextRequest, maxBytes = 400_000): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ApiError(413, "too_large", "That request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, "too_large", "That request is too large.");
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw badRequest("The request body must be valid JSON.");
  }
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64) || "unknown";
  return req.headers.get("x-real-ip")?.slice(0, 64) || "unknown";
}

export function asString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}
