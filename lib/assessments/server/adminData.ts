import { computeVisibility, flattenQuestions, isAnswered } from "../conditions";
import { isScorableType, normalizeAnswer } from "../scoring";
import type {
  AdminViewMode,
  AssessmentDoc,
  AssessmentVersionDoc,
  EmailRecordDoc,
  PeerResponseDoc,
  SubmissionDoc,
  SubmissionEmailState,
} from "../types";
import { COL } from "./config";
import { deliverAdminNotification, deliverResultEmail, type DeliveryOptions } from "./emailService";
import { ApiError, conflict, notFound } from "./http";
import { getAssessment, listAssessments } from "./service";
import { describeEmail } from "./submissions";
import type { DocStore } from "./store";

// Admin-facing reads over submissions. What an admin may see about a person is
// governed by the assessment's privacy mode:
//   full            names, emails, answers
//   consented_only  names, emails, answers only for people who agreed to share with the practice
//   anonymous       scores only
//   none            no per-submission listing at all (aggregate analytics only)

function canSeeIdentity(mode: AdminViewMode, submission: SubmissionDoc): boolean {
  return mode === "full" || (mode === "consented_only" && submission.consent.shareWithPractice);
}

export interface SubmissionRow {
  id: string;
  createdAt: string;
  version: number;
  overall: number | null;
  level: string | null;
  email: { status: SubmissionEmailState["status"]; message: string };
  sharedWithPractice: boolean;
  /** Present only when the privacy mode allows it. */
  name?: string;
  address?: string;
}

function toRow(mode: AdminViewMode, s: SubmissionDoc): SubmissionRow {
  const identity = canSeeIdentity(mode, s);
  return {
    id: s.id,
    createdAt: s.createdAt,
    version: s.version,
    overall: s.result.overall,
    level: s.result.zone?.label ?? s.result.level?.label ?? null,
    email: { status: s.email.status, message: describeEmail(s.email) },
    sharedWithPractice: s.consent.shareWithPractice,
    ...(identity ? { name: s.respondent.name, address: s.respondent.email } : {}),
  };
}

