"use client";

import Link from "next/link";
import { BarChart3, Copy, ExternalLink, Eye, EyeOff, FileText, Archive, Pencil, Trash2, Undo2, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import { Alert, AssessmentIcon, Badge, Spinner, cx } from "@/components/assessments/ui";
import { formatDate, type AdminAssessmentSummary } from "./DashboardTypes";

export type ListNotice = { tone: "success" | "info" | "error"; text: string; href?: string; linkLabel?: string };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
  { id: "archived", label: "Archived" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const STATUS_BADGE: Record<AdminAssessmentSummary["status"], { label: string; tone: "primary" | "neutral" | "gold" }> = {
  published: { label: "Published", tone: "primary" },
  draft: { label: "Draft", tone: "neutral" },
  archived: { label: "Archived", tone: "gold" },
};

interface Problem {
  message: string;
  errors: string[];
}

function ActionButton({
  children,
  onClick,
  href,
  disabled,
  tone = "neutral",
  external,
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "neutral" | "danger" | "primary";
  external?: boolean;
  label?: string;
}) {
  const className = cx(
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    tone === "primary" && "border-primary bg-primary text-surface hover:bg-primary-dark",
    tone === "neutral" && "border-primary/25 text-primary-dark hover:bg-surface-soft",
    tone === "danger" && "border-accent-ink/30 text-accent-ink hover:bg-[#FBEEE5]",
  );
  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
        {children}
      </a>
    ) : (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className} aria-label={label}>
      {children}
    </button>
  );
}

