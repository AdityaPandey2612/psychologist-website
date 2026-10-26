import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import type { Answers, AssessmentDoc } from "../../lib/assessments/types";
import { getOverview, getAssessmentAnalytics, getSubmissionDetail, listSubmissions, retrySubmissionEmail, deleteSubmission } from "../../lib/assessments/server/adminData";
import { isMailConfigured, setMailProviderForTests, type MailMessage, type MailProvider, type SendOutcome } from "../../lib/assessments/server/mail";
import { toPublicForm } from "../../lib/assessments/definition";
import {
  createAssessment,
  duplicateAssessment,
  getPublishedBySlug,
  listCategories,
  listPublished,
  publishAssessment,
  saveCategories,
  unpublishAssessment,
  updateAssessment,
  deleteAssessment,
  archiveAssessment,
  previewScore,
} from "../../lib/assessments/server/service";
import { getPeerForm, getResultView, resendResultEmail, setPeerEnabled, submitAssessment, submitPeerResponse } from "../../lib/assessments/server/submissions";
import { MemoryStore } from "../../lib/assessments/server/store";
import { ApiError } from "../../lib/assessments/server/http";

const user = { uid: "u1", email: "admin@example.com" };
const wait = async () => {};

class FakeMail implements MailProvider {
  readonly name = "fake";
  sent: MailMessage[] = [];
  outcomes: SendOutcome[] = [];
  calls = 0;
  async send(message: MailMessage): Promise<SendOutcome> {
    this.calls += 1;
    const next = this.outcomes.shift() ?? { ok: true as const, messageId: `<m${this.calls}@test>` };
    if (next.ok) this.sent.push(message);
    return next;
  }
}

function bestAnswers(where: "work" | "home" | "both" = "both", invite = false): Answers {
  const def = listeningDefinition();
  const answers: Answers = { q_self_rating: 4, q_where: where };
  for (const q of def.sections.flatMap((s) => s.questions)) {
    if (q.type === "rating5" && q.scoring?.scored) answers[q.id] = q.scoring.reverse ? 1 : 5;
  }
  if (invite) answers.q_peer_invite = "yes";
  return answers;
}

let counter = 0;
const key = () => `key_${String(++counter).padStart(6, "0")}_abcdefghij`;

function submitBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Asha Verma",
    email: "Asha@Example.com",
    consent: { storeResponses: true, emailResults: true, shareWithPractice: false },
    answers: bestAnswers(),
    idempotencyKey: key(),
    ...overrides,
  };
}

async function publishedListening(store: MemoryStore): Promise<AssessmentDoc> {
  const { assessment } = await createAssessment(store, { templateId: "listening-self-reflection" }, user);
  const { assessment: published } = await publishAssessment(store, assessment.id, user);
  return published;
}

let store: MemoryStore;
let mail: FakeMail;

beforeEach(() => {
  store = new MemoryStore();
  mail = new FakeMail();
  setMailProviderForTests(mail);
});

describe("categories", () => {
  it("seeds the suggested categories and blocks deleting one in use", async () => {
    const cats = await listCategories(store);
    assert.deepEqual(cats.map((c) => c.name).slice(0, 3), ["Listening Skills", "Communication", "Emotional Awareness"]);
    assert.equal(cats.length, 7);
    await createAssessment(store, { templateId: "listening-self-reflection" }, user);
    await assert.rejects(saveCategories(store, cats.filter((c) => c.id !== "listening-skills")), (e: unknown) => e instanceof ApiError && e.status === 409);
    const renamed = await saveCategories(store, cats.map((c) => (c.id === "communication" ? { ...c, name: "Talking" } : c)));
    assert.equal(renamed.find((c) => c.id === "communication")?.name, "Talking");
  });
});