async function allSubmissions(store: DocStore, assessmentId: string): Promise<SubmissionDoc[]> {
  const rows = await store.query<SubmissionDoc>(COL.submissions, { where: [["assessmentId", assessmentId]] });
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const SUBMISSION_SORTS = ["newest", "oldest", "score_desc", "score_asc"] as const;
export type SubmissionSort = (typeof SUBMISSION_SORTS)[number];

export interface SubmissionFilters {
  limit?: number;
  offset?: number;
  /** Words to look for in the name and email address (only for people the privacy mode lets you identify). */
  q?: string;
  /** One email status, for example "failed". */
  email?: SubmissionEmailState["status"];
  /** The label of a result level, or a zone's name. */
  level?: string;
  /** Only people who agreed to share their results with the practice. */
  shared?: boolean;
  sort?: SubmissionSort;
}

const labelOf = (s: SubmissionDoc) => s.result.zone?.label ?? s.result.level?.label ?? null;

export async function listSubmissions(store: DocStore, assessmentId: string, opts: SubmissionFilters = {}) {
  const doc = await getAssessment(store, assessmentId);
  const mode = doc.definition.privacy.adminViewMode;
  if (mode === "none") {
    throw new ApiError(403, "privacy", "Listing individual submissions is switched off in this assessment's privacy settings.");
  }
  const all = await allSubmissions(store, assessmentId);
  const needle = (opts.q ?? "").trim().toLowerCase();
  let rows = all.filter((s) => {
    if (opts.email && s.email.status !== opts.email) return false;
    if (opts.level && labelOf(s) !== opts.level) return false;
    if (opts.shared && !s.consent.shareWithPractice) return false;
    if (needle) {
      // Search never reaches what the privacy mode hides: an anonymous row can't be found by its name.
      if (!canSeeIdentity(mode, s)) return false;
      if (!`${s.respondent.name} ${s.respondent.email}`.toLowerCase().includes(needle)) return false;
    }
    return true;
  });
  const score = (s: SubmissionDoc) => s.result.overall ?? -1;
  if (opts.sort === "oldest") rows = [...rows].reverse();
  else if (opts.sort === "score_desc") rows = [...rows].sort((a, b) => score(b) - score(a) || b.createdAt.localeCompare(a.createdAt));
  else if (opts.sort === "score_asc") rows = [...rows].sort((a, b) => score(a) - score(b) || b.createdAt.localeCompare(a.createdAt));
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const levels = [...new Set(all.map(labelOf).filter((l): l is string => Boolean(l)))].sort((a, b) => a.localeCompare(b));
  return { mode, total: rows.length, overall: all.length, levels, offset, limit, rows: rows.slice(offset, offset + limit).map((s) => toRow(mode, s)) };
}

export interface QuestionStat {
  questionId: string;
  question: string;
  skill?: string;
  /** Average of the answers, 0–100 after reverse scoring. */
  average: number;
  /** How many people answered it. */
  answered: number;
}

/**
 * How each scored question went across everyone who took the assessment: the average answer on a 0–100 scale
 * (after reverse scoring), lowest first. Anonymous: no names, only totals, so every privacy mode allows it.
 */
export async function getQuestionStats(store: DocStore, assessmentId: string): Promise<{ submissions: number; questions: QuestionStat[] }> {
  await getAssessment(store, assessmentId);
  const submissions = await allSubmissions(store, assessmentId);
  const versions = new Map<string, AssessmentVersionDoc | null>();
  for (const s of submissions) {
    if (!versions.has(s.versionId)) versions.set(s.versionId, await store.get<AssessmentVersionDoc>(COL.versions, s.versionId));
  }
  const totals = new Map<string, { question: string; skill?: string; sum: number; n: number; version: number }>();
  for (const s of submissions) {
    const version = versions.get(s.versionId);
    if (!version) continue;
    const def = version.definition;
    const visible = computeVisibility(def.sections, s.answers).questions;
    const skillNames = new Map(def.scoring.skills.map((k) => [k.id, k.name]));
    for (const q of flattenQuestions(def.sections)) {
      if (!q.scoring?.scored || !isScorableType(q.type) || !visible[q.id] || !isAnswered(s.answers[q.id])) continue;
      const normalized = normalizeAnswer(q, s.answers[q.id]);
      if (normalized === null) continue;
      const value = (q.scoring.reverse ? 1 - normalized : normalized) * 100;
      const entry = totals.get(q.id) ?? { question: q.label, skill: undefined, sum: 0, n: 0, version: 0 };
      entry.sum += value;
      entry.n += 1;
      // Show the wording of the newest version that asked the question.
      if (version.version >= entry.version) {
        entry.version = version.version;
        entry.question = q.scoring.habit || q.label;
        entry.skill = q.scoring.skillId ? skillNames.get(q.scoring.skillId) : undefined;
      }
      totals.set(q.id, entry);
    }
  }
  const questions = [...totals.entries()]
    .map(([questionId, t]) => ({ questionId, question: t.question, ...(t.skill ? { skill: t.skill } : {}), average: Math.round(t.sum / t.n), answered: t.n }))
    .sort((a, b) => a.average - b.average || a.question.localeCompare(b.question));
  return { submissions: submissions.length, questions };
}

export async function getSubmissionDetail(store: DocStore, assessmentId: string, submissionId: string) {
  const doc = await getAssessment(store, assessmentId);
  const mode = doc.definition.privacy.adminViewMode;
  if (mode === "none") throw new ApiError(403, "privacy", "Individual submissions are switched off in this assessment's privacy settings.");
  const submission = await store.get<SubmissionDoc>(COL.submissions, submissionId);
  if (!submission || submission.assessmentId !== assessmentId) throw notFound("Submission not found.");
  const version = await store.get<AssessmentVersionDoc>(COL.versions, submission.versionId);
  const identity = canSeeIdentity(mode, submission);

  // Answers are shown with the wording of the version the participant actually saw.
  const answers = identity && version
    ? flattenQuestions(version.definition.sections)
        .filter((q) => q.type !== "info" && submission.answers[q.id] !== undefined)
        .map((q) => {
          const value = submission.answers[q.id];
          const labels = q.choices ? new Map(q.choices.map((c) => [c.id, c.label])) : null;
          const display = Array.isArray(value)
            ? value.map((v) => labels?.get(v) ?? v).join(", ")
            : labels
              ? (labels.get(String(value)) ?? String(value))
              : String(value);
          return { questionId: q.id, question: q.label, answer: display };
        })
    : null;

  const peerCount = await store.count(COL.peers, [["submissionId", submissionId]]);
  const note = await store.get<EmailRecordDoc>(COL.emails, `${submissionId}_admin`);
  return {
    ...toRow(mode, submission),
    result: submission.result,
    answers,
    peerResponses: peerCount,
    emailError: submission.email.error,
    emailAttempts: submission.email.attempts,
    /** How the note to the practice went (null when none was made, e.g. for older submissions). */
    practiceNote: note ? { status: note.status, error: note.status === "failed" ? note.error : undefined } : null,
  };
}

export async function retrySubmissionEmail(store: DocStore, assessmentId: string, submissionId: string, options: DeliveryOptions = {}) {
  const submission = await store.get<SubmissionDoc>(COL.submissions, submissionId);
  if (!submission || submission.assessmentId !== assessmentId) throw notFound("Submission not found.");
  if (!submission.consent.emailResults) throw conflict("This participant didn't ask for their results by email.");
  const version = await store.get<AssessmentVersionDoc>(COL.versions, submission.versionId);
  if (!version) throw notFound("Assessment version not found.");
  const state = await deliverResultEmail(store, submission, version, options);
  // The note to the practice is sent again only if it failed or was interrupted; one that went out is never repeated.
  try {
    await deliverAdminNotification(store, submission, version, { ...options, retryOnly: true });
  } catch (error) {
    console.error("[assessments] Retrying the note to the practice failed:", error instanceof Error ? error.message : "unknown error");
  }
  return { status: state.status, message: describeEmail(state) };
}

/** Deletes one participant's data (answers, result, peer answers, email records), e.g. on request. */
export async function deleteSubmission(store: DocStore, assessmentId: string, submissionId: string): Promise<void> {
  const submission = await store.get<SubmissionDoc>(COL.submissions, submissionId);
  if (!submission || submission.assessmentId !== assessmentId) throw notFound("Submission not found.");
  const peers = await store.query<PeerResponseDoc>(COL.peers, { where: [["submissionId", submissionId]] });
  await Promise.all(peers.map((p) => store.delete(COL.peers, p.id)));
  await Promise.all([`${submissionId}_result`, `${submissionId}_admin`].map((id) => store.delete(COL.emails, id)));
  await store.delete(COL.submissions, submissionId);
}

// ------------------------------------------------------------------ analytics

const BUCKETS = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9 }));

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function getAssessmentAnalytics(store: DocStore, assessmentId: string, now = new Date()) {
  const doc = await getAssessment(store, assessmentId);
  const mode = doc.definition.privacy.adminViewMode;
  const [submissions, stats] = await Promise.all([
    allSubmissions(store, assessmentId),
    store.get<{ starts: number }>(COL.stats, assessmentId),
  ]);
  const scored = submissions.filter((s) => s.result.overall !== null);
  const emailStatus: Record<SubmissionEmailState["status"], number> = { not_requested: 0, pending: 0, sent: 0, failed: 0, not_configured: 0 };
  for (const s of submissions) emailStatus[s.email.status] += 1;

  const skillTotals = new Map<string, { name: string; sum: number; n: number }>();
  for (const s of scored) {
    for (const skill of s.result.skills) {
      if (skill.score === null) continue;
      const t = skillTotals.get(skill.id) ?? { name: skill.name, sum: 0, n: 0 };
      t.sum += skill.score;
      t.n += 1;
      skillTotals.set(skill.id, t);
    }
  }

  const days: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) days[dayKey(new Date(now.getTime() - i * 86_400_000).toISOString())] = 0;
  for (const s of submissions) {
    const k = dayKey(s.createdAt);
    if (k in days) days[k] += 1;
  }

  const versions = new Map<number, number>();
  for (const s of submissions) versions.set(s.version, (versions.get(s.version) ?? 0) + 1);

  const starts = stats?.starts ?? 0;
  return {
    totals: {
      submissions: submissions.length,
      starts,
      // Starts are anonymous counters taken when someone begins; not every start is a person.
      completionRate: starts > 0 ? Math.min(100, Math.round((submissions.length / starts) * 100)) : null,
      averageScore: scored.length ? Math.round(scored.reduce((s, x) => s + (x.result.overall as number), 0) / scored.length) : null,
      consentedToShare: submissions.filter((s) => s.consent.shareWithPractice).length,
    },
    distribution: BUCKETS.map((b) => ({
      range: `${b.from}–${b.to}`,
      count: scored.filter((s) => (s.result.overall as number) >= b.from && (s.result.overall as number) <= b.to).length,
    })),
    skills: [...skillTotals.entries()].map(([id, t]) => ({ id, name: t.name, average: Math.round(t.sum / t.n), responses: t.n })),
    emailStatus,
    byDay: Object.entries(days).map(([date, count]) => ({ date, count })),
    versions: [...versions.entries()].sort((a, b) => a[0] - b[0]).map(([version, count]) => ({ version, count })),
    privacyMode: mode,
    recent: mode === "none" ? [] : submissions.slice(0, 10).map((s) => toRow(mode, s)),
  };
}

