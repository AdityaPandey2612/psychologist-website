import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePeerComparison, computeResult, levelFor, normalizeAnswer } from "../../lib/assessments/scoring";
import { newQuestion } from "../../lib/assessments/definition";
import { listeningDefinition } from "../../lib/assessments/templates/listening";
import { validateAnswers } from "../../lib/assessments/validation";
import type { Answers, Question } from "../../lib/assessments/types";
import { miniDefinition } from "./helpers";

const NOW = new Date("2026-01-01T00:00:00Z");

describe("normalizeAnswer", () => {
  it("maps a 1–5 rating onto 0..1", () => {
    const q = newQuestion("rating5");
    assert.equal(normalizeAnswer(q, 1), 0);
    assert.equal(normalizeAnswer(q, 3), 0.5);
    assert.equal(normalizeAnswer(q, 5), 1);
  });

  it("maps custom rating scales and sliders using their own bounds", () => {
    const scale: Question = { ...newQuestion("rating_scale"), min: 0, max: 10 };
    assert.equal(normalizeAnswer(scale, 5), 0.5);
    const slider: Question = { ...newQuestion("slider"), min: 20, max: 40 };
    assert.equal(normalizeAnswer(slider, 30), 0.5);
  });

  it("scores yes/no, choice points and multi-select", () => {
    assert.equal(normalizeAnswer(newQuestion("yes_no"), "yes"), 1);
    assert.equal(normalizeAnswer(newQuestion("yes_no"), "no"), 0);
    const radio: Question = {
      ...newQuestion("radio"),
      choices: [
        { id: "x", label: "X", points: 0 },
        { id: "y", label: "Y", points: 5 },
        { id: "z", label: "Z", points: 10 },
      ],
    };
    assert.equal(normalizeAnswer(radio, "y"), 0.5);
    const multi: Question = {
      ...newQuestion("checkbox"),
      choices: [
        { id: "a", label: "A", points: 1 },
        { id: "b", label: "B", points: 1 },
        { id: "c", label: "C", points: 2 },
      ],
    };
    assert.equal(normalizeAnswer(multi, ["a", "c"]), 0.75);
  });

  it("returns null for text and unknown values", () => {
    assert.equal(normalizeAnswer(newQuestion("short_text"), "hello"), null);
    assert.equal(normalizeAnswer(newQuestion("rating5"), undefined), null);
  });
});

