import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeVisibility } from "../../lib/assessments/conditions";
import { DEFAULT_CATEGORIES, normalizeDefinition, toPublicForm, validateDefinition } from "../../lib/assessments/definition";
import { computeResult } from "../../lib/assessments/scoring";
import { MOOD_META, MOOD_SELF_HARM_QUESTION_ID, moodDefinition } from "../../lib/assessments/templates/mood";
import { validateAnswers } from "../../lib/assessments/validation";
import type { Answers } from "../../lib/assessments/types";

const def = moodDefinition();
const questions = def.sections.flatMap((s) => s.questions);

/** Answers whose points add up to `total` (each question 0–3). */
function answersFor(total: number, overrides: Record<string, number> = {}): Answers {
  const answers: Answers = {};
  let left = total;
  for (const q of questions) {
    const points = overrides[q.id] ?? Math.min(3, left);
    left -= overrides[q.id] === undefined ? points : 0;
    answers[q.id] = `a${points}`;
  }
  return answers;
}

const labelFor = (total: number) => (total <= 13 ? "Minimal" : total <= 19 ? "Mild" : total <= 28 ? "Moderate" : "Severe");

describe("Mood Self-Assessment template (from the practice's Word document)", () => {
  it("has the 21 items with four statements each, category labels and no validation errors", () => {
    assert.equal(questions.length, 21);
    assert.ok(questions.every((q) => q.type === "radio" && q.choices?.length === 4 && q.required && q.tag && q.description));
    assert.deepEqual(validateDefinition(def, MOOD_META, DEFAULT_CATEGORIES).errors, []);
    assert.equal(questions[0].label, "Overall Mood & Sadness");
    assert.equal(questions[0].choices?.[3].label, "I am so sad or unhappy that I can hardly stand it.");
    assert.equal(questions[3].choices?.[0].label, "I get as much pleasure as I always did from things I enjoy."); // typo fixed
    assert.equal(def.navigation.layout, "single_page");
  });

  it("round-trips through the normaliser unchanged", () => {
    assert.deepEqual(normalizeDefinition(JSON.parse(JSON.stringify(def))), def);
  });

  it("reproduces the published total ranges for every possible total (0–63)", () => {
    for (let total = 0; total <= 63; total++) {
      const r = computeResult(def, answersFor(total));
      assert.equal(r.display?.score, total, `display score for ${total}`);
      assert.equal(r.display?.max, 63);
      assert.equal(r.level?.label, labelFor(total), `level for total ${total} (overall ${r.overall})`);
    }
  });

  it("shows no support message unless the self-harm item is endorsed", () => {
    const none = computeResult(def, answersFor(40, { [MOOD_SELF_HARM_QUESTION_ID]: 0 }));
    assert.equal(none.content.filter((c) => c.kind === "support").length, 0);
  });

  it("shows the supportive message for the 'thoughts but would not act' answer", () => {
    const r = computeResult(def, answersFor(5, { [MOOD_SELF_HARM_QUESTION_ID]: 1 }));
    const support = r.content.filter((c) => c.kind === "support");
    assert.deepEqual(support.map((c) => c.id), ["cr_support_thoughts"]);
    assert.match(support[0].text, /112/);
    assert.match(support[0].text, /14416/);
    // Even with a low total the message is shown: it depends on that answer, not the score.
    assert.equal(r.level?.label, "Minimal");
  });

  it("shows the urgent message for the two strongest answers, and only that one", () => {
    for (const option of [2, 3]) {
      const r = computeResult(def, answersFor(0, { [MOOD_SELF_HARM_QUESTION_ID]: option }));
      assert.deepEqual(r.content.filter((c) => c.kind === "support").map((c) => c.id), ["cr_support_urgent"]);
    }
  });

  it("suggests next steps by range", () => {
    const next = (total: number) => computeResult(def, answersFor(total)).content.filter((c) => c.kind === "recommendation").map((c) => c.id);
    assert.deepEqual(next(5), ["cr_next_minimal"]);
    assert.deepEqual(next(16), ["cr_next_mild"]);
    assert.deepEqual(next(24), ["cr_next_higher"]);
    assert.deepEqual(next(45), ["cr_next_higher"]);
  });

  it("requires all 21 answers and rejects statements that are not listed", () => {
    assert.equal(validateAnswers(def, {}).ok, false);
    assert.equal(Object.keys(validateAnswers(def, {}).errors).length, 21);
    assert.equal(validateAnswers(def, answersFor(10)).ok, true);
    assert.equal(validateAnswers(def, { ...answersFor(10), [questions[0].id]: "a9" }).ok, false);
    assert.equal(computeVisibility(def.sections, {}).questions[questions[20].id], true);
  });

  it("tells the truth about privacy and keeps the document's wording elsewhere", () => {
    const text = JSON.stringify(def.intro);
    assert.doesNotMatch(text, /processed locally|nothing is saved|100% private/i);
    assert.match(def.intro.subtitle, /Understanding Your Emotional Wellbeing/);
    assert.match(def.intro.badge, /Confidential & Self-Paced/);
    assert.match(def.intro.disclaimer, /not a clinical diagnosis or medical evaluation/);
  });

  it("does not leak scoring to participants but keeps the numbering labels", () => {
    const form = toPublicForm(def);
    const json = JSON.stringify(form);
    assert.equal(json.includes("points"), true); // choice points are part of the question definition...
    assert.equal(json.includes("\"scoring\""), false); // ...but the scoring rules, levels and messages are not
    assert.equal(json.includes("Tele-MANAS"), false);
    assert.equal(form.sections[0].questions[8].tag, "Thoughts About Life");
  });

  it("flags a support message in the practice notification", async () => {
    const { renderAdminNotification } = await import("../../lib/assessments/server/emailTemplates");
    const r = computeResult(def, answersFor(30, { [MOOD_SELF_HARM_QUESTION_ID]: 2 }));
    const mail = renderAdminNotification({ name: "A", email: "a@example.com", assessmentTitle: "Mood", completedAt: new Date(), result: r, siteName: "Site" });
    assert.match(mail.text, /support message/);
    assert.match(mail.text, /Overall score: 32 \/ 63 \(Severe\)/); // 30 from the other items + 2 for the self-harm item
  });
});