describe("assessment lifecycle", () => {
  it("creates the template as an unpublished draft that is not publicly visible", async () => {
    const { assessment, report } = await createAssessment(store, { templateId: "listening-self-reflection" }, user);
    assert.equal(assessment.status, "draft");
    assert.equal(assessment.version, 0);
    assert.deepEqual(report.errors, []);
    assert.equal((await listPublished(store)).length, 0);
    assert.equal(await getPublishedBySlug(store, assessment.slug), null);
  });

  it("refuses to publish an assessment with validation errors", async () => {
    const { assessment } = await createAssessment(store, { templateId: "blank", title: "Empty one" }, user);
    await assert.rejects(publishAssessment(store, assessment.id, user), (e: unknown) => e instanceof ApiError && e.status === 422);
  });

  it("publishes, lists and unpublishes", async () => {
    const doc = await publishedListening(store);
    assert.equal(doc.status, "published");
    assert.equal(doc.version, 1);
    const list = await listPublished(store);
    assert.equal(list.length, 1);
    assert.equal(list[0].questionCount, 26); // information blocks are not questions
    assert.equal(list[0].categoryName, "Listening Skills");
    await unpublishAssessment(store, doc.id);
    assert.equal((await listPublished(store)).length, 0);
    assert.equal(await getPublishedBySlug(store, doc.slug), null);
  });

  it("keeps older versions intact when the draft changes and is re-published", async () => {
    const doc = await publishedListening(store);
    const v1 = await getPublishedBySlug(store, doc.slug);
    const def = structuredClone(doc.definition);
    def.sections[1].questions[0].label = "CHANGED WORDING";
    def.scoring.levels[3].min = 90;
    const { assessment: edited } = await updateAssessment(store, doc.id, { definition: def, baseRevision: doc.draftRevision });
    // The public version is still v1 until re-published.
    const stillV1 = await getPublishedBySlug(store, doc.slug);
    assert.equal(stillV1?.version.version, 1);
    assert.notEqual(stillV1?.version.definition.sections[1].questions[0].label, "CHANGED WORDING");
    const { assessment: v2doc } = await publishAssessment(store, edited.id, user);
    assert.equal(v2doc.version, 2);
    const v2 = await getPublishedBySlug(store, doc.slug);
    assert.equal(v2?.version.definition.sections[1].questions[0].label, "CHANGED WORDING");
    // v1 snapshot is untouched.
    const frozen = await store.get<{ definition: AssessmentDoc["definition"] }>("assessmentVersions", `${doc.id}__v1`);
    assert.equal(frozen?.definition.scoring.levels[3].min, 80);
    assert.deepEqual(frozen?.definition, v1?.version.definition);
  });

  it("re-publishing without changes does not mint a new version", async () => {
    const doc = await publishedListening(store);
    await unpublishAssessment(store, doc.id);
    const again = await publishAssessment(store, doc.id, user);
    assert.equal(again.assessment.version, 1);
  });

  it("detects concurrent edits and locks the slug after publishing", async () => {
    const doc = await publishedListening(store);
    await updateAssessment(store, doc.id, { meta: { description: "New description." }, baseRevision: doc.draftRevision });
    await assert.rejects(
      updateAssessment(store, doc.id, { meta: { description: "Stale." }, baseRevision: doc.draftRevision }),
      (e: unknown) => e instanceof ApiError && e.status === 409,
    );
    await assert.rejects(updateAssessment(store, doc.id, { meta: { slug: "new-slug" } }), (e: unknown) => e instanceof ApiError && e.status === 409);
  });

  it("duplicates into a fresh draft with a unique slug", async () => {
    const doc = await publishedListening(store);
    const { assessment: copy } = await duplicateAssessment(store, doc.id, user);
    assert.equal(copy.status, "draft");
    assert.equal(copy.version, 0);
    assert.notEqual(copy.slug, doc.slug);
    assert.match(copy.title, /^Copy of /);
    assert.deepEqual(copy.definition, doc.definition);
  });

  it("only allows deleting never-published assessments without responses", async () => {
    const { assessment } = await createAssessment(store, { templateId: "blank", title: "Scratch" }, user);
    await deleteAssessment(store, assessment.id);
    const doc = await publishedListening(store);
    await assert.rejects(deleteAssessment(store, doc.id), (e: unknown) => e instanceof ApiError && e.status === 409);
    await archiveAssessment(store, doc.id);
    assert.equal((await listPublished(store)).length, 0);
  });

  it("scores sample answers against the draft in preview", async () => {
    const { assessment } = await createAssessment(store, { templateId: "listening-self-reflection" }, user);
    const ok = await previewScore(store, assessment.id, bestAnswers());
    assert.equal(ok.result?.overall, 100);
    const bad = await previewScore(store, assessment.id, {});
    assert.equal(bad.ok, false);
    assert.ok(bad.errors.q_self_rating);
  });
});