export async function getOverview(store: DocStore) {
  const summaries = await listAssessments(store);
  const docs = await store.query<AssessmentDoc>(COL.assessments);
  const modes = new Map(docs.map((d) => [d.id, d.definition.privacy.adminViewMode]));
  const titles = new Map(docs.map((d) => [d.id, d.title]));

  const recent: Array<SubmissionRow & { assessmentId: string; assessmentTitle: string }> = [];
  const allSubs = await Promise.all(docs.map((d) => allSubmissions(store, d.id)));
  allSubs.forEach((subs, i) => {
    const mode = modes.get(docs[i].id) ?? "consented_only";
    if (mode === "none") return;
    for (const s of subs.slice(0, 10)) recent.push({ ...toRow(mode, s), assessmentId: s.assessmentId, assessmentTitle: titles.get(s.assessmentId) ?? "" });
  });
  recent.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    totals: {
      assessments: summaries.length,
      published: summaries.filter((a) => a.status === "published").length,
      drafts: summaries.filter((a) => a.status === "draft").length,
      archived: summaries.filter((a) => a.status === "archived").length,
      submissions: summaries.reduce((s, a) => s + a.submissionCount, 0),
    },
    perAssessment: summaries.map((a) => ({ id: a.id, title: a.title, status: a.status, submissions: a.submissionCount })),
    recent: recent.slice(0, 10),
  };
}
