import "./setup";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { drainBackgroundForTests, setInlineBackgroundForTests } from "../../lib/assessments/server/background";
import { retrySubmissionEmail, listSubmissions, getAssessmentAnalytics, getSubmissionDetail, deleteSubmission } from "../../lib/assessments/server/adminData";
import { COL } from "../../lib/assessments/server/config";
import { deliverResultEmail } from "../../lib/assessments/server/emailService";
import { ApiError } from "../../lib/assessments/server/http";
import { setMailProviderForTests, type MailMessage, type MailProvider, type SendOutcome } from "../../lib/assessments/server/mail";
import { OWNER_EMAIL } from "../../lib/assessments/server/mailAccount";
import { createAssessment, publishAssessment, updateAssessment } from "../../lib/assessments/server/service";
import { MemoryStore } from "../../lib/assessments/server/store";
import { getResultView, resendResultEmail, submitAssessment } from "../../lib/assessments/server/submissions";
import { isValidEmail } from "../../lib/assessments/text";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import type { Answers, AssessmentDoc, EmailRecordDoc, SubmissionDoc } from "../../lib/assessments/types";

// Breaking the email flow on purpose: races, crashes, hostile input and the admin side.

const user = { uid: "u1", email: "admin@example.com" };
const wait = async () => {};

/** A provider the tests can slow down, make fail or make throw, per message. */
class ControlledMail implements MailProvider {
  readonly name = "controlled";
  sent: MailMessage[] = [];
  practice: MailMessage[] = [];
  inFlight = 0;
  maxInFlight = 0;
  calls = 0;
  delay: (message: MailMessage) => Promise<void> = async () => {};
  behave: (message: MailMessage) => SendOutcome | "throw" | null = () => null;
  async send(message: MailMessage): Promise<SendOutcome> {
    this.calls += 1;
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      await this.delay(message);
      const outcome = this.behave(message);
      if (outcome === "throw") throw new Error("unexpected provider crash");
      if (outcome) return outcome;
      (message.to === OWNER_EMAIL ? this.practice : this.sent).push(message);
      return { ok: true, messageId: `<m${this.calls}@test>` };
    } finally {
      this.inFlight -= 1;
    }
  }
}

function bestAnswers(): Answers {
  const def = listeningDefinition();
  const answers: Answers = { q_self_rating: 4, q_where: "both" };
  for (const q of def.sections.flatMap((s) => s.questions)) {
    if (q.type === "rating5" && q.scoring?.scored) answers[q.id] = q.scoring.reverse ? 1 : 5;
  }
  return answers;
}

let counter = 0;
const key = () => `stress_${String(++counter).padStart(6, "0")}_abcdefghijklmn`;
const body = (overrides: Record<string, unknown> = {}) => ({
  name: "Asha Verma",
  email: "asha@example.com",
  consent: { storeResponses: true, emailResults: true, shareWithPractice: false },
  answers: bestAnswers(),
  idempotencyKey: key(),
  ...overrides,
});

let store: MemoryStore;
let mail: ControlledMail;

async function published(edit?: (d: AssessmentDoc["definition"]) => void): Promise<AssessmentDoc> {
  const { assessment } = await createAssessment(store, { templateId: "listening-self-reflection" }, user);
  if (edit) {
    const def = structuredClone(assessment.definition);
    edit(def);
    await updateAssessment(store, assessment.id, { definition: def });
  }
  return (await publishAssessment(store, assessment.id, user)).assessment;
}

const submissions = () => store.query<SubmissionDoc>(COL.submissions);
const records = () => store.query<EmailRecordDoc>(COL.emails);
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** With the emails in the background: waits until the result email is no longer pending. */
async function settle(token: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if ((await getResultView(store, token)).email.status !== "pending") return;
    await pause(10);
  }
  throw new Error("the email stayed pending");
}

afterEach(async () => {
  await drainBackgroundForTests(); // nothing from one test may reach into the next
});

beforeEach(() => {
  store = new MemoryStore();
  mail = new ControlledMail();
  setMailProviderForTests(mail);
  setInlineBackgroundForTests(true);
});

