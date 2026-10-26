"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import type { AdminViewMode } from "@/lib/assessments/types";
import { Alert, Badge, Spinner } from "@/components/assessments/ui";
import { AdminPage } from "./AdminPage";
import { formatDate, type SubmissionRow } from "./DashboardTypes";
import { EMAIL_STATUS_LABEL, EmailStatusBadge, canRetryEmail } from "./ResultEmailStatus";
import { ResultSubmissionDetail, type SubmissionDetailData } from "./ResultSubmissionDetail";
import { SubmissionQuestionStats } from "./SubmissionQuestionStats";

const PAGE_SIZE = 25;

const MODE_TEXT: Record<AdminViewMode, { title: string; text: string }> = {
  full: { title: "Everything is visible", text: "Names, emails and answers are shown for every submission." },
  consented_only: {
    title: "Only people who agreed to share",
    text: "Names, emails and answers are shown only for participants who agreed to share their results with the practice. Everyone else appears as scores only.",
  },
  anonymous: { title: "Scores only", text: "Names, emails and answers are never shown." },
  none: { title: "Individual submissions are switched off", text: "Only anonymous totals are available, in Analytics." },
};

interface Filters {
  q: string;
  email: string;
  level: string;
  shared: boolean;
  sort: "newest" | "oldest" | "score_desc" | "score_asc";
}
const NO_FILTERS: Filters = { q: "", email: "", level: "", shared: false, sort: "newest" };

interface ListResponse {
  mode: AdminViewMode;
  /** Rows that match the filters, and every row of the assessment. */
  total: number;
  overall: number;
  levels: string[];
  offset: number;
  limit: number;
  rows: SubmissionRow[];
}