describe("computeResult", () => {
  it("normalises skills and the overall score to 0–100", () => {
    const def = miniDefinition();
    // A: a1=5 (1.0), a2=1 reversed (1.0) -> 100.  B: b1=3 (0.5), b2=5 (1.0) -> 75.
    const r = computeResult(def, { a1: 5, a2: 1, b1: 3, b2: 5 }, { now: NOW });
    assert.equal(r.skills.find((s) => s.id === "A")?.score, 100);
    assert.equal(r.skills.find((s) => s.id === "B")?.score, 75);
    assert.equal(r.overall, 88); // mean(100, 75) = 87.5 -> 88
    assert.equal(r.level?.label, "High");
    assert.equal(r.scored, true);
  });

  it("applies reverse scoring", () => {
    const def = miniDefinition();
    const high = computeResult(def, { a1: 3, a2: 5, b1: 3 }, { now: NOW }).skills[0].score;
    const low = computeResult(def, { a1: 3, a2: 1, b1: 3 }, { now: NOW }).skills[0].score;
    assert.equal(high, 25); // (0.5 + 0) / 2
    assert.equal(low, 75); // (0.5 + 1) / 2
  });

  it("honours question and skill weights", () => {
    const def = miniDefinition();
    def.sections[0].questions[0].scoring!.weight = 3; // a1 weight 3
    // a1=5 -> 1.0 (w3), a2=5 reversed -> 0.0 (w1): (3*1 + 0)/4 = 75
    const r = computeResult(def, { a1: 5, a2: 5, b1: 5, b2: 5 }, { now: NOW });
    assert.equal(r.skills.find((s) => s.id === "A")?.score, 75);

    def.scoring.skills[1].weight = 3; // B counts three times as much
    // A = 75, B = 100 -> (75 + 300) / 4 = 93.75 -> 94
    assert.equal(computeResult(def, { a1: 5, a2: 5, b1: 5, b2: 5 }, { now: NOW }).overall, 94);
  });

  it("leaves unanswered optional questions out instead of scoring them as zero", () => {
    const def = miniDefinition();
    const r = computeResult(def, { a1: 5, a2: 1, b1: 5 }, { now: NOW }); // b2 (optional) skipped
    assert.equal(r.skills.find((s) => s.id === "B")?.score, 100);
    assert.equal(r.stats.skippedOptional, 1);
    assert.equal(r.skills.find((s) => s.id === "B")?.answered, 1);
    assert.equal(r.skills.find((s) => s.id === "B")?.total, 2);
  });

  it("excludes questions hidden by conditional logic from scoring", () => {
    const def = miniDefinition();
    def.sections[0].questions.push({ ...newQuestion("yes_no"), id: "gate", label: "Gate" });
    def.sections[1].questions[0].visibility = {
      action: "show",
      match: "all",
      rules: [{ questionId: "gate", operator: "equals", value: "yes" }],
    };
    const answers: Answers = { a1: 5, a2: 1, b1: 3, b2: 1, gate: "no" };
    const r = computeResult(def, answers, { now: NOW });
    assert.equal(r.skills.find((s) => s.id === "B")?.score, 50); // b2 ignored although answered
    const shown = computeResult(def, { ...answers, gate: "yes" }, { now: NOW });
    assert.equal(shown.skills.find((s) => s.id === "B")?.score, 25); // (0.5 + 0)/2
  });

  it("returns an unscored result when nothing scorable was answered", () => {
    const def = miniDefinition();
    const r = computeResult(def, {}, { now: NOW });
    assert.equal(r.scored, false);
    assert.equal(r.overall, null);
    assert.equal(r.level, null);
  });

  it("picks the level with the highest threshold at or below the score", () => {
    const { levels } = miniDefinition().scoring;
    assert.equal(levelFor(levels, 0)?.label, "Low");
    assert.equal(levelFor(levels, 39)?.label, "Low");
    assert.equal(levelFor(levels, 40)?.label, "Mid");
    assert.equal(levelFor(levels, 69)?.label, "Mid");
    assert.equal(levelFor(levels, 70)?.label, "High");
    assert.equal(levelFor(levels, 100)?.label, "High");
  });

  it("ranks strengths and growth areas without overlap", () => {
    const def = miniDefinition();
    def.scoring.strengthsCount = 1;
    def.scoring.growthCount = 1;
    const r = computeResult(def, { a1: 5, a2: 1, b1: 1, b2: 1 }, { now: NOW });
    assert.deepEqual(r.strengths.map((s) => s.skillId), ["A"]);
    assert.deepEqual(r.growth.map((s) => s.skillId), ["B"]);
  });

  it("is deterministic", () => {
    const def = listeningDefinition();
    const answers = extremeListeningAnswers("best");
    assert.deepEqual(computeResult(def, answers, { now: NOW }), computeResult(def, answers, { now: NOW }));
  });
});

/** Best = every positive item 5 and reversed item 1; worst is the opposite. */
function extremeListeningAnswers(kind: "best" | "worst"): Answers {
  const def = listeningDefinition();
  const answers: Answers = { q_self_rating: 5, q_where: "both" };
  for (const q of def.sections.flatMap((s) => s.questions)) {
    if (q.type === "rating5" && q.scoring?.scored) {
      const high = kind === "best";
      answers[q.id] = q.scoring.reverse ? (high ? 1 : 5) : high ? 5 : 1;
    }
  }
  return answers;
}

