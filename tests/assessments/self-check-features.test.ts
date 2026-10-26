import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { NextRequest } from "next/server";
import { GET as pdfRoute } from "../../app/api/assessments/results/[token]/pdf/route";
import { getQuestionStats, listSubmissions } from "../../lib/assessments/server/adminData";
import { COL } from "../../lib/assessments/server/config";
import { deliverResultEmail } from "../../lib/assessments/server/emailService";
import { ApiError } from "../../lib/assessments/server/http";
import { detectImageType, MAX_THUMBNAIL_BYTES } from "../../lib/assessments/server/imageUpload";
import { setMailProviderForTests, type MailMessage, type MailProvider, type SendOutcome } from "../../lib/assessments/server/mail";
import { createAssessment, deleteAssessment, listPublished, publishAssessment, updateAssessment } from "../../lib/assessments/server/service";
import { MemoryStore, setStoreForTests } from "../../lib/assessments/server/store";
import { getReportPdf, getResultView, resendResultEmail, submitAssessment } from "../../lib/assessments/server/submissions";
import { saveThumbnail, setThumbnailStorageForTests } from "../../lib/assessments/server/thumbnails";
import { charismaDefinition } from "../../lib/assessments/templates/charisma";
import type { Answers, AssessmentDoc, SubmissionDoc } from "../../lib/assessments/types";

const user = { uid: "u1", email: "admin@example.com" };
const wait = async () => {};

class FakeMail implements MailProvider {
  readonly name = "fake";
  sent: MailMessage[] = [];
  outcomes: SendOutcome[] = [];
  async send(message: MailMessage): Promise<SendOutcome> {
    const next = this.outcomes.shift() ?? { ok: true as const, messageId: "<m@test>" };
    if (next.ok) this.sent.push(message);
    return next;
  }
}

const charisma = charismaDefinition();
const questions = charisma.sections.flatMap((s) => s.questions);
function levels(by: Record<string, number>): Answers {
  const answers: Answers = {};
  for (const q of questions) {
    const level = by[q.scoring?.skillId ?? ""] ?? 3;
    answers[q.id] = q.scoring?.reverse ? 6 - level : level;
  }
  return answers;
}

let counter = 0;
const key = () => `key_${String(++counter).padStart(6, "0")}_abcdefghij`;
const body = (overrides: Record<string, unknown> = {}) => ({
  name: "Asha Verma",
  email: "asha@example.com",
  consent: { storeResponses: true, emailResults: false, shareWithPractice: false },
  answers: levels({ warmth: 5, competence: 2, dial: 4, footprint: 3 }),
  idempotencyKey: key(),
  ...overrides,
});

let store: MemoryStore;
let mail: FakeMail;

async function publishedCharisma(patch?: (doc: AssessmentDoc) => AssessmentDoc): Promise<AssessmentDoc> {
  const { assessment } = await createAssessment(store, { templateId: "charisma-diagnostic" }, user);
  if (patch) await store.set(COL.assessments, assessment.id, patch(assessment));
  return (await publishAssessment(store, assessment.id, user)).assessment;
}

beforeEach(() => {
  store = new MemoryStore();
  mail = new FakeMail();
  setMailProviderForTests(mail);
  setStoreForTests(store);
  setThumbnailStorageForTests(undefined);
});

const tokenOf = async (slug: string, overrides: Record<string, unknown> = {}) => (await submitAssessment(store, slug, body(overrides), { wait })).resultToken;

describe("the result page of a zone assessment", () => {
  it("returns the zone and the zone names, and none of the scoring set-up", async () => {
    const doc = await publishedCharisma();
    const view = await getResultView(store, await tokenOf(doc.slug));
    assert.equal(view.result.zone?.label, "Warm Zone");
    assert.deepEqual(Object.keys(view.zones ?? {}).sort(), ["bottomLeft", "bottomRight", "topLeft", "topRight"]);
    assert.equal(view.zones?.topRight.label, "Charisma Zone");
    assert.equal(view.results.headline, "You are in the {zone}.");
    assert.equal(view.results.eyebrow, "Your charisma map");
    assert.equal(view.result.practicePlan?.steps, true);
    const json = JSON.stringify(view);
    for (const secret of ["planItems", "xSkillId", "strengthText", "asha@example.com"]) assert.equal(json.includes(secret), false, secret);
  });
});

