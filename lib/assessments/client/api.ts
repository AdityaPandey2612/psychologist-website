// Browser-side fetch helpers for the assessment APIs.

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** Per-question errors returned with a 422 validation response. */
  get fieldErrors(): Record<string, string> {
    const errors = (this.details as { errors?: Record<string, string> } | undefined)?.errors;
    return errors && typeof errors === "object" ? errors : {};
  }
}

type JsonInit = Omit<RequestInit, "body"> & { json?: unknown };

async function parse<T>(res: Response): Promise<T> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON body (e.g. a platform error page).
  }
  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiClientError(res.status, err?.code ?? "error", err?.message ?? "Something went wrong. Please try again.", err?.details);
  }
  return payload as T;
}

export async function apiFetch<T>(url: string, init: JsonInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { Accept: "application/json", ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  return parse<T>(res);
}

/**
 * Same as apiFetch but sends the signed-in admin's Firebase ID token, which the
 * server verifies. Only import this from admin pages (it pulls in Firebase Auth).
 */
export async function adminFetch<T>(url: string, init: JsonInit = {}): Promise<T> {
  const { auth } = await import("@/lib/firebase/auth");
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new ApiClientError(401, "unauthorized", "Please sign in to the admin area.");
  const token = await user.getIdToken();
  return apiFetch<T>(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

/**
 * Fetches the participant's PDF report with their private result token. Resolves to the file and the
 * name the server suggested for it; rejects with the server's own message when there is no report.
 */
export async function downloadReport(token: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/assessments/results/${encodeURIComponent(token)}/pdf`, { cache: "no-store" });
  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string } } | null = null;
    try {
      payload = await res.json();
    } catch {
      // Not a JSON error body.
    }
    throw new ApiClientError(res.status, payload?.error?.code ?? "error", payload?.error?.message ?? "We couldn't make your report. Please try again.");
  }
  const disposition = res.headers.get("content-disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "report.pdf";
  return { blob: await res.blob(), filename };
}

/** Same as adminFetch, for a multipart upload (the browser sets the form's content type itself). */
export async function adminUpload<T>(url: string, form: FormData): Promise<T> {
  const { auth } = await import("@/lib/firebase/auth");
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new ApiClientError(401, "unauthorized", "Please sign in to the admin area.");
  const token = await user.getIdToken();
  const res = await fetch(url, { method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, body: form });
  return parse<T>(res);
}
