"use client";

import { Mail, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { AssessmentResult } from "@/lib/assessments/types";
import { Alert, Badge, Spinner } from "@/components/assessments/ui";
import { formatDate, type SubmissionRow } from "./DashboardTypes";
import { EmailStatusBadge, canRetryEmail } from "./ResultEmailStatus";

export interface SubmissionDetailData extends SubmissionRow {
  result: AssessmentResult;
  /** null when the privacy mode hides this person's answers. */
  answers: Array<{ questionId: string; question: string; answer: string }> | null;
  peerResponses: number;
  emailError?: string;
  emailAttempts: number;
  practiceNote?: { status: "sending" | "sent" | "failed"; error?: string } | null;
}

function SkillBar({ name, score, band }: { name: string; score: number | null; band?: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-primary-dark">
          {name}
          {band && <span className="ml-2 text-ink-soft">{band}</span>}
        </span>
        <span className="font-semibold text-primary-dark">{score === null ? "—" : score}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${score ?? 0}%` }} />
      </div>
    </li>
  );
}

/** Slide-over dialog with one submission's result summary and (when allowed) answers. */
export function ResultSubmissionDetail({
  detail,
  loading,
  error,
  onClose,
  onDelete,
  onRetryEmail,
  busy,
}: {
  detail: SubmissionDetailData | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  onDelete: () => void;
  onRetryEmail: () => void;
  busy: "delete" | "email" | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  const result = detail?.result;
  const scoredSkills = result?.skills.filter((s) => s.score !== null) ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-primary-dark/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="submission-detail-title" className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-bg shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-primary/10 bg-bg px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Submission</p>
            <h2 id="submission-detail-title" className="mt-1 truncate text-2xl text-primary-dark">
              {detail?.name ?? "Anonymous participant"}
            </h2>
            {detail && <p className="text-sm text-ink-soft">{detail.address ? `${detail.address} · ` : ""}{formatDate(detail.createdAt, true)}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close submission details"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/25 text-primary-dark hover:bg-surface-soft"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          {loading && (
            <p className="flex items-center gap-2 text-ink-soft">
              <Spinner label="Loading submission" /> Loading…
            </p>
          )}
          {error && <Alert tone="error">{error}</Alert>}

          {detail && result && (
            <>
              <section aria-label="Result summary">
                <div className="flex flex-wrap items-center gap-3">
                  {result.overall !== null ? (
                    <p className="font-display text-5xl text-primary-dark">
                      {result.overall}
                      <span className="text-xl text-ink-soft"> / 100</span>
                    </p>
                  ) : (
                    <p className="text-ink-soft">This submission has no score.</p>
                  )}
                  {result.level && <Badge tone="primary">{result.level.label}</Badge>}
                  <Badge>Version {detail.version}</Badge>
                  {detail.sharedWithPractice && <Badge tone="gold">Agreed to share</Badge>}
                </div>
                {scoredSkills.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {scoredSkills.map((s) => (
                      <SkillBar key={s.id} name={s.name} score={s.score} band={s.band} />
                    ))}
                  </ul>
                )}
                {result.contexts.some((c) => c.score !== null) && (
                  <ul className="mt-4 space-y-3 border-t border-primary/10 pt-4">
                    {result.contexts
                      .filter((c) => c.score !== null)
                      .map((c) => (
                        <SkillBar key={c.id} name={c.name} score={c.score} />
                      ))}
                  </ul>
                )}
                {(result.strengths.length > 0 || result.growth.length > 0) && (
                  <p className="mt-4 text-sm text-ink-soft">
                    {result.strengths.length > 0 && (
                      <>
                        <strong className="text-primary-dark">Strengths:</strong> {result.strengths.map((s) => s.name).join(", ")}.{" "}
                      </>
                    )}
                    {result.growth.length > 0 && (
                      <>
                        <strong className="text-primary-dark">Growth areas:</strong> {result.growth.map((s) => s.name).join(", ")}.
                      </>
                    )}
                  </p>
                )}
                {detail.peerResponses > 0 && <p className="mt-2 text-sm text-ink-soft">{detail.peerResponses} peer response{detail.peerResponses === 1 ? "" : "s"} received.</p>}
              </section>

              <section aria-label="Email" className="rounded-2xl bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail aria-hidden="true" className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary-dark">Results email</span>
                    <EmailStatusBadge status={detail.email.status} />
                  </div>
                  {(canRetryEmail(detail.email.status) || detail.practiceNote?.status === "failed") && (
                    <button type="button" onClick={onRetryEmail} disabled={busy !== null} className="btn-outline px-4 py-1.5 text-sm disabled:opacity-60">
                      {busy === "email" && <Spinner label="Sending" className="h-4 w-4" />}
                      Retry email
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-ink-soft">{detail.email.message}</p>
                {detail.emailError && detail.email.status === "failed" && <p className="mt-1 text-sm text-accent-ink">Last error: {detail.emailError}</p>}
                {detail.emailAttempts > 0 && <p className="mt-1 text-xs text-ink-soft">Sending attempts so far: {detail.emailAttempts}</p>}
                {detail.practiceNote && (
                  <p className="mt-3 border-t border-primary/10 pt-3 text-sm text-ink-soft">
                    <span className="font-semibold text-primary-dark">Note to the practice:</span>{" "}
                    {detail.practiceNote.status === "sent" ? "sent" : detail.practiceNote.status === "sending" ? "being sent" : "not sent"}
                    {detail.practiceNote.status === "failed" && detail.practiceNote.error ? ` (${detail.practiceNote.error})` : ""}
                    {detail.practiceNote.status === "failed" ? ". Use Retry email to send it again." : "."}
                  </p>
                )}
              </section>

              <section aria-label="Answers">
                <h3 className="text-xl text-primary-dark">Answers</h3>
                {detail.answers === null ? (
                  <Alert tone="info" className="mt-3">
                    This person’s answers are hidden by the assessment’s privacy settings (they haven’t agreed to share them with the practice, or the mode is scores-only).
                  </Alert>
                ) : detail.answers.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">No answers were recorded.</p>
                ) : (
                  <dl className="mt-3 divide-y divide-primary/10 rounded-2xl bg-surface">
                    {detail.answers.map((a) => (
                      <div key={a.questionId} className="px-4 py-3">
                        <dt className="text-sm text-ink-soft">{a.question}</dt>
                        <dd className="mt-0.5 whitespace-pre-line text-primary-dark">{a.answer}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>

              <section aria-label="Delete data" className="border-t border-primary/10 pt-5">
                <p className="text-sm text-ink-soft">Erases this person’s answers, result, peer answers and email records permanently — for example if they ask for their data to be deleted.</p>
                <button type="button" onClick={onDelete} disabled={busy !== null} className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent-ink/40 px-4 py-2 text-sm font-medium text-accent-ink hover:bg-[#FBEEE5] disabled:opacity-60">
                  {busy === "delete" ? <Spinner label="Deleting" className="h-4 w-4" /> : <Trash2 aria-hidden="true" className="h-4 w-4" />}
                  Delete this person’s data
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