/** Neutralise spreadsheet formulas and quote a CSV cell. */
function csvCell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv(rows: SubmissionRow[], title: string) {
  const header = ["Date", "Name", "Email", "Score", "Level", "Version", "Email status", "Agreed to share"];
  const lines = rows.map((r) =>
    [r.createdAt, r.name ?? "", r.address ?? "", r.overall, r.level ?? "", r.version, EMAIL_STATUS_LABEL(r.email.status), r.sharedWithPractice ? "Yes" : "No"].map(csvCell).join(","),
  );
  const blob = new Blob([`﻿${[header.map(csvCell).join(","), ...lines].join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "assessment"}-submissions.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Submissions screen: list (shaped by the privacy mode), detail panel, email retry, CSV export, data deletion. */
export function AdminSubmissions({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // The search box waits a moment after typing before asking the server.
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [privacyBlocked, setPrivacyBlocked] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busy, setBusy] = useState<"delete" | "email" | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const base = `/api/admin/assessments/${id}`;

  useEffect(() => {
    adminFetch<{ assessment: { title: string } }>(base)
      .then((r) => setTitle(r.assessment.title))
      .catch(() => undefined);
  }, [base]);

  useEffect(() => {
    const timer = window.setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadRows = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset), sort: filters.sort });
        if (filters.q) params.set("q", filters.q);
        if (filters.email) params.set("email", filters.email);
        if (filters.level) params.set("level", filters.level);
        if (filters.shared) params.set("shared", "true");
        const res = await adminFetch<ListResponse>(`${base}/submissions?${params.toString()}`);
        setData(res);
        setOffset(nextOffset);
        setPrivacyBlocked(false);
      } catch (e) {
        if (e instanceof ApiClientError && e.code === "privacy") setPrivacyBlocked(true);
        else setError(e instanceof ApiClientError ? e.message : "Couldn't load submissions. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [base, filters],
  );

  // A new search or filter always starts again from the first page.
  useEffect(() => {
    void loadRows(0);
  }, [loadRows]);

  const openDetail = useCallback(
    async (sid: string) => {
      setSelected(sid);
      setDetail(null);
      setDetailError("");
      setDetailLoading(true);
      try {
        setDetail(await adminFetch<SubmissionDetailData>(`${base}/submissions/${sid}`));
      } catch (e) {
        setDetailError(e instanceof ApiClientError ? e.message : "Couldn't load this submission.");
      } finally {
        setDetailLoading(false);
      }
    },
    [base],
  );

  const closeDetail = useCallback(() => setSelected(null), []);

  async function retryEmail(sid: string, fromRow: boolean) {
    if (fromRow) setRowBusy(sid);
    else setBusy("email");
    setNotice(null);
    try {
      const res = await adminFetch<{ status: string; message: string }>(`${base}/submissions/${sid}`, { method: "POST", json: { action: "retry-email" } });
      setNotice({ tone: res.status === "sent" ? "success" : "error", text: res.message });
      await loadRows(offset);
      if (selected === sid) await openDetail(sid);
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't retry the email." });
    } finally {
      setRowBusy(null);
      setBusy(null);
    }
  }

  async function deleteSubmission(sid: string) {
    if (!window.confirm("Permanently delete this person's answers, result and email records? This can't be undone.")) return;
    setBusy("delete");
    setNotice(null);
    try {
      await adminFetch(`${base}/submissions/${sid}`, { method: "DELETE" });
      setSelected(null);
      setNotice({ tone: "success", text: "That submission was deleted." });
      const remaining = (data?.total ?? 1) - 1;
      await loadRows(Math.min(offset, Math.max(0, Math.floor((remaining - 1) / PAGE_SIZE) * PAGE_SIZE)));
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof ApiClientError ? e.message : "Couldn't delete the submission." });
    } finally {
      setBusy(null);
    }
  }

  const mode = data?.mode;
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const overall = data?.overall ?? 0;
  const filtering = filters.q !== "" || filters.email !== "" || filters.level !== "" || filters.shared;
  const selectClass = "min-h-10 rounded-xl border border-primary/25 bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <AdminPage
      wide
      title="Submissions"
      description={title ? `Responses to “${title}”.` : undefined}
      back={{ href: "/admin/assessments", label: "All assessments" }}
      actions={
        <>
          <Link href={`/admin/assessments/${id}/analytics`} className="btn-outline px-5 py-2 text-sm">
            Analytics
          </Link>
          {rows.length > 0 && (
            <button type="button" className="btn-outline px-5 py-2 text-sm" onClick={() => exportCsv(rows, title)}>
              <Download aria-hidden="true" className="h-4 w-4" />
              Export this page (CSV)
            </button>
          )}
        </>
      }
    >
      {privacyBlocked ? (
        <Alert tone="info" className="space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <Lock aria-hidden="true" className="h-4 w-4" />
            Individual submissions are switched off
          </p>
          <p>
            This assessment’s privacy setting is “{MODE_TEXT.none.title.toLowerCase()}”. {MODE_TEXT.none.text} To review individual responses, change <strong>Settings → Privacy</strong> in the{" "}
            <Link href={`/admin/assessments/${id}/edit`} className="font-semibold underline">
              assessment editor
            </Link>
            .
          </p>
        </Alert>
      ) : (
        <div className="space-y-5">
          {mode && (
            <Alert tone="info">
              <span className="font-semibold">Privacy: {MODE_TEXT[mode].title}.</span> {MODE_TEXT[mode].text}{" "}
              <Link href={`/admin/assessments/${id}/edit`} className="font-semibold underline">
                Change in Settings
              </Link>
            </Alert>
          )}
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          {error && (
            <Alert tone="error">
              {error}{" "}
              <button type="button" className="font-semibold underline" onClick={() => loadRows(offset)}>
                Try again
              </button>
            </Alert>
          )}

          <SubmissionQuestionStats base={base} />

          {(overall > 0 || filtering) && (
            <form role="search" aria-label="Search and filter submissions" onSubmit={(e) => e.preventDefault()} className="card flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-[14rem] flex-1">
                <label htmlFor="submission-search" className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Search
                </label>
                <input
                  id="submission-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={mode === "anonymous" ? "Names are hidden in this privacy mode" : "Name or email"}
                  disabled={mode === "anonymous"}
                  autoComplete="off"
                  className={`${selectClass} mt-1 w-full`}
                />
              </div>
              <div>
                <label htmlFor="submission-level" className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Result
                </label>
                <select id="submission-level" value={filters.level} onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))} className={`${selectClass} mt-1`}>
                  <option value="">All results</option>
                  {(data?.levels ?? []).map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="submission-email" className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Email
                </label>
                <select id="submission-email" value={filters.email} onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))} className={`${selectClass} mt-1`}>
                  <option value="">Any status</option>
                  {["sent", "failed", "pending", "not_requested", "not_configured"].map((status) => (
                    <option key={status} value={status}>
                      {EMAIL_STATUS_LABEL(status as SubmissionRow["email"]["status"])}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="submission-sort" className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Order
                </label>
                <select id="submission-sort" value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as Filters["sort"] }))} className={`${selectClass} mt-1`}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="score_desc">Highest score first</option>
                  <option value="score_asc">Lowest score first</option>
                </select>
              </div>
              <label className="flex min-h-10 items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={filters.shared} onChange={(e) => setFilters((f) => ({ ...f, shared: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Agreed to share
              </label>
              {filtering && (
                <button
                  type="button"
                  className="btn-outline px-4 py-2 text-sm"
                  onClick={() => {
                    setSearch("");
                    setFilters((f) => ({ ...NO_FILTERS, sort: f.sort }));
                  }}
                >
                  Clear filters
                </button>
              )}
            </form>
          )}

          {loading && !data ? (
            <p className="flex items-center gap-2 text-ink-soft">
              <Spinner label="Loading submissions" /> Loading submissions…
            </p>
          ) : rows.length === 0 && !error ? (
            <p className="rounded-2xl bg-surface px-6 py-10 text-center text-ink-soft">{filtering ? "No submissions match these filters." : "No submissions yet."}</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft" aria-live="polite">
                {filtering ? `${total} of ${overall} submission${overall === 1 ? "" : "s"} match` : `${total} submission${total === 1 ? "" : "s"}`}
                {total > PAGE_SIZE && ` · showing ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)}`}
              </p>

              {/* Cards on small screens */}
              <ul className="space-y-3 md:hidden">
                {rows.map((r) => (
                  <li key={r.id} className="card p-4">
                    <button type="button" onClick={() => openDetail(r.id)} className="block w-full text-left" aria-label={`Open submission from ${r.name ?? "anonymous participant"}, ${formatDate(r.createdAt, true)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-primary-dark">{r.name ?? "Anonymous"}</p>
                          {r.address && <p className="truncate text-sm text-ink-soft">{r.address}</p>}
                          <p className="text-sm text-ink-soft">{formatDate(r.createdAt, true)} · v{r.version}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-3xl text-primary-dark">{r.overall ?? "—"}</p>
                          {r.level && <p className="text-xs text-ink-soft">{r.level}</p>}
                        </div>
                      </div>
                    </button>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <EmailStatusBadge status={r.email.status} />
                      {r.sharedWithPractice && <Badge tone="gold">Agreed to share</Badge>}
                      {canRetryEmail(r.email.status) && (
                        <button type="button" onClick={() => retryEmail(r.id, true)} disabled={rowBusy === r.id} className="text-sm font-semibold text-primary-dark underline disabled:opacity-60">
                          Retry email
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Table from md up */}
              <div className="hidden overflow-x-auto rounded-2xl bg-surface shadow-sm md:block">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <caption className="sr-only">Submissions for {title || "this assessment"}</caption>
                  <thead className="border-b border-primary/10 text-xs uppercase tracking-wide text-ink-soft">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Participant</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Score</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Result</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Ver.</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/10">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-soft/40">
                        <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{formatDate(r.createdAt, true)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-primary-dark">{r.name ?? "Anonymous"}</p>
                          {r.address && <p className="text-ink-soft">{r.address}</p>}
                          {r.sharedWithPractice && <Badge tone="gold">Agreed to share</Badge>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-primary-dark">{r.overall ?? "—"}</td>
                        <td className="px-4 py-3 text-primary-dark">{r.level ?? "—"}</td>
                        <td className="px-4 py-3 text-ink-soft">{r.version}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <EmailStatusBadge status={r.email.status} />
                            {canRetryEmail(r.email.status) && (
                              <button type="button" onClick={() => retryEmail(r.id, true)} disabled={rowBusy === r.id} className="font-semibold text-primary-dark underline disabled:opacity-60">
                                {rowBusy === r.id ? "Retrying…" : "Retry"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => openDetail(r.id)} className="font-semibold text-primary underline">
                            View answers
                            <span className="sr-only"> for {r.name ?? "anonymous participant"}, {formatDate(r.createdAt, true)}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total > PAGE_SIZE && (
                <nav aria-label="Submissions pages" className="flex items-center justify-between gap-3">
                  <button type="button" className="btn-outline px-4 py-2 text-sm disabled:opacity-50" disabled={offset === 0 || loading} onClick={() => loadRows(Math.max(0, offset - PAGE_SIZE))}>
                    <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                    Newer
                  </button>
                  <button type="button" className="btn-outline px-4 py-2 text-sm disabled:opacity-50" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => loadRows(offset + PAGE_SIZE)}>
                    Older
                    <ChevronRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      )}

      {selected && (
        <ResultSubmissionDetail
          detail={detail}
          loading={detailLoading}
          error={detailError}
          busy={busy}
          onClose={closeDetail}
          onDelete={() => deleteSubmission(selected)}
          onRetryEmail={() => retryEmail(selected, false)}
        />
      )}
    </AdminPage>
  );
}
