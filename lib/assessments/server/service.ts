import {
  blankMeta,
  countQuestions,
  DEFAULT_CATEGORIES,
  normalizeDefinition,
  normalizeMeta,
  validateDefinition,
  type DefinitionReport,
} from "../definition";
import { getTemplate } from "../templates";
import { newId, sanitizeText, slugify } from "../text";
import { computeResult } from "../scoring";
import { validateAnswers } from "../validation";
import type {
  AssessmentCategory,
  AssessmentDefinition,
  AssessmentDoc,
  AssessmentMeta,
  AssessmentResult,
  AssessmentVersionDoc,
  PublicSummary,
} from "../types";
import { COL, versionId } from "./config";
import { ApiError, badRequest, conflict, notFound, unprocessable } from "./http";
import type { DocStore } from "./store";

// Assessment CRUD, publishing and public reads. Every function takes the store
// explicitly so it can be exercised with an in-memory store in tests.

const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ categories

export async function listCategories(store: DocStore): Promise<AssessmentCategory[]> {
  let rows = await store.query<AssessmentCategory>(COL.categories);
  if (rows.length === 0) {
    // First use: seed the suggested categories. `create` keeps this safe if two requests race.
    await Promise.all(DEFAULT_CATEGORIES.map((c) => store.create(COL.categories, c.id, c)));
    rows = await store.query<AssessmentCategory>(COL.categories);
  }
  return rows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export async function saveCategories(store: DocStore, input: unknown): Promise<AssessmentCategory[]> {
  if (!Array.isArray(input) || input.length === 0 || input.length > 40) throw badRequest("Provide between 1 and 40 categories.");
  const seen = new Set<string>();
  const next: AssessmentCategory[] = input.map((raw, index) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = sanitizeText(r.name, 60);
    if (!name) throw badRequest("Every category needs a name.");
    const requestedId = typeof r.id === "string" && /^[a-z0-9-]{1,60}$/.test(r.id) ? r.id : "";
    let id = requestedId || slugify(name) || newId("cat");
    while (seen.has(id)) id = `${id}-${newId("x", 3)}`;
    seen.add(id);
    const description = sanitizeText(r.description, 200);
    return { id, name, order: index, ...(description ? { description } : {}) };
  });

  const current = await store.query<AssessmentCategory>(COL.categories);
  const removed = current.filter((c) => !seen.has(c.id));
  if (removed.length) {
    const used = await store.query<AssessmentDoc>(COL.assessments);
    const blocked = removed.filter((c) => used.some((a) => a.category === c.id));
    if (blocked.length) {
      throw conflict(`Move assessments out of "${blocked.map((b) => b.name).join('", "')}" before deleting ${blocked.length > 1 ? "those categories" : "that category"}.`);
    }
  }
  await Promise.all(removed.map((c) => store.delete(COL.categories, c.id)));
  await Promise.all(next.map((c) => store.set(COL.categories, c.id, c)));
  return next;
}

// ----------------------------------------------------------------------- admin

export interface AdminAssessmentSummary {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryName: string;
  status: AssessmentDoc["status"];
  version: number;
  hasUnpublishedChanges: boolean;
  tier: AssessmentDoc["tier"];
  estimatedMinutes: number;
  questionCount: number;
  submissionCount: number;
  updatedAt: string;
  publishedAt?: string;
  templateId?: string;
}

const metaOf = (doc: AssessmentDoc): AssessmentMeta => ({
  title: doc.title,
  slug: doc.slug,
  description: doc.description,
  category: doc.category,
  icon: doc.icon,
  tier: doc.tier,
  estimatedMinutes: doc.estimatedMinutes,
  ...(doc.thumbnailUrl ? { thumbnailUrl: doc.thumbnailUrl } : {}),
});