describe("races", () => {
  it("ten requests with the same key at once make one submission, one email and one note", async () => {
    const doc = await published();
    const same = body();
    const results = await Promise.all(Array.from({ length: 10 }, () => submitAssessment(store, doc.slug, same, { wait })));
    assert.equal(results.filter((r) => !r.duplicate).length, 1);
    assert.equal(new Set(results.map((r) => r.resultToken)).size, 1);
    assert.equal((await submissions()).length, 1);
    assert.equal(mail.sent.length, 1);
    assert.equal(mail.practice.length, 1);
  });

  it("twenty different people at once each get one email, to their own address, with their own PDF", async () => {
    const doc = await published();
    mail.delay = async () => pause(Math.floor(Math.random() * 15));
    const people = Array.from({ length: 20 }, (_, i) => ({ name: `Person Number${i}`, email: `p${i}@example.com` }));
    await Promise.all(people.map((p) => submitAssessment(store, doc.slug, body(p), { wait })));
    assert.equal(mail.sent.length, 20);
    assert.equal(mail.practice.length, 20);
    for (const p of people) {
      const mine = mail.sent.filter((m) => m.to === p.email);
      assert.equal(mine.length, 1, `${p.email} got ${mine.length} emails`);
      assert.match(mine[0].html, new RegExp(`Hello ${p.name.split(" ")[0]},`));
      assert.ok(mine[0].attachments?.[0]?.filename.includes(p.name.split(" ")[1]), "the attached report is theirs");
      for (const other of people.filter((o) => o !== p)) assert.equal(mine[0].html.includes(other.name), false, "nobody else's name in this email");
    }
  });

  it("many 'try again' clicks while the first send is still running send one email", async () => {
    const doc = await published();
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    mail.delay = async (m) => (m.to === OWNER_EMAIL ? undefined : gate);
    setInlineBackgroundForTests(false);
    try {
      const res = await submitAssessment(store, doc.slug, body(), { wait });
      assert.equal(res.email.status, "pending");
      const clicks = await Promise.all(Array.from({ length: 8 }, () => resendResultEmail(store, res.resultToken, {}, { wait })));
      assert.ok(clicks.every((c) => c.status === "pending"), "every extra click is told it is already on its way");
      open();
      await settle(res.resultToken);
      assert.equal(mail.sent.length, 1);
    } finally {
      open();
      setInlineBackgroundForTests(true);
    }
  });

  it("a delivered email is never repeated, by the page or by the admin", async () => {
    const doc = await published();
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    await resendResultEmail(store, res.resultToken, {}, { wait });
    await Promise.all(Array.from({ length: 5 }, async () => {
      const [sub] = await submissions();
      await retrySubmissionEmail(store, doc.id, sub.id, { wait });
    }));
    assert.equal(mail.sent.length, 1);
  });

  it("a send that died halfway is picked up again after a minute", async () => {
    const doc = await published();
    const res = await submitAssessment(store, doc.slug, body({ email: "later@example.com" }), { wait });
    assert.equal(res.email.status, "sent");
    const [sub] = await submissions();
    // Make it look like the server was killed in the middle of the send, two minutes ago.
    await store.set(COL.emails, `${sub.id}_result`, { ...(await store.get<EmailRecordDoc>(COL.emails, `${sub.id}_result`))!, status: "sending", updatedAt: new Date(Date.now() - 120_000).toISOString() });
    await store.set(COL.submissions, sub.id, { ...sub, email: { status: "pending", attempts: 1 } });
    mail.sent = [];
    const state = await deliverResultEmail(store, (await store.get<SubmissionDoc>(COL.submissions, sub.id))!, (await store.get<never>(COL.versions, sub.versionId))!, { wait });
    assert.equal(state.status, "sent");
    assert.equal(mail.sent.length, 1);
  });

  it("a send that is only slow (under a minute) is not started a second time", async () => {
    const doc = await published();
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    const [sub] = await submissions();
    await store.set(COL.emails, `${sub.id}_result`, { ...(await store.get<EmailRecordDoc>(COL.emails, `${sub.id}_result`))!, status: "sending", updatedAt: new Date().toISOString() });
    await store.set(COL.submissions, sub.id, { ...sub, email: { status: "pending", attempts: 1 } });
    mail.sent = [];
    const state = await resendResultEmail(store, res.resultToken, {}, { wait, now: () => new Date(Date.now() + 40_000) });
    assert.equal(state.status, "pending");
    assert.equal(mail.sent.length, 0);
  });

  it("never sends more than three emails to the mail server at the same moment", async () => {
    const doc = await published();
    mail.delay = async () => pause(15);
    await Promise.all(Array.from({ length: 12 }, (_, i) => submitAssessment(store, doc.slug, body({ email: `c${i}@example.com` }), { wait })));
    assert.equal(mail.sent.length, 12);
    assert.ok(mail.maxInFlight <= 3, `up to ${mail.maxInFlight} connections at once`);
  });
});