describe("submitting", () => {
  it("validates on the server, scores on the server and stores a version-pinned submission", async () => {
    const doc = await publishedListening(store);
    const res = await submitAssessment(store, doc.slug, submitBody({ total: 9999, result: { overall: 1 } }), { wait });
    assert.equal(res.duplicate, false);
    assert.equal(res.email.status, "sent");
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.result.overall, 100); // computed from answers; client-sent totals are ignored
    assert.equal(view.result.level?.label, "Attentive");
    assert.equal(view.participant.firstName, "Asha");
    const [stored] = await store.query<{ version: number; versionId: string; respondent: { email: string } }>("assessmentSubmissions");
    assert.equal(stored.version, 1);
    assert.equal(stored.versionId, `${doc.id}__v1`);
    assert.equal(stored.respondent.email, "asha@example.com");
  });

  it("does not leak answers or the raw email address to the result page", async () => {
    const doc = await publishedListening(store);
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    const json = JSON.stringify(await getResultView(store, res.resultToken));
    assert.equal(json.includes("asha@example.com"), false);
    assert.equal(json.includes("\"answers\""), false);
    assert.equal(json.includes("q_intention"), false);
    assert.match(json, /a\*\*\*@example\.com/);
  });

  it("rejects missing consent, bad emails, missing required answers and bots", async () => {
    const doc = await publishedListening(store);
    const bad = async (overrides: Record<string, unknown>) =>
      assert.rejects(submitAssessment(store, doc.slug, submitBody(overrides), { wait }), (e: unknown) => e instanceof ApiError && [400, 422].includes(e.status));
    await bad({ consent: { storeResponses: false, emailResults: true } });
    await bad({ email: "nope" });
    await bad({ answers: {} });
    await bad({ website: "http://spam.example" });
    await bad({ idempotencyKey: "short" });
    assert.equal((await store.query("assessmentSubmissions")).length, 0);
    assert.equal(mail.calls, 0);
  });

  it("is idempotent: the same key returns the same result and emails once", async () => {
    const doc = await publishedListening(store);
    const body = submitBody();
    const first = await submitAssessment(store, doc.slug, body, { wait });
    const second = await submitAssessment(store, doc.slug, body, { wait });
    assert.equal(second.duplicate, true);
    assert.equal(second.resultToken, first.resultToken);
    assert.equal((await store.query("assessmentSubmissions")).length, 1);
    assert.equal(mail.sent.length, 1);
  });

  it("submits against the version the participant saw, even after a re-publish", async () => {
    const doc = await publishedListening(store);
    const def = structuredClone(doc.definition);
    def.scoring.levels[3].label = "Fully Present";
    await updateAssessment(store, doc.id, { definition: def });
    await publishAssessment(store, doc.id, user);
    const old = await submitAssessment(store, doc.slug, submitBody({ version: 1 }), { wait });
    const fresh = await submitAssessment(store, doc.slug, submitBody({ version: 2 }), { wait });
    assert.equal((await getResultView(store, old.resultToken)).result.level?.label, "Attentive");
    assert.equal((await getResultView(store, fresh.resultToken)).result.level?.label, "Fully Present");
    await assert.rejects(submitAssessment(store, doc.slug, submitBody({ version: 9 }), { wait }), (e: unknown) => e instanceof ApiError && e.status === 400);
  });

  it("cannot read results with an unknown or malformed token", async () => {
    await assert.rejects(getResultView(store, "x".repeat(43)), (e: unknown) => e instanceof ApiError && e.status === 404);
    await assert.rejects(getResultView(store, "short"), (e: unknown) => e instanceof ApiError && e.status === 404);
  });

  it("refuses unpublished assessments", async () => {
    const { assessment } = await createAssessment(store, { templateId: "listening-self-reflection" }, user);
    await assert.rejects(submitAssessment(store, assessment.slug, submitBody(), { wait }), (e: unknown) => e instanceof ApiError && e.status === 404);
  });
});