export async function listAssessments(store: DocStore): Promise<AdminAssessmentSummary[]> {
  const [docs, categories] = await Promise.all([store.query<AssessmentDoc>(COL.assessments), listCategories(store)]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const counts = await Promise.all(docs.map((d) => store.count(COL.submissions, [["assessmentId", d.id]])));
  return docs
    .map<AdminAssessmentSummary>((d, i) => ({
      id: d.id,
      title: d.title,
      slug: d.slug,
      category: d.category,
      categoryName: names.get(d.category) ?? "Uncategorised",
      status: d.status,
      version: d.version,
      hasUnpublishedChanges: d.version > 0 && d.draftRevision !== d.publishedRevision,
      tier: d.tier,
      estimatedMinutes: d.estimatedMinutes,
      questionCount: countQuestions(d.definition),
      submissionCount: counts[i],
      updatedAt: d.updatedAt,
      publishedAt: d.publishedAt,
      templateId: d.templateId,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getAssessment(store: DocStore, id: string): Promise<AssessmentDoc> {
  const doc = await store.get<AssessmentDoc>(COL.assessments, id);
  if (!doc) throw notFound("Assessment not found.");
  return doc;
}

async function slugTaken(store: DocStore, slug: string, exceptId?: string): Promise<boolean> {
  const rows = await store.query<AssessmentDoc>(COL.assessments, { where: [["slug", slug]], limit: 2 });
  return rows.some((r) => r.id !== exceptId);
}

async function uniqueSlug(store: DocStore, base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "assessment";
  let candidate = root;
  for (let i = 2; await slugTaken(store, candidate, exceptId); i++) candidate = `${root}-${i}`;
  return candidate;
}

export interface SaveResult {
  assessment: AssessmentDoc;
  report: DefinitionReport;
}

export async function reportFor(store: DocStore, doc: AssessmentDoc): Promise<DefinitionReport> {
  return validateDefinition(doc.definition, metaOf(doc), await listCategories(store));
}

export async function createAssessment(
  store: DocStore,
  body: { templateId?: unknown; title?: unknown },
  user: { email?: string; uid: string },
): Promise<SaveResult> {
  const template = getTemplate(typeof body.templateId === "string" ? body.templateId : "blank");
  if (!template) throw badRequest("Unknown template.");
  const { meta, definition } = template.build();
  const categories = await listCategories(store);
  const title = sanitizeText(body.title, 120) || meta.title;
  const base = normalizeMeta({ ...(template.id === "blank" ? blankMeta() : meta), title }, categories);
  base.slug = await uniqueSlug(store, template.id === "blank" ? title : meta.slug);

  const now = nowIso();
  const doc: AssessmentDoc = {
    ...base,
    id: newId("asm", 12),
    status: "draft",
    version: 0,
    draftRevision: 1,
    publishedRevision: 0,
    definition: normalizeDefinition(definition),
    templateId: template.id === "blank" ? undefined : template.id,
    createdAt: now,
    updatedAt: now,
    createdBy: user.email ?? user.uid,
  };
  await store.set(COL.assessments, doc.id, doc);
  return { assessment: doc, report: await reportFor(store, doc) };
}

export async function updateAssessment(
  store: DocStore,
  id: string,
  body: { meta?: unknown; definition?: unknown; baseRevision?: unknown },
): Promise<SaveResult> {
  const categories = await listCategories(store);
  const existing = await getAssessment(store, id);
  const proposed = normalizeMeta({ ...metaOf(existing), ...((body.meta as object) ?? {}) }, categories);
  if (!proposed.slug) proposed.slug = await uniqueSlug(store, proposed.title, id);
  else if (proposed.slug !== existing.slug && (await slugTaken(store, proposed.slug, id))) {
    throw conflict("Another assessment already uses that URL slug.");
  }
  const definition: AssessmentDefinition | undefined = body.definition === undefined ? undefined : normalizeDefinition(body.definition);
  const baseRevision = typeof body.baseRevision === "number" ? body.baseRevision : undefined;

  const saved = await store.transact<AssessmentDoc>(COL.assessments, id, (cur) => {
    if (!cur) throw notFound("Assessment not found.");
    if (cur.status === "archived") throw conflict("Restore this assessment before editing it.");
    if (baseRevision !== undefined && baseRevision !== cur.draftRevision) {
      throw conflict("This assessment was changed somewhere else. Reload to get the latest version before saving.", { currentRevision: cur.draftRevision });
    }
    if (cur.version > 0 && proposed.slug !== cur.slug) {
      throw conflict("The URL slug is locked once an assessment has been published, so existing links keep working.");
    }
    const next: AssessmentDoc = { ...cur, ...proposed, definition: definition ?? cur.definition, draftRevision: cur.draftRevision + 1, updatedAt: nowIso() };
    // A removed (or refused) thumbnail is simply absent from `proposed`, so it has to be dropped explicitly.
    if (!proposed.thumbnailUrl) delete next.thumbnailUrl;
    return next;
  });
  if (!saved) throw notFound("Assessment not found.");
  return { assessment: saved, report: await reportFor(store, saved) };
}

export async function duplicateAssessment(store: DocStore, id: string, user: { email?: string; uid: string }): Promise<SaveResult> {
  const source = await getAssessment(store, id);
  const now = nowIso();
  const title = `Copy of ${source.title}`.slice(0, 120);
  const doc: AssessmentDoc = {
    ...metaOf(source),
    title,
    slug: await uniqueSlug(store, `${source.slug}-copy`),
    id: newId("asm", 12),
    status: "draft",
    version: 0,
    draftRevision: 1,
    publishedRevision: 0,
    definition: normalizeDefinition(source.definition),
    templateId: source.templateId,
    createdAt: now,
    updatedAt: now,
    createdBy: user.email ?? user.uid,
  };
  await store.set(COL.assessments, doc.id, doc);
  return { assessment: doc, report: await reportFor(store, doc) };
}

function summaryOf(doc: AssessmentDoc, categoryName: string, version: number, publishedAt: string): PublicSummary {
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    categoryId: doc.category,
    categoryName,
    icon: doc.icon,
    tier: doc.tier,
    estimatedMinutes: doc.estimatedMinutes,
    ...(doc.thumbnailUrl ? { thumbnailUrl: doc.thumbnailUrl } : {}),
    questionCount: countQuestions(doc.definition),
    sectionCount: doc.definition.sections.length,
    version,
    publishedAt,
  };
}

export async function publishAssessment(store: DocStore, id: string, user: { email?: string; uid: string }): Promise<SaveResult> {
  const doc = await getAssessment(store, id);
  if (doc.status === "archived") throw conflict("Restore this assessment before publishing it.");
  const categories = await listCategories(store);
  const report = validateDefinition(doc.definition, metaOf(doc), categories);
  if (report.errors.length) {
    throw unprocessable(`Fix ${report.errors.length} problem${report.errors.length === 1 ? "" : "s"} before publishing.`, report);
  }
  if (await slugTaken(store, doc.slug, doc.id)) throw conflict("Another assessment already uses that URL slug.");
  const categoryName = categories.find((c) => c.id === doc.category)?.name ?? "Uncategorised";
  const now = nowIso();

  // Nothing changed since the last published version: re-publishing just makes it visible again.
  const unchanged = doc.version > 0 && doc.draftRevision === doc.publishedRevision;
  const version = unchanged ? doc.version : doc.version + 1;

  if (!unchanged) {
    const snapshot: AssessmentVersionDoc = {
      id: versionId(doc.id, version),
      assessmentId: doc.id,
      version,
      meta: { ...metaOf(doc), categoryName },
      definition: doc.definition,
      publishedAt: now,
      publishedBy: user.email ?? user.uid,
    };
    // Version documents are immutable: `create` refuses to overwrite an existing one.
    if (!(await store.create(COL.versions, snapshot.id, snapshot))) {
      throw conflict("Another publish is in progress. Please try again.");
    }
  }

  const snapshotRevision = doc.draftRevision;
  const saved = await store.transact<AssessmentDoc>(COL.assessments, id, (cur) => {
    if (!cur) throw notFound("Assessment not found.");
    return {
      ...cur,
      status: "published",
      version,
      publishedRevision: unchanged ? cur.publishedRevision : snapshotRevision,
      publishedAt: unchanged ? (cur.publishedAt ?? now) : now,
      published: unchanged && cur.published ? { ...cur.published } : summaryOf(doc, categoryName, version, now),
      updatedAt: now,
    };
  });
  if (!saved) throw notFound("Assessment not found.");
  return { assessment: saved, report };
}

export async function setStatus(store: DocStore, id: string, status: "draft" | "archived"): Promise<AssessmentDoc> {
  const saved = await store.transact<AssessmentDoc>(COL.assessments, id, (cur) => {
    if (!cur) throw notFound("Assessment not found.");
    return { ...cur, status, updatedAt: nowIso() };
  });
  if (!saved) throw notFound("Assessment not found.");
  return saved;
}

export const unpublishAssessment = (store: DocStore, id: string) => setStatus(store, id, "draft");
export const archiveAssessment = (store: DocStore, id: string) => setStatus(store, id, "archived");
export const restoreAssessment = (store: DocStore, id: string) => setStatus(store, id, "draft");

/**
 * Deletes an assessment. A published one has to be unpublished first, and one with responses is only deleted
 * when the caller says so explicitly (`withResponses`), which also deletes every answer, result, peer answer and
 * email record, every published version and the start counter. The error `code`s let the screen ask the right question.
 */
export async function deleteAssessment(store: DocStore, id: string, options: { withResponses?: boolean } = {}): Promise<{ deletedSubmissions: number }> {
  const doc = await getAssessment(store, id);
  if (doc.status === "published") {
    throw new ApiError(409, "published", "This assessment is published. Unpublish it before deleting it.");
  }
  const submissions = await store.query<{ id: string }>(COL.submissions, { where: [["assessmentId", id]] });
  if (submissions.length > 0 && !options.withResponses) {
    throw new ApiError(
      409,
      "has_submissions",
      `This assessment has ${submissions.length} response${submissions.length === 1 ? "" : "s"}. Deleting it also permanently deletes their answers, results and feedback.`,
      { submissions: submissions.length },
    );
  }
  const [peers, emails, versions] = await Promise.all([
    store.query<{ id: string }>(COL.peers, { where: [["assessmentId", id]] }),
    store.query<{ id: string }>(COL.emails, { where: [["assessmentId", id]] }),
    store.query<{ id: string }>(COL.versions, { where: [["assessmentId", id]] }),
  ]);
  await Promise.all([
    ...peers.map((p) => store.delete(COL.peers, p.id)),
    ...emails.map((e) => store.delete(COL.emails, e.id)),
    ...submissions.map((s) => store.delete(COL.submissions, s.id)),
  ]);
  await Promise.all(versions.map((v) => store.delete(COL.versions, v.id)));
  await store.delete(COL.stats, id);
  await store.delete(COL.assessments, id);
  return { deletedSubmissions: submissions.length };
}

/** Scores sample answers against the *draft*, with the same validation as a real submission. */
export async function previewScore(
  store: DocStore,
  id: string,
  answers: unknown,
): Promise<{ ok: boolean; errors: Record<string, string>; result: AssessmentResult | null }> {
  const doc = await getAssessment(store, id);
  const validation = validateAnswers(doc.definition, answers);
  if (!validation.ok) return { ok: false, errors: validation.errors, result: null };
  return { ok: true, errors: {}, result: computeResult(doc.definition, validation.clean) };
}

// ----------------------------------------------------------------- public reads

export async function listPublished(store: DocStore): Promise<PublicSummary[]> {
  const [docs, categories] = await Promise.all([
    store.query<AssessmentDoc>(COL.assessments, { where: [["status", "published"]] }),
    listCategories(store),
  ]);
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return docs
    .filter((d) => d.published)
    .map((d) => ({ ...(d.published as PublicSummary), categoryName: names.get(d.published!.categoryId) ?? d.published!.categoryName }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getVersion(store: DocStore, assessmentId: string, version: number): Promise<AssessmentVersionDoc | null> {
  return store.get<AssessmentVersionDoc>(COL.versions, versionId(assessmentId, version));
}

/** Returns the published assessment and its live version snapshot, or null. */
export async function getPublishedBySlug(
  store: DocStore,
  slug: string,
): Promise<{ summary: PublicSummary; version: AssessmentVersionDoc } | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const [doc] = await store.query<AssessmentDoc>(COL.assessments, { where: [["slug", slug], ["status", "published"]], limit: 1 });
  if (!doc?.published) return null;
  const version = await getVersion(store, doc.id, doc.version);
  if (!version) return null;
  const categories = await listCategories(store);
  const categoryName = categories.find((c) => c.id === doc.published!.categoryId)?.name ?? doc.published.categoryName;
  return { summary: { ...doc.published, categoryName }, version };
}

export async function recordStart(store: DocStore, assessmentId: string): Promise<void> {
  await store.transact<{ id: string; starts: number }>(COL.stats, assessmentId, (cur) => ({ id: assessmentId, starts: (cur?.starts ?? 0) + 1 }));
}