describe("crashes and failures", () => {
  it("a provider that throws leaves 'failed' behind, not 'pending' for ever, and the person can try again", async () => {
    const doc = await published();
    mail.behave = (m) => (m.to === OWNER_EMAIL ? null : "throw");
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.email.status, "failed");
    assert.equal(view.email.canRetry, true);
    const [record] = (await records()).filter((r) => r.kind === "result");
    assert.equal(record.status, "failed");
    mail.behave = () => null;
    const retried = await resendResultEmail(store, res.resultToken, {}, { wait, now: () => new Date(Date.now() + 120_000) });
    assert.equal(retried.status, "sent");
  });

  it("the note to the practice failing does not stop the participant's email, and the admin can send it again", async () => {
    const doc = await published();
    mail.behave = (m) => (m.to === OWNER_EMAIL ? { ok: false, retryable: false, error: "owner mailbox full" } : null);
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(res.email.status, "sent");
    assert.equal(mail.sent.length, 1);
    assert.equal(mail.practice.length, 0);
    assert.equal((await records()).find((r) => r.kind === "admin_notification")?.status, "failed");

    mail.behave = () => null;
    const [sub] = await submissions();
    await retrySubmissionEmail(store, doc.id, sub.id, { wait });
    assert.equal(mail.practice.length, 1, "the practice got its note after the admin retried");
    assert.equal(mail.sent.length, 1, "the participant was not emailed again");
    await retrySubmissionEmail(store, doc.id, sub.id, { wait });
    assert.equal(mail.practice.length, 1, "and not a second time");
  });

  it("the participant's email failing does not stop the note to the practice", async () => {
    const doc = await published();
    mail.behave = (m) => (m.to === OWNER_EMAIL ? null : { ok: false, retryable: false, error: "no such mailbox" });
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(res.email.status, "failed");
    assert.equal(mail.practice.length, 1);
  });

  it("a practice note that throws never breaks the submission", async () => {
    const doc = await published();
    mail.behave = (m) => (m.to === OWNER_EMAIL ? "throw" : null);
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(res.email.status, "sent");
    assert.equal((await submissions()).length, 1);
  });

  it("a temporary mail-server error is retried once and then reported honestly", async () => {
    const doc = await published();
    let calls = 0;
    mail.behave = (m) => (m.to === OWNER_EMAIL ? null : ++calls === 1 ? { ok: false, retryable: true, error: "busy" } : null);
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(res.email.status, "sent");
    assert.equal(mail.sent.length, 1);
  });

  it("an email that was never started (the server died before it began) is started by opening the result page", async () => {
    const doc = await published();
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    const [sub] = await submissions();
    // As if the server died right after saving: no delivery records and a result still 'pending'.
    await store.delete(COL.emails, `${sub.id}_result`);
    await store.delete(COL.emails, `${sub.id}_admin`);
    await store.set(COL.submissions, sub.id, { ...sub, createdAt: new Date(Date.now() - 60_000).toISOString(), email: { status: "pending", attempts: 0 } });
    mail.sent = [];
    mail.practice = [];
    const view = await getResultView(store, res.resultToken, { wait });
    assert.equal(view.email.status === "sent" || view.email.status === "pending", true);
    for (let i = 0; i < 100 && mail.sent.length === 0; i++) await pause(10);
    assert.equal(mail.sent.length, 1);
    assert.equal(mail.practice.length, 1);
    await getResultView(store, res.resultToken, { wait });
    assert.equal(mail.sent.length, 1, "opening the page again does not send again");
  });

  it("a result that is only a few seconds old is left alone by the page (it is still being sent)", async () => {
    const doc = await published();
    const res = await submitAssessment(store, doc.slug, body(), { wait });
    const [sub] = await submissions();
    await store.delete(COL.emails, `${sub.id}_result`);
    await store.set(COL.submissions, sub.id, { ...sub, email: { status: "pending", attempts: 0 } });
    mail.sent = [];
    await getResultView(store, res.resultToken, { wait });
    assert.equal(mail.sent.length, 0);
  });

  it("a participant deleted before their email reaches the mail server gets no email, and nothing is brought back", async () => {
    // The delivery code looks the address up (to count the day's emails) just before it sends; hold it there.
    let open!: () => void;
    const gate = new Promise<void>((resolve) => (open = resolve));
    class GatedStore extends MemoryStore {
      async query<T>(collection: string, opts: { where?: [string, unknown][]; limit?: number } = {}): Promise<T[]> {
        if (collection === COL.emails && opts.where?.[0]?.[0] === "to") await gate;
        return super.query<T>(collection, opts as never);
      }
    }
    store = new GatedStore();
    const doc = await published();
    setInlineBackgroundForTests(false);
    try {
      const res = await submitAssessment(store, doc.slug, body(), { wait });
      for (let i = 0; i < 200 && (await records()).filter((r) => r.kind === "result").length === 0; i++) await pause(5);
      const [sub] = await submissions();
      await deleteSubmission(store, doc.id, sub.id);
      open();
      await drainBackgroundForTests();
      assert.equal(mail.sent.length, 0, "no email to someone whose data was deleted");
      assert.equal((await submissions()).length, 0);
      assert.equal((await records()).filter((r) => r.kind === "result").length, 0, "the delivery record was not brought back");
      await assert.rejects(getResultView(store, res.resultToken), (e: unknown) => e instanceof ApiError && e.status === 404);
    } finally {
      open();
      setInlineBackgroundForTests(true);
    }
  });
});

