import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeVisibility } from "../../lib/assessments/conditions";
import {
  defaultDefinition,
  newQuestion,
  normalizeDefinition,
  toPublicForm,
  validateDefinition,
} from "../../lib/assessments/definition";
import { listeningDefinition, LISTENING_META } from "../../lib/assessments/templates/listening";
import { parseAnswer, validateAnswers } from "../../lib/assessments/validation";
import { fillTokens } from "../../lib/assessments/text";
import type { AssessmentDefinition, Question, Section } from "../../lib/assessments/types";
import { miniDefinition } from "./helpers";

function formWithGate(): Section[] {
  return [
    {
      id: "s1",
      title: "Gate",
      questions: [
        { ...newQuestion("yes_no"), id: "gate", label: "Do you work?", required: true },
        { ...newQuestion("short_text"), id: "job", label: "Job title", required: true, visibility: { action: "show", match: "all", rules: [{ questionId: "gate", operator: "equals", value: "yes" }] } },
      ],
    },
    {
      id: "s2",
      title: "Skippable",
      visibility: { action: "hide", match: "all", rules: [{ questionId: "gate", operator: "equals", value: "no" }] },
      questions: [{ ...newQuestion("short_text"), id: "detail", label: "Detail", required: true, visibility: { action: "show", match: "all", rules: [{ questionId: "job", operator: "answered" }] } }],
    },
  ];
}

describe("conditional visibility", () => {
  it("shows a question when its rule holds and hides it otherwise", () => {
    const sections = formWithGate();
    assert.equal(computeVisibility(sections, { gate: "yes" }).questions.job, true);
    assert.equal(computeVisibility(sections, { gate: "no" }).questions.job, false);
    assert.equal(computeVisibility(sections, {}).questions.job, false);
  });

  it("skips a whole section with a hide rule", () => {
    const sections = formWithGate();
    const no = computeVisibility(sections, { gate: "no" });
    assert.equal(no.sections.s2, false);
    assert.equal(no.questions.detail, false);
    const yes = computeVisibility(sections, { gate: "yes", job: "Nurse" });
    assert.equal(yes.sections.s2, true);
    assert.equal(yes.questions.detail, true);
  });

  it("cascades: a rule on a hidden question is false", () => {
    const sections = formWithGate();
    // job is hidden (gate = no) even though a stale answer exists, so `detail` stays hidden.
    const v = computeVisibility(sections, { gate: "no", job: "Stale" });
    assert.equal(v.questions.detail, false);
  });

  it("supports any/all matching and numeric, in and contains operators", () => {
    const sections: Section[] = [
      {
        id: "s",
        title: "S",
        questions: [
          { ...newQuestion("rating5"), id: "r" },
          { ...newQuestion("checkbox"), id: "c", choices: [{ id: "x", label: "X" }, { id: "y", label: "Y" }] },
          { ...newQuestion("short_text"), id: "any", visibility: { action: "show", match: "any", rules: [{ questionId: "r", operator: "gte", value: 4 }, { questionId: "c", operator: "contains", value: "y" }] } },
          { ...newQuestion("short_text"), id: "all", visibility: { action: "show", match: "all", rules: [{ questionId: "r", operator: "lt", value: 3 }, { questionId: "c", operator: "in", value: ["x", "y"] }] } },
        ],
      },
    ];
    assert.equal(computeVisibility(sections, { r: 5 }).questions.any, true);
    assert.equal(computeVisibility(sections, { r: 1, c: ["y"] }).questions.any, true);
    assert.equal(computeVisibility(sections, { r: 1 }).questions.any, false);
    assert.equal(computeVisibility(sections, { r: 2, c: ["x"] }).questions.all, true);
    assert.equal(computeVisibility(sections, { r: 4, c: ["x"] }).questions.all, false);
  });
});

