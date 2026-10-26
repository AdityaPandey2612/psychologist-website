"use client";

import { Check, Copy, Link2, Share2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/assessments/client/api";
import type { ResultView } from "@/lib/assessments/server/submissions";
import { Alert, Spinner, cx, inputClass } from "./ui";

type Peer = ResultView["peer"];

/** Lets the participant create, copy and switch off their private peer-feedback link. */
export default function PeerInvitePanel({ token, peer, onChange }: { token: string; peer: Peer; onChange: (peer: Peer) => void }) {
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!peer.available) return null;
  const link = peer.enabled && peer.token ? `${origin}/assessments/peer/${peer.token}` : "";

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      onChange(await apiFetch<Peer>(`/api/assessments/results/${token}/peer`, { method: "POST", json: { enabled } }));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "We couldn't update the link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-bg p-5 sm:p-6">
      <h3 className="flex items-center gap-2 font-display text-xl text-primary-dark">
        <Link2 aria-hidden="true" className="h-5 w-5" />
        Ask someone for their view
      </h3>
      <p className="mt-2 leading-relaxed text-ink-soft">
        Invite a colleague, friend or family member to answer a few short questions about how they experience you. You&apos;ll see their answers next to yours as an
        anonymous average.
      </p>

      {peer.enabled && peer.token ? (
        <div className="mt-4">
          <label htmlFor="peer-link" className="block text-sm font-semibold text-primary-dark">
            Your private feedback link
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input ref={inputRef} id="peer-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={cx(inputClass, "min-w-0 flex-1 text-sm")} />
            <button type="button" onClick={copy} className="btn-primary min-h-11 shrink-0">
              {copied ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
            {canShare && (
              <button
                type="button"
                className="btn-outline min-h-11 shrink-0"
                onClick={() => navigator.share({ title: "A quick favour", text: "Would you share how you experience talking with me? It takes a few minutes.", url: link }).catch(() => undefined)}
              >
                <Share2 aria-hidden="true" className="h-4 w-4" />
                Share
              </button>
            )}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {copied ? "Link copied to clipboard" : ""}
          </p>
          <p className="mt-3 text-sm text-ink-soft">
            {peer.responseCount} of {peer.maxResponses} response{peer.maxResponses === 1 ? "" : "s"} received.
            {peer.responseCount >= peer.maxResponses && " The link is now full."}
          </p>
          <button type="button" onClick={() => toggle(false)} disabled={busy} className="mt-3 min-h-11 text-sm font-medium text-primary-dark underline underline-offset-4 disabled:opacity-60">
            {busy ? <Spinner label="Updating" /> : "Turn this link off"}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => toggle(true)} disabled={busy} className="btn-primary mt-4 min-h-11 disabled:opacity-60">
          {busy ? <Spinner label="Creating link" /> : <Link2 aria-hidden="true" className="h-4 w-4" />}
          {peer.token ? "Turn the link back on" : "Create my private link"}
        </button>
      )}

      {error && (
        <Alert tone="error" className="mt-4">
          {error}
        </Alert>
      )}

      <p className="mt-5 flex gap-2 text-sm leading-relaxed text-ink-soft">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          The person you invite sees only your first name and the questions — not your answers or results. They must agree before they submit, and you can turn the link off at any time. Anyone who has the
          link can answer, so share it only with people you trust.
        </span>
      </p>
    </div>
  );
}
