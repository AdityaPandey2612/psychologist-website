import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { runInBackground } from "../../lib/assessments/server/background";
import { renderAdminNotification } from "../../lib/assessments/server/emailTemplates";
import { createSmtpProvider, getMailProvider, isMailConfigured } from "../../lib/assessments/server/mail";
import { embeddedMailEnv, OWNER_EMAIL } from "../../lib/assessments/server/mailAccount";
import { computeResult } from "../../lib/assessments/scoring";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import type { Answers } from "../../lib/assessments/types";

const MAIL_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "MAIL_FROM", "MAIL_REPLY_TO", "ASSESSMENT_IGNORE_EMBEDDED_MAIL"];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(MAIL_KEYS.map((k) => [k, process.env[k]]));
  for (const k of MAIL_KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of MAIL_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("the email sign-in kept in source", () => {
  it("is used when nothing is set in the environment, so the site can send mail without extra settings", () => {
    assert.equal(isMailConfigured(), true);
    assert.equal(getMailProvider()?.name, "smtp");
  });

  it("is switched off by ASSESSMENT_IGNORE_EMBEDDED_MAIL=1 (what the tests and local test copies use)", () => {
    process.env.ASSESSMENT_IGNORE_EMBEDDED_MAIL = "1";
    assert.equal(embeddedMailEnv(), null);
    assert.equal(isMailConfigured(), false);
  });

  it("gives way to settings from the environment", () => {
    process.env.SMTP_HOST = "mail.example.com";
    process.env.MAIL_FROM = "Someone <someone@example.com>";
    process.env.ASSESSMENT_IGNORE_EMBEDDED_MAIL = "1";
    assert.equal(isMailConfigured(), true);
  });

  it("describes a Gmail connection that sends from the practice name and replies to the practice inbox", () => {
    const env = embeddedMailEnv();
    assert.ok(env);
    assert.equal(env.SMTP_HOST, "smtp.gmail.com");
    assert.equal(env.SMTP_PORT, "465");
    assert.equal(env.SMTP_SECURE, "true");
    assert.match(env.MAIL_FROM, /^"Chaitanya Raj" <[^<>@\s]+@gmail\.com>$/);
    assert.equal(env.MAIL_REPLY_TO, OWNER_EMAIL);
    assert.ok(env.SMTP_PASS.length >= 16);
    assert.equal(createSmtpProvider(env)?.name, "smtp");
  });

  it("tells the practice's real address (spelled contact…, as on the website)", () => {
    assert.equal(OWNER_EMAIL, "contactchaitanyaraj@gmail.com");
  });
});

describe("the note to the practice", () => {
  const def = listeningDefinition();
  const answers: Answers = { q_self_rating: 4, q_where: "both" };
  const result = computeResult(def, answers);
  const base = { assessmentTitle: "Mood Self-Assessment", completedAt: new Date("2026-10-30T10:00:00Z"), result, siteName: "Chaitanya Raj", logoUrl: "https://example.com/logo.png", adminUrl: "https://example.com/admin/assessments/x/submissions" };

  it("uses the site colours, the logo and a button to the admin", () => {
    const mail = renderAdminNotification({ ...base, name: "Asha Verma", email: "asha@example.com", shared: true });
    assert.match(mail.html, /#1F5C56/);
    assert.match(mail.html, /#123A36/);
    assert.match(mail.html, /<img src="https:\/\/example\.com\/logo\.png"/);
    assert.match(mail.html, /href="https:\/\/example\.com\/admin\/assessments\/x\/submissions"/);
    assert.match(mail.text, /Open the admin: https:\/\/example\.com\/admin/);
  });

  it("escapes what the participant typed", () => {
    const mail = renderAdminNotification({ ...base, name: "<script>alert(1)</script>", email: "a@example.com", shared: true });
    assert.equal(mail.html.includes("<script>"), false);
    assert.match(mail.html, /&lt;script&gt;/);
  });

  it("says nothing about the person when they did not share", () => {
    const mail = renderAdminNotification({ ...base, name: "Asha Verma", email: "asha@example.com", shared: false });
    for (const part of [mail.subject, mail.html, mail.text]) assert.equal(/asha/i.test(part), false);
    assert.match(mail.subject, /^New self-check completed/);
  });
});

describe("background work", () => {
  it("returns at once, logs a failure instead of throwing, and finishes the work", async () => {
    let done = false;
    const running = runInBackground("test", async () => {
      await new Promise((r) => setTimeout(r, 10));
      done = true;
    });
    assert.equal(done, false);
    await running;
    assert.equal(done, true);
    await assert.doesNotReject(runInBackground("failing", async () => Promise.reject(new Error("boom"))));
  });
});