describe("limits on emailing one address", () => {
  it("emails one address at most five times a day, then says so, and a retry cannot get round it", async () => {
    const doc = await published();
    const tokens: string[] = [];
    for (let i = 0; i < 7; i++) tokens.push((await submitAssessment(store, doc.slug, body({ email: "victim@example.com" }), { wait })).resultToken);
    assert.equal(mail.sent.length, 5, `sent to: ${mail.sent.map((m) => m.to).join(", ")}`);
    const sixth = await getResultView(store, tokens[5]);
    assert.equal(sixth.email.status, "failed");
    assert.match(sixth.email.message, /several times today/i);
    assert.equal(sixth.email.canRetry, false);
    const again = await resendResultEmail(store, tokens[5], {}, { wait, now: () => new Date(Date.now() + 120_000) });
    assert.equal(again.status, "failed");
    assert.equal(mail.sent.length, 5);
    // Another person is not affected, and the same address is fine again a day later.
    await submitAssessment(store, doc.slug, body({ email: "someone.else@example.com" }), { wait });
    assert.equal(mail.sent.length, 6);
  });

  it("still shows the results when the email was limited", async () => {
    const doc = await published();
    for (let i = 0; i < 5; i++) await submitAssessment(store, doc.slug, body({ email: "v@example.com" }), { wait });
    const res = await submitAssessment(store, doc.slug, body({ email: "v@example.com" }), { wait });
    const view = await getResultView(store, res.resultToken);
    assert.equal(view.result.overall, 100);
  });
});