/** Responsive list of assessments with status filter and per-row actions. */
export function AdminAssessmentList({
  assessments,
  onChanged,
  onNotice,
}: {
  assessments: AdminAssessmentSummary[];
  /** Called after any change so the parent can reload. */
  onChanged: () => Promise<void> | void;
  onNotice: (notice: ListNotice | null) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, Problem>>({});

  const counts: Record<Filter, number> = {
    all: assessments.length,
    published: assessments.filter((a) => a.status === "published").length,
    draft: assessments.filter((a) => a.status === "draft").length,
    archived: assessments.filter((a) => a.status === "archived").length,
  };
  // Archived items are tucked away under their own filter unless the list is otherwise empty.
  const visible = assessments.filter((a) => (filter === "all" ? a.status !== "archived" : a.status === filter));

  async function run(assessment: AdminAssessmentSummary, action: "publish" | "unpublish" | "archive" | "restore" | "duplicate") {
    setBusy(`${assessment.id}:${action}`);
    onNotice(null);
    setProblems((p) => {
      const { [assessment.id]: _drop, ...rest } = p;
      void _drop;
      return rest;
    });
    try {
      const res = await adminFetch<{ assessment: { id: string; title: string } }>(`/api/admin/assessments/${assessment.id}/action`, { method: "POST", json: { action } });
      const verb = { publish: "published", unpublish: "unpublished and moved back to drafts", archive: "archived", restore: "restored as a draft", duplicate: "duplicated" }[action];
      onNotice(
        action === "duplicate"
          ? { tone: "success", text: `“${assessment.title}” was duplicated as a draft.`, href: `/admin/assessments/${res.assessment.id}/edit`, linkLabel: "Edit the copy" }
          : { tone: "success", text: `“${assessment.title}” was ${verb}.` },
      );
      await onChanged();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 422) {
        const report = e.details as { errors?: Array<{ message: string }> } | undefined;
        setProblems((p) => ({ ...p, [assessment.id]: { message: e.message, errors: (report?.errors ?? []).map((x) => x.message) } }));
      } else {
        onNotice({ tone: "error", text: e instanceof ApiClientError ? e.message : "That didn't work. Please try again." });
      }
    } finally {
      setBusy(null);
    }
  }

  /**
   * Deletes an assessment. A published one has to be unpublished first (the server says so). One with responses asks a
   * second time, naming how many answers go with it, and only then deletes them too.
   */
  async function remove(assessment: AdminAssessmentSummary) {
    if (!window.confirm(`Delete “${assessment.title}” permanently? This can't be undone.`)) return;
    setBusy(`${assessment.id}:delete`);
    onNotice(null);
    try {
      let withResponses = false;
      for (;;) {
        try {
          await adminFetch(`/api/admin/assessments/${assessment.id}${withResponses ? "?withResponses=true" : ""}`, { method: "DELETE" });
          break;
        } catch (e) {
          if (!withResponses && e instanceof ApiClientError && e.code === "has_submissions") {
            const count = Number((e.details as { submissions?: number } | undefined)?.submissions ?? assessment.submissionCount);
            const again = window.confirm(
              `“${assessment.title}” has ${count} response${count === 1 ? "" : "s"}.\n\nDeleting it also permanently deletes ${count === 1 ? "that person's" : "those people's"} answers, results, peer feedback and email records. This can't be undone.\n\nDelete the assessment and all its responses?`,
            );
            if (!again) return;
            withResponses = true;
            continue;
          }
          throw e;
        }
      }
      onNotice({ tone: "success", text: `“${assessment.title}” was deleted.` });
      await onChanged();
    } catch (e) {
      onNotice({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't delete it. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Filter assessments by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cx(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              filter === f.id ? "bg-primary-dark text-surface" : "border border-primary/25 text-primary-dark hover:bg-surface-soft",
            )}
          >
            {f.label}
            <span className="ml-1.5 font-normal">{f.id === "all" ? counts.all - counts.archived : counts[f.id]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-surface px-6 py-10 text-center text-ink-soft">
          {assessments.length === 0 ? "No assessments yet. Create one from scratch or install the starter template." : "Nothing in this view."}
        </p>
      ) : (
        <ul className="mt-5 space-y-4">
          {visible.map((a) => {
            const status = STATUS_BADGE[a.status];
            const problem = problems[a.id];
            const isBusy = busy?.startsWith(`${a.id}:`) ?? false;
            const canDelete = a.status !== "published";
            const spin = (action: string) => (busy === `${a.id}:${action}` ? <Spinner label="Working" className="h-4 w-4" /> : null);
            return (
              <li key={a.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="icon-tile tone-teal" aria-hidden="true">
                    <AssessmentIcon name="clipboard" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl text-primary-dark">{a.title}</h3>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {a.hasUnpublishedChanges && <Badge tone="accent">Unpublished changes</Badge>}
                      {a.tier === "premium" && <Badge tone="gold">Premium</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {a.categoryName} · {a.questionCount} question{a.questionCount === 1 ? "" : "s"} · ~{a.estimatedMinutes} min ·{" "}
                      {a.version > 0 ? `version ${a.version}` : "never published"} · updated {formatDate(a.updatedAt)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-ink-soft">/assessments/{a.slug}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl text-primary-dark">{a.submissionCount}</p>
                    <p className="text-xs text-ink-soft">response{a.submissionCount === 1 ? "" : "s"}</p>
                  </div>
                </div>

                {problem && (
                  <Alert tone="error" className="mt-4">
                    <p className="font-semibold">{problem.message}</p>
                    {problem.errors.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {problem.errors.slice(0, 5).map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                        {problem.errors.length > 5 && <li>…and {problem.errors.length - 5} more</li>}
                      </ul>
                    )}
                    <Link href={`/admin/assessments/${a.id}/edit`} className="mt-2 inline-block font-semibold underline">
                      Open the editor to fix these
                    </Link>
                  </Alert>
                )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-primary/10 pt-4">
                  {a.status !== "archived" && (
                    <ActionButton href={`/admin/assessments/${a.id}/edit`} tone="primary">
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                      Edit
                    </ActionButton>
                  )}
                  <ActionButton href={`/admin/assessments/${a.id}/submissions`}>
                    <Users aria-hidden="true" className="h-4 w-4" />
                    Submissions
                  </ActionButton>
                  <ActionButton href={`/admin/assessments/${a.id}/analytics`}>
                    <BarChart3 aria-hidden="true" className="h-4 w-4" />
                    Analytics
                  </ActionButton>
                  {a.status === "published" && (
                    <ActionButton href={`/assessments/${a.slug}`} external label={`View ${a.title} on the website (opens in a new tab)`}>
                      <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      View page
                    </ActionButton>
                  )}
                  {a.status === "draft" && (
                    <ActionButton onClick={() => run(a, "publish")} disabled={isBusy} label={`Publish ${a.title}`}>
                      {spin("publish") ?? <Eye aria-hidden="true" className="h-4 w-4" />}
                      Publish
                    </ActionButton>
                  )}
                  {a.status === "published" && a.hasUnpublishedChanges && (
                    <ActionButton onClick={() => run(a, "publish")} disabled={isBusy} label={`Publish changes to ${a.title}`}>
                      {spin("publish") ?? <FileText aria-hidden="true" className="h-4 w-4" />}
                      Publish changes
                    </ActionButton>
                  )}
                  {a.status === "published" && (
                    <ActionButton onClick={() => run(a, "unpublish")} disabled={isBusy} label={`Unpublish ${a.title}`}>
                      {spin("unpublish") ?? <EyeOff aria-hidden="true" className="h-4 w-4" />}
                      Unpublish
                    </ActionButton>
                  )}
                  <ActionButton onClick={() => run(a, "duplicate")} disabled={isBusy} label={`Duplicate ${a.title}`}>
                    {spin("duplicate") ?? <Copy aria-hidden="true" className="h-4 w-4" />}
                    Duplicate
                  </ActionButton>
                  {a.status === "archived" ? (
                    <ActionButton onClick={() => run(a, "restore")} disabled={isBusy} label={`Restore ${a.title}`}>
                      {spin("restore") ?? <Undo2 aria-hidden="true" className="h-4 w-4" />}
                      Restore
                    </ActionButton>
                  ) : (
                    <ActionButton onClick={() => run(a, "archive")} disabled={isBusy} label={`Archive ${a.title}`}>
                      {spin("archive") ?? <Archive aria-hidden="true" className="h-4 w-4" />}
                      Archive
                    </ActionButton>
                  )}
                  <ActionButton
                    onClick={() => remove(a)}
                    disabled={isBusy || !canDelete}
                    tone="danger"
                    label={canDelete ? `Delete ${a.title}` : `Delete ${a.title} (unpublish it first)`}
                  >
                    {spin("delete") ?? <Trash2 aria-hidden="true" className="h-4 w-4" />}
                    Delete
                  </ActionButton>
                  {!canDelete && <span className="self-center text-xs text-ink-soft">Unpublish it first to delete it.</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
