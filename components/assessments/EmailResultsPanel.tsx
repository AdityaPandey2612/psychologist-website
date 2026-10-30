"use client";

import { Mail, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/assessments/client/api";
import type { ResultView } from "@/lib/assessments/server/submissions";
import { Alert, Spinner } from "./ui";

type EmailState = ResultView["email"];

/**
 * Shows the real delivery state of the result email. "Sent" wording appears only
 * when the server recorded that the mail provider accepted the message.
 */
export default function EmailResultsPanel({ token, email, onChange }: { token: string; email: EmailState; onChange: (patch: Partial<EmailState>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);

  // The email is sent in the background, so the page opens at once with "on its way". While it is still pending,
  // check back every few seconds (for about half a minute) and show whether it was sent.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const pending = email.enabled && email.status === "pending";
  useEffect(() => {
    if (!pending) return;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const view = await apiFetch<ResultView>(`/api/assessments/results/${token}`, { cache: "no-store" });
        if (view.email.status !== "pending") {
          clearInterval(timer);
          onChangeRef.current(view.email);
          return;
        }
      } catch {
        // Keep the message we have; the next check may work.
      }
      if (tries >= 10) clearInterval(timer);
    }, 3000);
    return () => clearInterval(timer);
  }, [pending, token]);

  if (!email.enabled) return null;

  async function send(consent: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ status: EmailState["status"]; message: string }>(`/api/assessments/results/${token}/email`, {
        method: "POST",
        json: consent ? { consent: true } : {},
      });
      onChange({ status: res.status, message: res.message, consented: email.consented || consent, canRetry: res.status !== "sent" });
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const declined = !email.consented && email.status === "not_requested";

  return (
    <div>
      {declined ? (
        <div>
          <p className="leading-relaxed text-ink-soft">You chose not to receive your results by email. If you&apos;ve changed your mind, we can send a copy to {email.address}.</p>
          <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-ink">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-primary" />
            <span className="leading-snug">Yes, please email my results to {email.address}.</span>
          </label>
          <button type="button" disabled={!agree || busy} onClick={() => send(true)} className="btn-primary mt-3 min-h-11 disabled:opacity-60">
            {busy ? <Spinner label="Sending" /> : <Mail aria-hidden="true" className="h-4 w-4" />}
            Email me my results
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {email.status === "sent" && (
            <Alert tone="success">
              <p className="font-semibold">Accepted for delivery to {email.address}</p>
              <p className="mt-1">{email.message}</p>
            </Alert>
          )}
          {email.status === "pending" && (
            <Alert tone="info">
              <span className="flex items-start gap-3">
                <Spinner label="Sending" />
                <span>{email.message}</span>
              </span>
            </Alert>
          )}
          {email.status === "failed" && (
            <Alert tone="error">
              <p className="font-semibold">Your results haven&apos;t been emailed</p>
              <p className="mt-1">{email.message}</p>
              {!email.canRetry && <p className="mt-1">We&apos;ve stopped retrying for now. Your results stay available on this page.</p>}
            </Alert>
          )}
          {email.status === "not_configured" && <Alert tone="warning">{email.message}</Alert>}

          {email.status !== "sent" && email.status !== "not_configured" && email.canRetry && (
            <button type="button" disabled={busy} onClick={() => send(false)} className="btn-outline min-h-11 disabled:opacity-60">
              {busy ? <Spinner label="Sending" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}
              Try sending again
            </button>
          )}
        </div>
      )}
      {error && (
        <Alert tone="error" className="mt-3">
          {error}
        </Alert>
      )}
    </div>
  );
}