describe("hostile input", () => {
  const bad = [
    "a@b.com,c@d.com",
    "a@b.com;c@d.com",
    "a@b.com\r\nBcc: x@y.com",
    "a@b.com\nBcc: x@y.com",
    "<a@b.com>",
    '"a b"@c.com',
    "Asha <a@b.com>",
    "a@b",
    "a@@b.com",
    ".a@b.com",
    "a..b@c.com",
    "a b@c.com",
    "a@b.com ,c@d.com",
    `${"a".repeat(65)}@example.com`,
    `a@${"b".repeat(250)}.com`,
    "@example.com",
    "a@.com",
    "a@-b.com",
    "",
  ];
  it("rejects addresses that could send the email to more than one person or inject headers", () => {
    for (const email of bad) assert.equal(isValidEmail(email), false, JSON.stringify(email));
    for (const nonString of [null, undefined, 5, ["a@b.com"], { a: 1 }, true]) assert.equal(isValidEmail(nonString), false);
  });

  it("sends nothing and stores nothing for a bad address, however it is written", async () => {
    const doc = await published();
    for (const email of bad.concat([null as never, ["a@b.com"] as never, { toString: () => "a@b.com" } as never])) {
      await assert.rejects(submitAssessment(store, doc.slug, body({ email }), { wait }), (e: unknown) => e instanceof ApiError && [400, 422].includes(e.status), JSON.stringify(email));
    }
    assert.equal(mail.calls, 0);
    assert.equal((await submissions()).length, 0);
  });

  it("tidies a good address (capitals, spaces) and sends to that one address only", async () => {
    const doc = await published();
    await submitAssessment(store, doc.slug, body({ email: "  Asha.Verma+test@Example.COM " }), { wait });
    assert.deepEqual(mail.sent.map((m) => m.to), ["asha.verma+test@example.com"]);
  });

  it("cannot be tricked through the name: no new lines in the subject, no extra recipient, no markup", async () => {
    const doc = await published();
    await submitAssessment(
      store,
      doc.slug,
      body({ name: "Asha\r\nBcc: evil@example.com\r\nSubject: hacked <script>alert(1)</script><img src=x onerror=alert(2)>" }),
      { wait },
    );
    for (const m of [...mail.sent, ...mail.practice]) {
      assert.equal(/[\r\n]/.test(m.subject), false, "no line breaks in the subject");
      assert.equal(m.html.includes("<script"), false);
      assert.equal(m.html.includes("<img src=x"), false);
      assert.equal(/Bcc:/i.test(m.subject), false);
    }
    assert.deepEqual(mail.sent.map((m) => m.to), ["asha@example.com"]);
    assert.equal(mail.sent[0].replyTo, undefined);
  });

  it("copes with names in other scripts, emoji and the longest allowed name", async () => {
    const doc = await published();
    const names = ["आशा वर्मा", "علي حسن", "山田 太郎", "Zoë 🎉 Müller", "A".repeat(100), "O'Brien-Smith Jr."];
    for (const [i, name] of names.entries()) {
      const res = await submitAssessment(store, doc.slug, body({ name, email: `n${i}@example.com` }), { wait });
      assert.equal(res.email.status, "sent", name);
    }
    assert.equal(mail.sent.length, names.length);
    assert.ok(mail.sent.every((m) => m.attachments?.[0]?.contentType === "application/pdf"));
  });

  it("does not expand tokens twice: a name that looks like a token stays plain text", async () => {
    const doc = await published((d) => {
      d.email.subject = "Results for {{name}}";
    });
    await submitAssessment(store, doc.slug, body({ name: "{{assessment}}" }), { wait });
    assert.ok(!mail.sent[0].subject.includes("Listening"), mail.sent[0].subject);
  });

  it("a filled-in hidden field (a bot) gets nothing and costs nothing", async () => {
    const doc = await published();
    await assert.rejects(submitAssessment(store, doc.slug, body({ website: "http://spam.example" }), { wait }), (e: unknown) => e instanceof ApiError && e.status === 400);
    assert.equal(mail.calls, 0);
    assert.equal((await submissions()).length, 0);
  });

  it("without agreeing to the use of the answers, or with wrong answers, nothing is stored or sent", async () => {
    const doc = await published();
    await assert.rejects(submitAssessment(store, doc.slug, body({ consent: { emailResults: true } }), { wait }), (e: unknown) => e instanceof ApiError && e.status === 422);
    await assert.rejects(submitAssessment(store, doc.slug, body({ answers: { q_self_rating: 99 } }), { wait }), (e: unknown) => e instanceof ApiError && e.status === 422);
    await assert.rejects(submitAssessment(store, doc.slug, body({ answers: "nope" as never }), { wait }), (e: unknown) => e instanceof ApiError);
    await assert.rejects(submitAssessment(store, doc.slug, body({ idempotencyKey: "short" }), { wait }), (e: unknown) => e instanceof ApiError && e.status === 400);
    assert.equal(mail.calls, 0);
    assert.equal((await submissions()).length, 0);
  });

  it("an unpublished or unknown self-check sends nothing", async () => {
    await assert.rejects(submitAssessment(store, "no-such-thing", body(), { wait }), (e: unknown) => e instanceof ApiError && e.status === 404);
    assert.equal(mail.calls, 0);
  });
});