describe("validateAnswers", () => {
  it("requires only visible questions", () => {
    const def = { sections: formWithGate() } as AssessmentDefinition;
    const hidden = validateAnswers(def, { gate: "no" });
    assert.equal(hidden.ok, true, JSON.stringify(hidden.errors));
    const shown = validateAnswers(def, { gate: "yes" });
    assert.equal(shown.ok, false);
    assert.ok(shown.errors.job);
    assert.equal(validateAnswers(def, { gate: "yes", job: "Nurse", detail: "x" }).ok, true);
  });

  it("drops answers to hidden and unknown questions", () => {
    const def = { sections: formWithGate() } as AssessmentDefinition;
    const v = validateAnswers(def, { gate: "no", job: "Stale", bogus: "1" });
    assert.deepEqual(v.clean, { gate: "no" });
  });

  it("rejects values outside the question's constraints", () => {
    const rating: Question = { ...newQuestion("rating5"), id: "r" };
    assert.equal(parseAnswer(rating, 6).kind, "invalid");
    assert.equal(parseAnswer(rating, 0).kind, "invalid");
    assert.equal(parseAnswer(rating, 2.5).kind, "invalid");
    assert.equal(parseAnswer(rating, "4").kind, "ok");
    const radio: Question = { ...newQuestion("radio"), id: "q", choices: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };
    assert.equal(parseAnswer(radio, "zzz").kind, "invalid");
    const email: Question = { ...newQuestion("email"), id: "e" };
    assert.equal(parseAnswer(email, "not-an-email").kind, "invalid");
    assert.equal(parseAnswer(email, "A@B.com").kind, "ok");
    const date: Question = { ...newQuestion("date"), id: "d" };
    assert.equal(parseAnswer(date, "2026-02-30").kind, "invalid");
    assert.equal(parseAnswer(date, "2026-02-28").kind, "ok");
    const slider: Question = { ...newQuestion("slider"), id: "s", min: 0, max: 100, step: 10 };
    assert.equal(parseAnswer(slider, 55).kind, "invalid");
    assert.equal(parseAnswer(slider, 50).kind, "ok");
    const text: Question = { ...newQuestion("short_text"), id: "t", maxLength: 5 };
    assert.equal(parseAnswer(text, "toolong").kind, "invalid");
  });

  it("strips HTML and control characters from text answers", () => {
    const q: Question = { ...newQuestion("long_text"), id: "t" };
    const parsed = parseAnswer(q, 'Hello <script>alert(1)</script> world\u0007');
    assert.equal(parsed.kind, "ok");
    if (parsed.kind === "ok") assert.equal(parsed.value, "Hello alert(1) world");
  });

  it("validates peer answers against the participant's visible questions", () => {
    const def = listeningDefinition();
    const self = { q_where: "work" };
    const v = validateAnswers(def, { q_attn_work_1: 4, q_attn_home_1: 2 }, { mode: "peer", contextAnswers: self });
    assert.equal(v.clean.q_attn_work_1, 4);
    assert.equal("q_attn_home_1" in v.clean, false);
    assert.ok(v.errors.q_attn_work_2); // required, asked of peers, still missing
    assert.equal("q_self_rating" in v.errors, false); // not asked of peers
  });
});

describe("definition normalising and validation", () => {
  it("accepts the listening starter template without errors", () => {
    const report = validateDefinition(listeningDefinition(), LISTENING_META);
    assert.deepEqual(report.errors, []);
  });

  it("matches the brief: nine sections, four skills, four levels, ~12 minutes", () => {
    const def = listeningDefinition();
    assert.equal(def.sections.length, 9);
    assert.deepEqual(def.scoring.skills.map((s) => s.name), ["Attention", "Understanding", "Restraint", "Curiosity"]);
    assert.deepEqual(def.scoring.levels.map((l) => l.label), ["Waiting", "Hearing", "Listening", "Attentive"]);
    assert.equal(LISTENING_META.estimatedMinutes, 12);
  });

  it("round-trips through normalizeDefinition unchanged", () => {
    const def = listeningDefinition();
    assert.deepEqual(normalizeDefinition(JSON.parse(JSON.stringify(def))), def);
  });

  it("drops unknown keys and sanitises text", () => {
    const dirty = {
      ...miniDefinition(),
      evil: "<script>1</script>",
      intro: { heading: "<img src=x onerror=alert(1)>Hi", body: "ok", extra: 1 },
    };
    const clean = normalizeDefinition(dirty) as AssessmentDefinition & { evil?: string };
    assert.equal("evil" in clean, false);
    assert.equal(clean.intro.heading, "Hi");
  });

  it("never keeps executable-looking rule payloads as anything but data", () => {
    const def = normalizeDefinition({
      sections: [{ id: "s", title: "S", questions: [{ id: "q", type: "short_text", label: "Q", visibility: { action: "show", match: "all", rules: [{ questionId: "p", operator: "constructor", value: "x" }] } }] }],
    });
    // Unknown operators fall back to a safe default; nothing is evaluated as code.
    assert.equal(def.sections[0].questions[0].visibility?.rules[0].operator, "equals");
  });

  it("reports broken references, duplicate ids and scoring gaps", () => {
    const def = miniDefinition();
    def.sections[0].questions[1].id = "a1"; // duplicate id
    def.sections[1].questions[0].visibility = { action: "show", match: "all", rules: [{ questionId: "ghost", operator: "equals", value: "yes" }] };
    def.sections[0].questions[2].scoring!.skillId = "nope";
    def.scoring.levels[0].min = 5;
    const messages = validateDefinition(def).errors.map((e) => e.message).join("\n");
    assert.match(messages, /Duplicate id/);
    assert.match(messages, /doesn't exist or comes later/);
    assert.match(messages, /skill that doesn't exist/);
    assert.match(messages, /start at 0/);
  });

  it("rejects visibility rules that look forward", () => {
    const def = miniDefinition();
    def.sections[0].questions[0].visibility = { action: "show", match: "all", rules: [{ questionId: "b2", operator: "answered" }] };
    assert.ok(validateDefinition(def).errors.some((e) => /comes later/.test(e.message)));
  });

  it("requires a scale with a larger maximum and options for choice questions", () => {
    const def = defaultDefinition();
    def.sections[0].questions = [
      { ...newQuestion("slider"), id: "sl", label: "S", min: 10, max: 10 },
      { ...newQuestion("radio"), id: "ra", label: "R", choices: [{ id: "only", label: "One" }] },
    ];
    const messages = validateDefinition(def).errors.map((e) => e.message).join("\n");
    assert.match(messages, /maximum value must be greater/);
    assert.match(messages, /at least two options/);
  });

  it("keeps scoring details out of the public form", () => {
    const form = toPublicForm(listeningDefinition());
    const json = JSON.stringify(form);
    assert.equal(json.includes("reverse"), false);
    assert.equal(json.includes("skillId"), false);
    assert.equal(json.includes("\"weight\""), false);
  });
});