describe("listening template", () => {
  const def = listeningDefinition();

  it("scores a high-habit participant as Attentive and a low one as Waiting", () => {
    const top = computeResult(def, extremeListeningAnswers("best"), { now: NOW });
    const bottom = computeResult(def, extremeListeningAnswers("worst"), { now: NOW });
    assert.equal(top.overall, 100);
    assert.equal(top.level?.label, "Attentive");
    assert.equal(bottom.overall, 0);
    assert.equal(bottom.level?.label, "Waiting");
    assert.equal(bottom.selfPerception?.status, "over"); // rated self 5/5 but answers say 0
    assert.equal(top.selfPerception?.status, "aligned");
  });

  it("produces work and home scores and a comparison", () => {
    const answers: Answers = { q_self_rating: 3, q_where: "both" };
    for (const q of def.sections.flatMap((s) => s.questions)) {
      if (q.type === "rating5" && q.scoring?.scored) {
        const good = q.scoring.reverse ? 1 : 5;
        const bad = q.scoring.reverse ? 5 : 1;
        answers[q.id] = q.scoring.contextId === "home" ? bad : good;
      }
    }
    const r = computeResult(def, answers, { now: NOW });
    const work = r.contexts.find((c) => c.id === "work");
    const home = r.contexts.find((c) => c.id === "home");
    assert.ok((work?.score ?? 0) > (home?.score ?? 100));
    assert.equal(r.contextComparison?.higherId, "work");
    assert.ok(r.contextComparison!.diff >= 10);
  });

  it("only asks and scores the context the participant picked", () => {
    const answers: Answers = { q_self_rating: 3, q_where: "work" };
    for (const q of def.sections.flatMap((s) => s.questions)) {
      if (q.type === "rating5" && q.scoring?.scored) answers[q.id] = 3; // includes hidden home answers
    }
    const v = validateAnswers(def, answers);
    assert.equal(v.ok, true, JSON.stringify(v.errors));
    assert.equal(v.visibility.questions["q_attn_home_1"], false);
    assert.equal("q_attn_home_1" in v.clean, false);
    const r = computeResult(def, v.clean, { now: NOW });
    assert.equal(r.contexts.find((c) => c.id === "home")?.score, null);
    assert.equal(r.contextComparison, null);
  });

  it("personalises the 30-day plan to the weakest skills", () => {
    const answers: Answers = { q_self_rating: 3, q_where: "both" };
    for (const q of def.sections.flatMap((s) => s.questions)) {
      if (q.type === "rating5" && q.scoring?.scored) {
        const goodSkill = q.scoring.skillId === "attention" || q.scoring.skillId === "understanding";
        answers[q.id] = goodSkill ? (q.scoring.reverse ? 1 : 5) : q.scoring.reverse ? 5 : 1;
      }
    }
    const r = computeResult(def, answers, { now: NOW });
    assert.deepEqual(r.growth.map((g) => g.skillId).sort(), ["curiosity", "restraint"]);
    const names = new Set(r.practicePlan!.weeks.flatMap((w) => w.practices.map((p) => p.skillName).filter(Boolean)));
    assert.deepEqual([...names].sort(), ["Curiosity", "Restraint"]);
    assert.equal(r.practicePlan!.weeks.length, 4);
    assert.ok(r.content.some((c) => c.id === "cr_patience_low"));
  });
});

describe("peer comparison", () => {
  it("compares only peer-enabled questions and averages peers", () => {
    const def = miniDefinition();
    for (const q of def.sections.flatMap((s) => s.questions)) q.peer = { enabled: true };
    const self: Answers = { a1: 5, a2: 1, b1: 5, b2: 5 };
    const peers: Answers[] = [
      { a1: 3, a2: 3, b1: 5, b2: 5 }, // A = 50, B = 100
      { a1: 1, a2: 5, b1: 5, b2: 5 }, // A = 0, B = 100
    ];
    const cmp = computePeerComparison(def, self, peers)!;
    assert.equal(cmp.responses, 2);
    const a = cmp.skills.find((s) => s.id === "A")!;
    assert.equal(a.self, 100);
    assert.equal(a.peer, 25);
    assert.equal(a.diff, 75);
    assert.equal(cmp.skills.find((s) => s.id === "B")!.diff, 0);
  });

  it("returns null without peer responses", () => {
    assert.equal(computePeerComparison(miniDefinition(), {}, []), null);
  });
});