describe("the admin side", () => {
  it("lists every submission with its email status, and counts them", async () => {
    const doc = await published((d) => {
      d.privacy = { adminViewMode: "full" };
    });
    await submitAssessment(store, doc.slug, body({ email: "ok@example.com" }), { wait });
    mail.behave = (m) => (m.to === "bad@example.com" ? { ok: false, retryable: false, error: "no such mailbox" } : null);
    await submitAssessment(store, doc.slug, body({ email: "bad@example.com", name: "Bad Address" }), { wait });
    const failed = await listSubmissions(store, doc.id, { email: "failed" });
    assert.deepEqual(failed.rows.map((r) => r.name), ["Bad Address"]);
    const sent = await listSubmissions(store, doc.id, { email: "sent" });
    assert.equal(sent.rows.length, 1);
    const stats = await getAssessmentAnalytics(store, doc.id);
    assert.equal(stats.emailStatus.sent, 1);
    assert.equal(stats.emailStatus.failed, 1);
  });

  it("lets the admin retry a failed email, once, and not for another assessment's submission", async () => {
    const doc = await published();
    const other = await published();
    mail.behave = (m) => (m.to === OWNER_EMAIL ? null : { ok: false, retryable: false, error: "x" });
    await submitAssessment(store, doc.slug, body(), { wait });
    const [sub] = await submissions();
    mail.behave = () => null;
    await assert.rejects(retrySubmissionEmail(store, other.id, sub.id, { wait }), (e: unknown) => e instanceof ApiError && e.status === 404);
    const later = { wait, now: () => new Date(Date.now() + 120_000) };
    const results = await Promise.all(Array.from({ length: 4 }, () => retrySubmissionEmail(store, doc.id, sub.id, later)));
    assert.ok(results.every((r) => r.status === "sent" || r.status === "pending"));
    assert.equal(mail.sent.length, 1);
  });

  it("shows the admin how the note to the practice went, and lets a stuck 'pending' result be retried", async () => {
    const doc = await published((d) => {
      d.privacy = { adminViewMode: "full" };
    });
    mail.behave = (m) => (m.to === OWNER_EMAIL ? { ok: false, retryable: false, error: "owner mailbox full" } : null);
    await submitAssessment(store, doc.slug, body(), { wait });
    const [sub] = await submissions();
    let detail = await getSubmissionDetail(store, doc.id, sub.id);
    assert.deepEqual(detail.practiceNote, { status: "failed", error: "owner mailbox full" });
    mail.behave = () => null;
    await retrySubmissionEmail(store, doc.id, sub.id, { wait });
    detail = await getSubmissionDetail(store, doc.id, sub.id);
    assert.deepEqual(detail.practiceNote, { status: "sent", error: undefined });
    // A result that the server never finished sending can be retried from the admin screen.
    await store.delete(COL.emails, `${sub.id}_result`);
    await store.set(COL.submissions, sub.id, { ...sub, email: { status: "pending", attempts: 0 } });
    mail.sent = [];
    const again = await retrySubmissionEmail(store, doc.id, sub.id, { wait });
    assert.equal(again.status, "sent");
    assert.equal(mail.sent.length, 1);
  });

  it("tells the practice's own address once even when it is also listed as an extra recipient", async () => {
    const doc = await published((d) => {
      d.email.adminNotify = { enabled: true, recipients: [OWNER_EMAIL.toUpperCase(), ` ${OWNER_EMAIL} `] };
    });
    await submitAssessment(store, doc.slug, body(), { wait });
    assert.equal(mail.practice.length, 1);
  });

  it("gives the practice the full note for everyone when the privacy mode is 'full', and only a nudge otherwise", async () => {
    const full = await published((d) => {
      d.privacy = { adminViewMode: "full" };
    });
    const closed = await published((d) => {
      d.privacy = { adminViewMode: "anonymous" };
    });
    await submitAssessment(store, full.slug, body({ name: "Seen Person" }), { wait });
    await submitAssessment(store, closed.slug, body({ name: "Hidden Person", email: "hidden@example.com" }), { wait });
    const [first, second] = mail.practice;
    assert.match(first.text, /Seen Person/);
    assert.equal(/Hidden|hidden@/.test(second.text + second.html + second.subject), false);
    assert.equal(second.attachments, undefined);
  });
});