describe("the PDF report download", () => {
  const request = (token: string) => new NextRequest(`http://localhost/api/assessments/results/${token}/pdf`, { headers: { "x-forwarded-for": `203.0.113.${(counter % 200) + 1}` } });
  const call = (token: string) => pdfRoute(request(token), { params: { token } });

  it("answers with a private PDF named after the person, from their own link only", async () => {
    const doc = await publishedCharisma();
    const token = await tokenOf(doc.slug);
    const res = await call(token);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");
    assert.equal(res.headers.get("content-disposition"), 'attachment; filename="Charisma-Diagnostic-Asha-Verma-report.pdf"');
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.match(res.headers.get("x-robots-tag") ?? "", /noindex/);
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.equal(res.headers.get("content-length"), String(bytes.length));
    for (const wrong of ["short", "A".repeat(43)]) assert.equal((await call(wrong)).status, 404, wrong);
  });

  it("is refused when the version they answered did not offer it, while an earlier result keeps working", async () => {
    const doc = await publishedCharisma();
    const first = await tokenOf(doc.slug);
    const edited = charismaDefinition();
    edited.results.reportDownload = false;
    await updateAssessment(store, doc.id, { definition: edited });
    await publishAssessment(store, doc.id, user);
    const second = await tokenOf(doc.slug);
    assert.equal((await call(second)).status, 404);
    assert.equal((await call(first)).status, 200, "an earlier result keeps what its version offered");
    assert.equal((await getResultView(store, second)).results.reportDownload, false, "the page is told, so it hides the button");
    await assert.rejects(getReportPdf(store, second), (e: unknown) => e instanceof ApiError && e.status === 404);
  });
});

describe("the PDF attached to the result email", () => {
  const emailBody = () => body({ consent: { storeResponses: true, emailResults: true, shareWithPractice: false } });

  it("is attached with the person's file name, and the email says so and leads with the zone", async () => {
    const doc = await publishedCharisma();
    await submitAssessment(store, doc.slug, emailBody(), { wait });
    assert.equal(mail.sent.length, 1);
    const [message] = mail.sent;
    assert.equal(message.attachments?.length, 1);
    const [file] = message.attachments ?? [];
    assert.equal(file.filename, "Charisma-Diagnostic-Asha-Verma-report.pdf");
    assert.equal(file.contentType, "application/pdf");
    assert.equal(file.content.subarray(0, 5).toString("latin1"), "%PDF-");
    assert.match(message.text, /A PDF copy of your report is attached to this email\./);
    assert.match(message.html, /A PDF copy of your report is attached to this email\./);
    assert.match(message.text, /^ZONE: Warm Zone$/m);
    assert.doesNotMatch(message.text, /OVERALL SCORE/);
    assert.match(message.text, /^Day 1: /m);
    assert.match(message.text, /^Day 7: /m);
  });

  it("is left off when the admin switches it off", async () => {
    const doc = await publishedCharisma((d) => ({ ...d, definition: { ...d.definition, email: { ...d.definition.email, attachReport: false } } }));
    await submitAssessment(store, doc.slug, emailBody(), { wait });
    assert.equal(mail.sent[0].attachments, undefined);
    assert.doesNotMatch(mail.sent[0].text, /attached to this email/);
  });

  it("is still attached for an assessment saved before the option existed", async () => {
    const doc = await publishedCharisma((d) => {
      const definition = JSON.parse(JSON.stringify(d.definition));
      delete definition.email.attachReport;
      return { ...d, definition };
    });
    await submitAssessment(store, doc.slug, emailBody(), { wait });
    assert.equal(mail.sent[0].attachments?.length, 1);
  });

  it("is skipped, with the email still sent and not promising it, if the report cannot be made", async () => {
    const doc = await publishedCharisma();
    mail.outcomes = [{ ok: false, retryable: false, error: "refused" }];
    const submitted = await submitAssessment(store, doc.slug, emailBody(), { wait });
    assert.equal(submitted.email.status, "failed");
    // The result sections of the stored version are damaged: the report cannot be drawn, but the email does not read them.
    const [submission] = await store.query<SubmissionDoc>(COL.submissions);
    await store.transact<{ definition: { results: { components: unknown[] } } }>(COL.versions, submission.versionId, (cur) =>
      cur ? { ...cur, definition: { ...cur.definition, results: { ...cur.definition.results, components: [null] } } } : undefined,
    );
    const originalError = console.error;
    const logged: string[] = [];
    console.error = (...args: unknown[]) => void logged.push(args.join(" "));
    try {
      const later = new Date(Date.now() + 120_000);
      const state = await resendResultEmail(store, submitted.resultToken, {}, { wait, now: () => later });
      assert.equal(state.status, "sent");
    } finally {
      console.error = originalError;
    }
    assert.equal(mail.sent.length, 1);
    assert.equal(mail.sent[0].attachments, undefined);
    assert.doesNotMatch(mail.sent[0].text, /attached to this email/, "the email never promises a file it does not carry");
    assert.match(mail.sent[0].text, /^ZONE: Warm Zone$/m);
    assert.ok(logged.some((line) => /PDF report for a result email could not be made/.test(line)), "the failure is logged");
  });

  it("builds the attachment inside deliverResultEmail only for people who asked for the email", async () => {
    const doc = await publishedCharisma();
    await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(mail.sent.length, 0, "no email without the person's tick");
    const [submission] = await store.query<SubmissionDoc>(COL.submissions);
    const version = await store.get<never>(COL.versions, submission.versionId);
    const state = await deliverResultEmail(store, submission, version as never, { wait });
    assert.equal(state.status, "not_requested");
  });
});