describe("result email", () => {
  it("sends a responsive HTML + text email and only reports 'sent' after the provider accepted it", async () => {
    const doc = await publishedListening(store);
    const res = await submitAssessment(store, doc.slug, submitBody({ name: "Asha <b>Verma</b>" }), { wait });
    assert.equal(res.email.status, "sent");
    const msg = mail.sent[0];
    assert.equal(msg.to, "asha@example.com");
    assert.match(msg.subject, /Listening Self-Reflection results/);
    assert.match(msg.html, /<table/);
    assert.match(msg.html, /Overall score/);
    assert.match(msg.html, /\/assessments\/results\//);
    assert.match(msg.text, /OVERALL SCORE: 100 \/ 100 — Attentive/);
    assert.match(msg.text, /30-day practice plan/i);
    assert.equal(msg.html.includes("<b>"), false);
  });

  it("keeps the result visible and offers a retry when the provider fails", async () => {
    const doc = await publishedListening(store);
    mail.outcomes = [
      { ok: false, retryable: true, error: "The mail server could not be reached." },
      { ok: false, retryable: true, error: "The mail server could not be reached." },
    ];
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "failed");
    assert.equal(mail.calls, 2); // one retry for a transient error
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.result.overall, 100);
    assert.equal(view.email.status, "failed");
    assert.equal(view.email.canRetry, true);
    assert.match(view.email.message, /couldn't send/);

    const retry = await resendResultEmail(store, res.resultToken, {}, { wait, now: () => new Date(Date.now() + 120_000) });
    assert.equal(retry.status, "sent");
    assert.equal((await getResultView(store, res.resultToken)).email.status, "sent");
  });

  it("does not retry permanent failures (e.g. an undeliverable address)", async () => {
    const doc = await publishedListening(store);
    mail.outcomes = [{ ok: false, retryable: false, error: "The mail server refused to deliver to this address." }];
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "failed");
    assert.equal(mail.calls, 1);
  });

  it("is optional: without mail credentials nothing is offered, requested or attempted, and results still work", async () => {
    setMailProviderForTests(null);
    const doc = await publishedListening(store);
    const found = await getPublishedBySlug(store, doc.slug);
    // The form does not offer to email results when the server cannot send.
    assert.equal(toPublicForm(found!.version.definition, { emailAvailable: isMailConfigured() }).emailEnabled, false);
    // Even a stale page that still ticks the box gets no email attempt and no error.
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "not_requested");
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.result.overall, 100);
    assert.equal(view.email.enabled, false);
    assert.equal(view.email.canRetry, false);
    assert.equal(mail.calls, 0);
    await assert.rejects(resendResultEmail(store, res.resultToken, { consent: true }, { wait }), (e: unknown) => e instanceof ApiError && e.status === 400);
  });

  it("offers email again as soon as credentials exist", async () => {
    const doc = await publishedListening(store);
    const found = await getPublishedBySlug(store, doc.slug);
    assert.equal(toPublicForm(found!.version.definition, { emailAvailable: isMailConfigured() }).emailEnabled, true);
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "sent");
    assert.equal((await getResultView(store, res.resultToken)).email.enabled, true);
  });

  it("respects the assessment's own email switch", async () => {
    const doc = await publishedListening(store);
    const def = structuredClone(doc.definition);
    def.email.enabled = false;
    await updateAssessment(store, doc.id, { definition: def });
    await publishAssessment(store, doc.id, user);
    const found = await getPublishedBySlug(store, doc.slug);
    assert.equal(toPublicForm(found!.version.definition, { emailAvailable: true }).emailEnabled, false);
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "not_requested");
    assert.equal(mail.calls, 0);
  });

  it("never emails someone who did not consent, and never repeats a delivered email", async () => {
    const doc = await publishedListening(store);
    const res = await submitAssessment(store, doc.slug, submitBody({ consent: { storeResponses: true, emailResults: false } }), { wait });
    assert.equal(res.email.status, "not_requested");
    assert.equal(mail.calls, 0);
    await assert.rejects(resendResultEmail(store, res.resultToken, {}, { wait }), (e: unknown) => e instanceof ApiError && e.status === 400);
    // Explicit opt-in later (clicking "Email me my results").
    const optIn = await resendResultEmail(store, res.resultToken, { consent: true }, { wait });
    assert.equal(optIn.status, "sent");
    assert.equal(mail.sent.length, 1);
    await resendResultEmail(store, res.resultToken, { consent: true }, { wait });
    assert.equal(mail.sent.length, 1);
  });

  it("limits how fast and how often a failing email is retried", async () => {
    const doc = await publishedListening(store);
    mail.outcomes = Array.from({ length: 20 }, () => ({ ok: false as const, retryable: false, error: "x" }));
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    await assert.rejects(resendResultEmail(store, res.resultToken, {}, { wait }), (e: unknown) => e instanceof ApiError && e.status === 429);
    let t = Date.now();
    for (let i = 0; i < 8; i++) {
      t += 120_000;
      await resendResultEmail(store, res.resultToken, {}, { wait, now: () => new Date(t) }).catch(() => undefined);
    }
    assert.ok(mail.calls <= 6, `sent too many times: ${mail.calls}`);
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.email.canRetry, false);
  });

  it("notifies the practice only when configured AND the participant agreed", async () => {
    const doc = await publishedListening(store);
    const def = structuredClone(doc.definition);
    def.email.adminNotify = { enabled: true, recipients: ["practice@example.com"] };
    await updateAssessment(store, doc.id, { definition: def });
    await publishAssessment(store, doc.id, user);

    await submitAssessment(store, doc.slug, submitBody({ consent: { storeResponses: true, emailResults: true, shareWithPractice: false } }), { wait });
    assert.deepEqual(mail.sent.map((m) => m.to), ["asha@example.com"]);

    await submitAssessment(store, doc.slug, submitBody({ consent: { storeResponses: true, emailResults: true, shareWithPractice: true } }), { wait });
    assert.deepEqual(mail.sent.map((m) => m.to).sort(), ["asha@example.com", "asha@example.com", "practice@example.com"]);
  });
});

