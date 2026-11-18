"use client";

import { BarChart3, Copy, ExternalLink, FileText, Loader2, Archive, Save, Undo2, EyeOff, Send, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { validateDefinition, type DefinitionReport } from "@/lib/assessments/definition";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import type { AssessmentCategory, AssessmentDefinition, AssessmentDoc, AssessmentMeta } from "@/lib/assessments/types";
import { Alert, Badge, cx } from "../ui";
import { AdminResultBuilder } from "./AdminResultBuilder";
import { AdminScoringEditor } from "./AdminScoringEditor";
import { AdminSettingsEditor } from "./AdminSettingsEditor";
import { BasicsEditor } from "./BasicsEditor";
import { BuilderIssues } from "./BuilderIssues";
import { locateIssue, mergeIssues, metaOf, TABS, type IssueLocation, type TabId } from "./builderState";
import { PreviewPanel } from "./PreviewPanel";
import { QuestionsEditor } from "./QuestionsEditor";

export interface BuilderInitial {
  assessment: AssessmentDoc;
  report: DefinitionReport;
}

interface SaveResult {
  assessment: AssessmentDoc;
  report: DefinitionReport;
}

type Busy = null | "save" | "publish" | "status";

interface Message {
  tone: "success" | "error" | "warning" | "info";
  text: string;
  /** Offer a "Reload" button (the draft was changed somewhere else). */
  reload?: boolean;
}

const snapshot = (meta: AssessmentMeta, definition: AssessmentDefinition) => JSON.stringify({ meta, definition });

export function AdminAssessmentBuilder({ initial }: { initial: BuilderInitial }) {
  const router = useRouter();
  const [doc, setDoc] = useState<AssessmentDoc>(initial.assessment);
  const [meta, setMeta] = useState<AssessmentMeta>(() => metaOf(initial.assessment));
  const [definition, setDefinition] = useState<AssessmentDefinition>(initial.assessment.definition);
  const [savedJson, setSavedJson] = useState(() => snapshot(metaOf(initial.assessment), initial.assessment.definition));
  const [categories, setCategories] = useState<AssessmentCategory[] | null>(null);
  const [tab, setTab] = useState<TabId>("basics");
  const [focus, setFocus] = useState<{ sectionId?: string; questionId?: string; nonce: number } | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [publishReport, setPublishReport] = useState<DefinitionReport | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);

  const json = useMemo(() => snapshot(meta, definition), [meta, definition]);
  const dirty = json !== savedJson;
  const latestJson = useRef(json);
  latestJson.current = json;

  const archived = doc.status === "archived";
  const published = doc.status === "published";
  const hasUnpublishedChanges = doc.version > 0 && (dirty || doc.draftRevision !== doc.publishedRevision);

  // ---------------------------------------------------------------- setup

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ categories: AssessmentCategory[] }>("/api/admin/assessments/categories")
      .then((res) => !cancelled && setCategories(res.categories))
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as TabId;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, []);

  const selectTab = useCallback((next: TabId) => {
    setTab(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // Hash updates are a convenience only.
    }
  }, []);

  // Leaving with unsaved edits: browser close/refresh and in-app link clicks.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm("You have unsaved changes that will be lost if you leave this page. Leave anyway?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // -------------------------------------------------------------- validation

  const checkCategories = useMemo<AssessmentCategory[]>(
    () => categories ?? [{ id: meta.category, name: "", order: 0 }],
    [categories, meta.category],
  );
  const local = useMemo(() => validateDefinition(definition, meta, checkCategories), [definition, meta, checkCategories]);
  const report = !dirty && publishReport ? { errors: mergeIssues(local.errors, publishReport.errors), warnings: mergeIssues(local.warnings, publishReport.warnings) } : local;

  const errorsByTab = useMemo(() => {
    const counts: Partial<Record<TabId, number>> = {};
    for (const issue of report.errors) {
      const t = locateIssue(definition, issue).tab;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [report.errors, definition]);

  const jumpTo = useCallback(
    (location: IssueLocation) => {
      selectTab(location.tab);
      if (location.tab === "questions") setFocus({ sectionId: location.sectionId, questionId: location.questionId, nonce: Date.now() });
    },
    [selectTab],
  );

  // ----------------------------------------------------------------- actions

  const explain = useCallback((error: unknown): Message => {
    if (error instanceof ApiClientError) {
      if (error.status === 409) {
        const stale = (error.details as { currentRevision?: number } | undefined)?.currentRevision !== undefined;
        return { tone: "error", text: error.message, reload: stale };
      }
      if (error.status === 401) return { tone: "error", text: "Your sign-in has expired. Please sign in again, then retry." };
      if (error.status === 403) return { tone: "error", text: error.message };
      if (error.status === 503) return { tone: "error", text: `${error.message} Check the server’s Firebase Admin settings (see docs/ASSESSMENTS.md).` };
      return { tone: "error", text: error.message };
    }
    return { tone: "error", text: "Something went wrong. Please try again." };
  }, []);

  /** Saves the working copy as the draft; resolves to the saved document or null on failure. */
  const persist = useCallback(async (): Promise<AssessmentDoc | null> => {
    const sentJson = latestJson.current;
    try {
      const res = await adminFetch<SaveResult>(`/api/admin/assessments/${doc.id}`, {
        method: "PUT",
        json: { meta, definition, baseRevision: doc.draftRevision },
      });
      const serverMeta = metaOf(res.assessment);
      setDoc(res.assessment);
      setSavedJson(snapshot(serverMeta, res.assessment.definition));
      // Adopt the server's normalised copy unless the admin kept typing while it saved.
      if (latestJson.current === sentJson) {
        setMeta(serverMeta);
        setDefinition(res.assessment.definition);
      }
      return res.assessment;
    } catch (error) {
      setMessage(explain(error));
      return null;
    }
  }, [doc.id, doc.draftRevision, meta, definition, explain]);

  const save = useCallback(async () => {
    if (busy || archived) return;
    setBusy("save");
    setMessage(null);
    const saved = await persist();
    if (saved) {
      setPublishReport(null);
      setMessage({ tone: "success", text: "Draft saved. Published versions are unchanged until you publish." });
    }
    setBusy(null);
  }, [busy, archived, persist]);

  const saveRef = useRef(save);
  saveRef.current = save;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function runAction(action: "publish" | "unpublish" | "archive" | "restore" | "duplicate") {
    const res = await adminFetch<SaveResult>(`/api/admin/assessments/${doc.id}/action`, { method: "POST", json: { action } });
    return res;
  }

  async function publish() {
    if (busy) return;
    if (report.errors.length) {
      setIssuesOpen(true);
      setMessage({ tone: "error", text: `Fix ${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} before publishing. They are listed below.` });
      document.getElementById("builder-issues")?.scrollIntoView({ block: "center" });
      return;
    }
    const reuse = doc.version > 0 && !dirty && doc.draftRevision === doc.publishedRevision;
    const nextVersion = reuse ? doc.version : doc.version + 1;
    const text = reuse
      ? `Make “${meta.title}” visible in the public library again?\n\nNothing has changed since version ${doc.version}, so no new version is created.`
      : `Publish “${meta.title}” as version ${nextVersion}?\n\nThis saves a permanent snapshot of the questions, scoring and results. People who start from now on get this version. Anyone who already completed an earlier version keeps the version they answered — their results never change.${published ? "\n\nThe version that is public now is replaced immediately." : ""}`;
    if (!window.confirm(text)) return;

    setBusy("publish");
    setMessage(null);
    try {
      if (dirty) {
        const saved = await persist();
        if (!saved) return;
      }
      const res = await runAction("publish");
      setDoc(res.assessment);
      setPublishReport(null);
      setMessage({ tone: "success", text: `Published as version ${res.assessment.version}. It is now in the public library.` });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 422) {
        setPublishReport(error.details as DefinitionReport);
        setIssuesOpen(true);
      }
      setMessage(explain(error));
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(action: "unpublish" | "archive" | "restore") {
    if (busy) return;
    const prompts = {
      unpublish: `Remove “${meta.title}” from the public library?\n\nIt stays as a draft. People who already completed it can still open their results.`,
      archive: `Archive “${meta.title}”?\n\nIt disappears from the public library and can’t be edited until you restore it. Existing results stay available to participants.`,
      restore: "",
    } as const;
    if (prompts[action] && !window.confirm(prompts[action])) return;
    setBusy("status");
    setMessage(null);
    try {
      const res = await runAction(action);
      setDoc(res.assessment);
      setMessage({
        tone: "success",
        text: action === "unpublish" ? "Unpublished. It’s now a draft." : action === "archive" ? "Archived." : "Restored as a draft.",
      });
    } catch (error) {
      setMessage(explain(error));
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    if (busy) return;
    setBusy("status");
    setMessage(null);
    try {
      if (dirty) {
        const saved = await persist();
        if (!saved) return;
      }
      const res = await runAction("duplicate");
      router.push(`/admin/assessments/${res.assessment.id}/edit`);
    } catch (error) {
      setMessage(explain(error));
    } finally {
      setBusy(null);
    }
  }

  async function reload() {
    if (dirty && !window.confirm("Reloading discards your unsaved edits. Continue?")) return;
    try {
      const res = await adminFetch<SaveResult>(`/api/admin/assessments/${doc.id}`);
      setDoc(res.assessment);
      setMeta(metaOf(res.assessment));
      setDefinition(res.assessment.definition);
      setSavedJson(snapshot(metaOf(res.assessment), res.assessment.definition));
      setPublishReport(null);
      setMessage({ tone: "info", text: "Loaded the latest saved draft." });
    } catch (error) {
      setMessage(explain(error));
    }
  }

  // -------------------------------------------------------------------- UI

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const move = (to: number) => {
      const next = TABS[(to + TABS.length) % TABS.length].id;
      selectTab(next);
      requestAnimationFrame(() => document.getElementById(`builder-tab-${next}`)?.focus());
    };
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(TABS.length - 1);
    }
  };

  const statusBadge = archived ? (
    <Badge>Archived</Badge>
  ) : published ? (
    <Badge tone="primary">Published · v{doc.version}</Badge>
  ) : (
    <Badge tone="gold">{doc.version > 0 ? `Draft · unpublished (last v${doc.version})` : "Draft"}</Badge>
  );

  return (
    <div className="space-y-5">
      {/* ---- sticky action bar ----------------------------------------------- */}
      <div className="sticky top-[69px] z-30 -mx-4 border-b border-primary/10 bg-bg/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {statusBadge}
            {hasUnpublishedChanges && !archived && <Badge tone="accent">Unpublished changes</Badge>}
            <span aria-live="polite" className={cx("text-xs font-medium", dirty ? "text-accent-ink" : "text-ink-soft")}>
              {busy === "save" ? "Saving…" : dirty ? "Unsaved edits" : "All changes saved"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={!dirty || busy !== null || archived} className="btn-outline px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
              {busy === "save" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
              Save draft
            </button>
            {!archived && (
              <button
                type="button"
                onClick={publish}
                disabled={busy !== null || (published && !hasUnpublishedChanges)}
                aria-disabled={report.errors.length > 0 || undefined}
                title={report.errors.length ? `${report.errors.length} problem(s) to fix first — click to see them` : undefined}
                className={cx("btn-primary px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0", report.errors.length > 0 && "opacity-70")}
              >
                {busy === "publish" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />}
                {published ? (hasUnpublishedChanges ? "Publish changes" : "Published") : "Publish"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-primary/10 pt-3 text-sm">
          {published && (
            <a href={`/assessments/${doc.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline">
              <ExternalLink aria-hidden="true" className="h-4 w-4" /> View public page<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          <Link href={`/admin/assessments/${doc.id}/submissions`} className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline">
            <FileText aria-hidden="true" className="h-4 w-4" /> Submissions
          </Link>
          <Link href={`/admin/assessments/${doc.id}/analytics`} className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline">
            <BarChart3 aria-hidden="true" className="h-4 w-4" /> Analytics
          </Link>
          <span className="hidden h-4 w-px bg-primary/20 sm:inline-block" aria-hidden="true" />
          <button type="button" onClick={duplicate} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline disabled:opacity-50">
            <Copy aria-hidden="true" className="h-4 w-4" /> Duplicate
          </button>
          {published && (
            <button type="button" onClick={() => changeStatus("unpublish")} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline disabled:opacity-50">
              <EyeOff aria-hidden="true" className="h-4 w-4" /> Unpublish
            </button>
          )}
          {archived ? (
            <button type="button" onClick={() => changeStatus("restore")} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-medium text-primary-dark underline-offset-4 hover:underline disabled:opacity-50">
              <Undo2 aria-hidden="true" className="h-4 w-4" /> Restore
            </button>
          ) : (
            <button type="button" onClick={() => changeStatus("archive")} disabled={busy !== null} className="inline-flex items-center gap-1.5 font-medium text-accent-ink underline-offset-4 hover:underline disabled:opacity-50">
              <Archive aria-hidden="true" className="h-4 w-4" /> Archive
            </button>
          )}
        </div>
      </div>

      {/* ---- messages -------------------------------------------------------- */}
      {message && (
        <Alert tone={message.tone} className="flex flex-wrap items-start justify-between gap-3">
          <span className="min-w-0 flex-1">{message.text}</span>
          <span className="flex items-center gap-2">
            {message.reload && (
              <button type="button" onClick={reload} className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-surface">
                Reload latest
              </button>
            )}
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message" className="rounded p-1 hover:bg-black/5">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
        </Alert>
      )}
      {archived && <Alert tone="warning">This assessment is archived: it is hidden from the public and read-only. Restore it to edit or publish again.</Alert>}

      <BuilderIssues errors={report.errors} warnings={report.warnings} definition={definition} open={issuesOpen} onToggle={() => setIssuesOpen((v) => !v)} onJump={jumpTo} />

      {/* ---- tabs ------------------------------------------------------------- */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Assessment sections" onKeyDown={onTabKey} className="flex min-w-max gap-1 border-b border-primary/15">
          {TABS.map((t) => {
            const selected = t.id === tab;
            const errorCount = errorsByTab[t.id] ?? 0;
            return (
              <button
                key={t.id}
                id={`builder-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`builder-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(t.id)}
                className={cx(
                  "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition",
                  selected ? "border-primary text-primary-dark" : "border-transparent text-ink-soft hover:text-primary-dark",
                )}
              >
                {t.label}
                {errorCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-ink px-1.5 text-xs font-bold text-white">
                    {errorCount}
                    <span className="sr-only"> problems</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <fieldset disabled={archived} className="m-0 min-w-0 border-0 p-0">
        <div role="tabpanel" id={`builder-panel-${tab}`} aria-labelledby={`builder-tab-${tab}`} tabIndex={0} className="focus:outline-none">
          {tab === "basics" && <BasicsEditor meta={meta} onChange={setMeta} categories={categories} slugLocked={doc.version > 0} />}
          {tab === "questions" && <QuestionsEditor definition={definition} onChange={setDefinition} focus={focus} onGoToTab={selectTab} />}
          {tab === "scoring" && <AdminScoringEditor definition={definition} onChange={setDefinition} />}
          {tab === "results" && <AdminResultBuilder definition={definition} onChange={setDefinition} />}
          {tab === "settings" && <AdminSettingsEditor definition={definition} onChange={setDefinition} />}
          {tab === "preview" && <PreviewPanel assessmentId={doc.id} meta={meta} definition={definition} />}
        </div>
      </fieldset>
    </div>
  );
}