describe("deleting an assessment", () => {
  it("is refused while it is published, and says so with a code the screen can use", async () => {
    const doc = await publishedCharisma();
    await assert.rejects(deleteAssessment(store, doc.id), (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === "published");
  });

  it("deletes a draft with no responses straight away", async () => {
    const { assessment } = await createAssessment(store, { templateId: "blank", title: "Scratch" }, user);
    assert.deepEqual(await deleteAssessment(store, assessment.id), { deletedSubmissions: 0 });
    assert.equal(await store.get(COL.assessments, assessment.id), null);
  });

  it("asks again when there are responses, and then removes them and everything that hangs off them", async () => {
    const doc = await publishedCharisma();
    await submitAssessment(store, doc.slug, body({ consent: { storeResponses: true, emailResults: true, shareWithPractice: false } }), { wait });
    await store.set(COL.stats, doc.id, { id: doc.id, starts: 3 });
    await store.set(COL.peers, "peer_1", { id: "peer_1", assessmentId: doc.id, submissionId: "x" });
    // Unpublish by archiving through the store so it can be deleted.
    await store.set(COL.assessments, doc.id, { ...(await store.get<AssessmentDoc>(COL.assessments, doc.id)), status: "archived" });

    await assert.rejects(
      deleteAssessment(store, doc.id),
      (e: unknown) => e instanceof ApiError && e.code === "has_submissions" && (e.details as { submissions: number }).submissions === 1 && /1 response\b/.test(e.message),
    );
    assert.ok(await store.get(COL.assessments, doc.id), "nothing is deleted by the first attempt");

    assert.deepEqual(await deleteAssessment(store, doc.id, { withResponses: true }), { deletedSubmissions: 1 });
    for (const collection of [COL.assessments, COL.versions, COL.submissions, COL.peers, COL.emails, COL.stats]) {
      assert.equal((await store.query(collection)).length, 0, `${collection} is empty`);
    }
  });
});

describe("searching and filtering submissions", () => {
  async function seed(mode: "full" | "consented_only" | "anonymous" = "full") {
    // Notifying the practice is what offers people the "share my results" box in a full-visibility assessment.
    const doc = await publishedCharisma((d) => ({
      ...d,
      definition: { ...d.definition, privacy: { adminViewMode: mode }, email: { ...d.definition.email, adminNotify: { enabled: true, recipients: ["owner@example.com"] } } },
    }));
    let minute = 0;
    const people: Array<[string, string, Record<string, number>, boolean]> = [
      ["Asha Verma", "asha@example.com", { warmth: 5, competence: 2 }, true],
      ["Ravi Menon", "ravi@sample.org", { warmth: 5, competence: 5 }, false],
      ["Neha Kapoor", "neha@example.com", { warmth: 2, competence: 2 }, true],
    ];
    for (const [name, email, by, shares] of people) {
      minute += 1;
      await submitAssessment(store, doc.slug, body({ name, email, answers: levels(by), consent: { storeResponses: true, emailResults: false, shareWithPractice: shares } }), { wait, now: () => new Date(Date.UTC(2026, 9, 25, 5, minute)) });
    }
    return doc;
  }

  it("finds people by name or email, in any case, and by zone, sharing and email status", async () => {
    const doc = await seed();
    const names = async (filters: Parameters<typeof listSubmissions>[2]) => (await listSubmissions(store, doc.id, filters)).rows.map((r) => r.name).sort();
    assert.deepEqual(await names({ q: "ASHA" }), ["Asha Verma"]);
    assert.deepEqual(await names({ q: "sample.org" }), ["Ravi Menon"]);
    assert.deepEqual(await names({ level: "Building Zone" }), ["Neha Kapoor"]);
    assert.deepEqual(await names({ shared: true }), ["Asha Verma", "Neha Kapoor"]);
    assert.deepEqual(await names({ email: "not_requested" }), ["Asha Verma", "Neha Kapoor", "Ravi Menon"]);
    assert.deepEqual(await names({ email: "failed" }), []);
    const all = await listSubmissions(store, doc.id, {});
    assert.deepEqual([all.total, all.overall], [3, 3]);
    assert.deepEqual(all.levels, ["Building Zone", "Charisma Zone", "Warm Zone"]);
    const filtered = await listSubmissions(store, doc.id, { q: "example.com" });
    assert.deepEqual([filtered.total, filtered.overall], [2, 3]);
  });

  it("shows the zone in the result column and orders by score", async () => {
    const doc = await seed();
    const rows = (await listSubmissions(store, doc.id, { sort: "newest" })).rows;
    assert.equal(rows[0].level, "Building Zone");
    const oldest = (await listSubmissions(store, doc.id, { sort: "oldest" })).rows;
    assert.equal(oldest[0].name, "Asha Verma");
  });

  it("never lets a search reach what the privacy mode hides", async () => {
    const doc = await seed("anonymous");
    const result = await listSubmissions(store, doc.id, { q: "asha" });
    assert.equal(result.total, 0);
    assert.ok((await listSubmissions(store, doc.id, {})).rows.every((r) => r.name === undefined && r.address === undefined));
    const consented = await seed("consented_only");
    assert.deepEqual((await listSubmissions(store, consented.id, { q: "ravi" })).rows, [], "Ravi did not agree to share, so he cannot be found by name");
    assert.deepEqual((await listSubmissions(store, consented.id, { q: "asha" })).rows.map((r) => r.name), ["Asha Verma"]);
  });
});

describe("how each question went", () => {
  it("averages every scored question on a 0–100 scale after reverse scoring, lowest first", async () => {
    const doc = await publishedCharisma();
    const reverse = questions.find((q) => q.scoring?.reverse)!;
    const plain = questions.find((q) => !q.scoring?.reverse)!;
    for (const [warmth, name] of [[5, "A"], [1, "B"]] as const) {
      await submitAssessment(store, doc.slug, body({ name, email: `${name}@example.com`, answers: { ...levels({ warmth }), [plain.id]: warmth, [reverse.id]: 5 } }), { wait });
    }
    const stats = await getQuestionStats(store, doc.id);
    assert.equal(stats.submissions, 2);
    assert.equal(stats.questions.length, 34);
    const find = (id: string) => stats.questions.find((q) => q.questionId === id)!;
    assert.equal(find(plain.id).average, 50, "(100 + 0) / 2");
    assert.equal(find(reverse.id).average, 0, "a 5 on a reverse-worded statement counts as 0");
    assert.equal(find(plain.id).answered, 2);
    assert.ok(stats.questions.every((q, i) => i === 0 || q.average >= stats.questions[i - 1].average), "lowest first");
    assert.ok(stats.questions[0].skill, "the skill is named");
  });

  it("has nothing to say before anyone has answered", async () => {
    const doc = await publishedCharisma();
    assert.deepEqual(await getQuestionStats(store, doc.id), { submissions: 0, questions: [] });
  });
});

describe("thumbnails", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);

  it("recognises pictures by their first bytes, and nothing else", () => {
    assert.deepEqual(detectImageType(PNG), { contentType: "image/png", extension: "png" });
    assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.extension, "jpg");
    assert.equal(detectImageType(Buffer.from("GIF89a...."))?.extension, "gif");
    assert.equal(detectImageType(Buffer.from("RIFF....WEBPVP8 "))?.extension, "webp");
    assert.equal(detectImageType(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")), null);
    assert.equal(detectImageType(Buffer.from("MZ executable")), null);
    assert.equal(detectImageType(new Uint8Array()), null);
    assert.ok(MAX_THUMBNAIL_BYTES >= 1024 * 1024);
  });

  it("stores each picture under a random name and returns the address", async () => {
    const saved: Array<{ path: string; contentType: string; size: number }> = [];
    setThumbnailStorageForTests({
      async save(path, bytes, kind) {
        saved.push({ path, contentType: kind.contentType, size: bytes.length });
        return `https://firebasestorage.googleapis.com/v0/b/test/o/${encodeURIComponent(path)}?alt=media&token=t`;
      },
    });
    const a = await saveThumbnail(PNG, { contentType: "image/png", extension: "png" });
    const b = await saveThumbnail(PNG, { contentType: "image/png", extension: "png" });
    assert.notEqual(a, b);
    assert.match(saved[0].path, /^assessment-thumbnails\/[0-9a-f]{24}\.png$/);
    assert.equal(saved[0].contentType, "image/png");
  });

  it("without Firebase credentials says so instead of failing obscurely", async () => {
    const keep = { json: process.env.FIREBASE_SERVICE_ACCOUNT_JSON, email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, creds: process.env.GOOGLE_APPLICATION_CREDENTIALS };
    delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    process.env.ASSESSMENT_IGNORE_EMBEDDED_KEY = "1"; // the key kept in source would otherwise count as credentials
    try {
      await assert.rejects(saveThumbnail(PNG, { contentType: "image/png", extension: "png" }), (e: unknown) => e instanceof ApiError && e.status === 503 && /credentials/.test(e.message));
    } finally {
      delete process.env.ASSESSMENT_IGNORE_EMBEDDED_KEY;
      if (keep.json !== undefined) process.env.FIREBASE_SERVICE_ACCOUNT_JSON = keep.json;
      if (keep.email !== undefined) process.env.FIREBASE_ADMIN_CLIENT_EMAIL = keep.email;
      if (keep.creds !== undefined) process.env.GOOGLE_APPLICATION_CREDENTIALS = keep.creds;
    }
  });

  it("reach the library card through publishing, and survive an edit that does not mention them", async () => {
    const url = "https://firebasestorage.googleapis.com/v0/b/test/o/assessment-thumbnails%2Fabc.png?alt=media&token=t";
    const { assessment } = await createAssessment(store, { templateId: "charisma-diagnostic" }, user);
    await updateAssessment(store, assessment.id, { meta: { thumbnailUrl: url } });
    const afterEdit = await updateAssessment(store, assessment.id, { meta: { title: "Charisma Diagnostic 2" } });
    assert.equal(afterEdit.assessment.thumbnailUrl, url, "an edit of the title keeps the picture");
    await publishAssessment(store, assessment.id, user);
    assert.equal((await listPublished(store))[0].thumbnailUrl, url);
    const removed = await updateAssessment(store, assessment.id, { meta: { thumbnailUrl: "" } });
    assert.equal(removed.assessment.thumbnailUrl, undefined);
    const foreign = await updateAssessment(store, assessment.id, { meta: { thumbnailUrl: "https://evil.example/x.png" } });
    assert.equal(foreign.assessment.thumbnailUrl, undefined, "only our own storage addresses are kept");
  });
});