describe("peer feedback", () => {
  async function submittedWithInvite() {
    const doc = await publishedListening(store);
    const res = await submitAssessment(store, doc.slug, submitBody({ answers: bestAnswers("both", true) }), { wait });
    const view = await getResultView(store, res.resultToken);
    return { doc, res, view };
  }

  function peerAnswers(value: number): Answers {
    const def = listeningDefinition();
    const answers: Answers = {};
    for (const q of def.sections.flatMap((s) => s.questions)) if (q.peer?.enabled) answers[q.id] = value;
    return answers;
  }

  it("creates a private link only when the participant opted in", async () => {
    const { view } = await submittedWithInvite();
    assert.equal(view.peer.available, true);
    assert.equal(view.peer.enabled, true);
    assert.ok(view.peer.token && view.peer.token.length >= 32);
    const doc = await publishedListening(store);
    const other = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal((await getResultView(store, other.resultToken)).peer.token, undefined);
  });

  it("stores peer answers separately and compares them with the self answers", async () => {
    const { res, view } = await submittedWithInvite();
    const form = await getPeerForm(store, view.peer.token!);
    assert.equal(form.participantFirstName, "Asha");
    assert.ok(form.sections.length > 0);
    assert.equal(JSON.stringify(form).includes("skillId"), false);

    // Peer answers are all 3 (neutral); reversed items score 3 as well, so every skill lands at 50.
    await submitPeerResponse(store, view.peer.token!, { consent: true, relationship: "Colleague", idempotencyKey: key(), answers: peerAnswers(3) });
    const after = await getResultView(store, res.resultToken);
    assert.equal(after.peer.responseCount, 1);
    assert.equal(after.peer.comparison?.responses, 1);
    assert.equal(after.peer.comparison?.overall?.peer, 50);
    assert.equal(after.peer.comparison?.overall?.self, 100);
    assert.equal((await store.query("assessmentPeerResponses")).length, 1);
    // The self submission's own answers were not touched by the peer.
    const [sub] = await store.query<{ answers: Answers }>("assessmentSubmissions");
    assert.equal(sub.answers.q_attn_work_1, 5);
  });

  it("enforces consent, the response cap and idempotent retries", async () => {
    const { view } = await submittedWithInvite();
    const token = view.peer.token!;
    await assert.rejects(submitPeerResponse(store, token, { consent: false, idempotencyKey: key(), answers: peerAnswers(4) }), (e: unknown) => e instanceof ApiError && e.status === 422);
    const k = key();
    await submitPeerResponse(store, token, { consent: true, idempotencyKey: k, answers: peerAnswers(4) });
    await submitPeerResponse(store, token, { consent: true, idempotencyKey: k, answers: peerAnswers(4) }); // retry, not a second response
    assert.equal((await getResultView(store, (await store.query<{ accessToken: string }>("assessmentSubmissions"))[0].accessToken)).peer.responseCount, 1);
    await submitPeerResponse(store, token, { consent: true, idempotencyKey: key(), answers: peerAnswers(4) });
    await submitPeerResponse(store, token, { consent: true, idempotencyKey: key(), answers: peerAnswers(4) });
    await assert.rejects(submitPeerResponse(store, token, { consent: true, idempotencyKey: key(), answers: peerAnswers(4) }), (e: unknown) => e instanceof ApiError && e.status === 409);
  });

  it("lets the participant switch the link off", async () => {
    const { res, view } = await submittedWithInvite();
    await setPeerEnabled(store, res.resultToken, false);
    await assert.rejects(getPeerForm(store, view.peer.token!), (e: unknown) => e instanceof ApiError && e.status === 404);
    const on = await setPeerEnabled(store, res.resultToken, true);
    assert.equal(on.token, view.peer.token);
  });

  it("does not accept the result token as a peer token or vice versa", async () => {
    const { res, view } = await submittedWithInvite();
    await assert.rejects(getPeerForm(store, res.resultToken), (e: unknown) => e instanceof ApiError && e.status === 404);
    await assert.rejects(getResultView(store, view.peer.token!), (e: unknown) => e instanceof ApiError && e.status === 404);
  });
});

describe("sharing with the practice (consent)", () => {
  it("asks for consent whenever admins only see people who agreed, even with notifications off", async () => {
    const doc = await publishedListening(store); // default privacy = consented_only, notifications off
    const found = await getPublishedBySlug(store, doc.slug);
    assert.equal(found!.version.definition.email.adminNotify.enabled, false);
    assert.equal(toPublicForm(found!.version.definition).shareWithPracticeOffered, true);

    await submitAssessment(store, doc.slug, submitBody({ name: "Agreed Person", consent: { storeResponses: true, emailResults: false, shareWithPractice: true } }), { wait });
    await submitAssessment(store, doc.slug, submitBody({ name: "Private Person", consent: { storeResponses: true, emailResults: false, shareWithPractice: false } }), { wait });
    const { rows } = await listSubmissions(store, doc.id);
    assert.deepEqual(rows.filter((r) => r.name).map((r) => r.name), ["Agreed Person"]);
    assert.equal(mail.calls, 0); // consent alone sends nothing: notifications are separate and off
  });

  it("does not offer or record consent when nobody could use it", async () => {
    const doc = await publishedListening(store);
    const def = structuredClone(doc.definition);
    def.privacy.adminViewMode = "anonymous";
    await updateAssessment(store, doc.id, { definition: def });
    await publishAssessment(store, doc.id, user);
    const found = await getPublishedBySlug(store, doc.slug);
    assert.equal(toPublicForm(found!.version.definition).shareWithPracticeOffered, false);
    await submitAssessment(store, doc.slug, submitBody({ consent: { storeResponses: true, emailResults: false, shareWithPractice: true } }), { wait });
    const [stored] = await store.query<{ consent: { shareWithPractice: boolean } }>("assessmentSubmissions");
    assert.equal(stored.consent.shareWithPractice, false);
  });
});

describe("admin data and privacy", () => {
  async function withSubs(mode: "full" | "consented_only" | "anonymous" | "none") {
    const doc = await publishedListening(store);
    const def = structuredClone(doc.definition);
    def.privacy.adminViewMode = mode;
    def.email.adminNotify = { enabled: true, recipients: ["practice@example.com"] };
    await updateAssessment(store, doc.id, { definition: def });
    await publishAssessment(store, doc.id, user);
    await submitAssessment(store, doc.slug, submitBody({ name: "Shared Person", email: "shared@example.com", consent: { storeResponses: true, emailResults: false, shareWithPractice: true } }), { wait });
    await submitAssessment(store, doc.slug, submitBody({ name: "Private Person", email: "private@example.com", consent: { storeResponses: true, emailResults: false, shareWithPractice: false } }), { wait });
    return doc;
  }

  it("consented_only shows identity and answers only for people who agreed", async () => {
    const doc = await withSubs("consented_only");
    const { rows } = await listSubmissions(store, doc.id);
    const shared = rows.find((r) => r.sharedWithPractice)!;
    const priv = rows.find((r) => !r.sharedWithPractice)!;
    assert.equal(shared.name, "Shared Person");
    assert.equal(priv.name, undefined);
    assert.equal(priv.address, undefined);
    assert.ok((await getSubmissionDetail(store, doc.id, shared.id)).answers);
    assert.equal((await getSubmissionDetail(store, doc.id, priv.id)).answers, null);
  });

  it("anonymous and none modes hide identities / the listing", async () => {
    const anon = await withSubs("anonymous");
    assert.ok((await listSubmissions(store, anon.id)).rows.every((r) => r.name === undefined));
    store = new MemoryStore();
    const none = await withSubs("none");
    await assert.rejects(listSubmissions(store, none.id), (e: unknown) => e instanceof ApiError && e.status === 403);
    // Aggregate analytics still work and expose no people.
    const stats = await getAssessmentAnalytics(store, none.id);
    assert.equal(stats.totals.submissions, 2);
    assert.deepEqual(stats.recent, []);
  });

  it("computes analytics, overview and email status counts", async () => {
    const doc = await withSubs("full");
    const stats = await getAssessmentAnalytics(store, doc.id);
    assert.equal(stats.totals.submissions, 2);
    assert.equal(stats.totals.averageScore, 100);
    assert.equal(stats.distribution[9].count, 2);
    assert.equal(stats.emailStatus.not_requested, 2);
    assert.equal(stats.skills.length, 4);
    assert.equal(stats.byDay.at(-1)?.count, 2);
    const overview = await getOverview(store);
    assert.equal(overview.totals.published, 1);
    assert.equal(overview.totals.submissions, 2);
  });

  it("retries a failed email for a participant who asked for it, and deletes data on request", async () => {
    const doc = await publishedListening(store);
    mail.outcomes = [{ ok: false, retryable: false, error: "x" }];
    const res = await submitAssessment(store, doc.slug, submitBody(), { wait });
    assert.equal(res.email.status, "failed");
    const [sub] = await store.query<{ id: string }>("assessmentSubmissions");
    const retried = await retrySubmissionEmail(store, doc.id, sub.id, { wait, now: () => new Date(Date.now() + 120_000) });
    assert.equal(retried.status, "sent");
    await deleteSubmission(store, doc.id, sub.id);
    assert.equal((await store.query("assessmentSubmissions")).length, 0);
    assert.equal((await store.query("assessmentEmails")).length, 0);
  });
});
