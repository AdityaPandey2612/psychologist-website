import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_CATEGORIES, normalizeDefinition, normalizeMeta, toPublicForm, validateDefinition } from "../../lib/assessments/definition";
import { headlineParts, planStepPrefix, resultEyebrow } from "../../lib/assessments/presentation";
import { computeResult, roundRobinPlan, zoneFor } from "../../lib/assessments/scoring";
import { CHARISMA_META, charismaDefinition } from "../../lib/assessments/templates/charisma";
import { getTemplate } from "../../lib/assessments/templates";
import type { Answers, SkillResult } from "../../lib/assessments/types";
import { validateAnswers } from "../../lib/assessments/validation";
import { MAP_SIZE, PLOT, plotX, plotY, zoneMapLayout } from "../../lib/assessments/zoneMapLayout";

const def = charismaDefinition();
const questions = def.sections.flatMap((s) => s.questions);

/** Answers that put each part at the given level (1–5); reverse-worded statements are answered the other way round. */
function levels(by: Record<string, number>): Answers {
  const answers: Answers = {};
  for (const q of questions) {
    const level = by[q.scoring?.skillId ?? ""] ?? 3;
    answers[q.id] = q.scoring?.reverse ? 6 - level : level;
  }
  return answers;
}

describe("the Charisma Diagnostic template", () => {
  it("has the 34 statements in four parts, six of them worded in reverse, and passes validation", () => {
    assert.equal(questions.length, 34);
    assert.deepEqual(def.sections.map((s) => s.questions.length), [10, 10, 8, 6]);
    assert.equal(questions.filter((q) => q.scoring?.reverse).length, 6);
    assert.ok(questions.every((q) => q.type === "rating5" && q.required && q.minLabel === "Not like me" && q.maxLabel === "Very like me"));
    assert.deepEqual(validateDefinition(def, CHARISMA_META, DEFAULT_CATEGORIES).errors, []);
    assert.equal(def.scoring.levels.length, 0, "a zone assessment has no levels");
  });

  it("is offered with the other templates and survives the normaliser unchanged", () => {
    assert.ok(getTemplate("charisma-diagnostic"));
    assert.deepEqual(normalizeDefinition(JSON.parse(JSON.stringify(def))), def);
  });

  it("places people in the four zones from their warmth and competence", () => {
    const zone = (warmth: number, competence: number) => computeResult(def, levels({ warmth, competence })).zone;
    assert.equal(zone(5, 5)?.label, "Charisma Zone");
    assert.equal(zone(5, 2)?.label, "Warm Zone");
    assert.equal(zone(2, 5)?.label, "Capable Zone");
    assert.equal(zone(2, 2)?.label, "Building Zone");
    const warm = zone(5, 2);
    assert.deepEqual([warm?.key, warm?.x, warm?.y, warm?.xLabel, warm?.yLabel, warm?.threshold], ["topLeft", 25, 100, "Competence", "Warmth", 65]);
  });

  it("puts the threshold exactly: 65 is high, 64 is not", () => {
    const skills = (x: number, y: number): SkillResult[] => [
      { id: "competence", name: "Competence", score: x, answered: 1, total: 1 },
      { id: "warmth", name: "Warmth", score: y, answered: 1, total: 1 },
    ];
    const config = def.scoring.zoneMap;
    assert.equal(zoneFor(config, skills(65, 65))?.key, "topRight");
    assert.equal(zoneFor(config, skills(64, 65))?.key, "topLeft");
    assert.equal(zoneFor(config, skills(65, 64))?.key, "bottomRight");
    assert.equal(zoneFor(config, skills(64, 64))?.key, "bottomLeft");
    assert.equal(zoneFor(config, [{ id: "competence", name: "Competence", score: null, answered: 0, total: 1 }, ...skills(80, 80).slice(1)]), null, "no zone without both scores");
    assert.equal(zoneFor(undefined, skills(80, 80)), null);
  });

  it("gives a 7 day plan taking one step at a time from every part, the lowest-scoring part first", () => {
    const result = computeResult(def, levels({ warmth: 2, competence: 5, dial: 4, footprint: 3 }));
    assert.equal(result.practicePlan?.steps, true);
    const plan = result.practicePlan?.weeks ?? [];
    assert.deepEqual(plan.map((s) => s.title), ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]);
    const skill = (id: string) => def.scoring.skills.find((s) => s.id === id)!;
    // Warmth is lowest, then footprint (50), dial (75), competence (100): first steps in that order, then second steps.
    assert.deepEqual(
      plan.map((s) => s.practices[0].text),
      [skill("warmth").planItems![0], skill("footprint").planItems![0], skill("dial").planItems![0], skill("competence").planItems![0], skill("warmth").planItems![1], skill("footprint").planItems![1], skill("dial").planItems![1]],
    );
    assert.equal(plan[0].practices[0].skillName, "Warmth");
    assert.ok(plan.every((s) => s.days === ""));
  });

  it("names the two strongest parts as strengths and the two lowest as gaps, in the admin's wording", () => {
    const result = computeResult(def, levels({ warmth: 2, competence: 5, dial: 4, footprint: 3 }));
    assert.deepEqual(result.strengths.map((s) => s.skillId), ["competence", "dial"]);
    assert.deepEqual(result.growth.map((g) => g.skillId), ["warmth", "footprint"]);
    assert.equal(result.strengths[0].text, def.scoring.skills.find((s) => s.id === "competence")!.strengthText);
    assert.equal(result.growth[0].text, def.scoring.skills.find((s) => s.id === "warmth")!.growthText);
  });

  it("reaches the participant without the scoring set-up", () => {
    const form = JSON.stringify(toPublicForm(def));
    for (const secret of ["zoneMap", "planItems", "strengthText", "growthText", "weight", "reverse"]) assert.equal(form.includes(`"${secret}"`), false, secret);
    assert.deepEqual(validateAnswers(def, levels({ warmth: 4 })).ok, true);
  });
});

describe("round-robin plan", () => {
  it("takes the first step of every list, then the second, until the length is reached", () => {
    const plan = roundRobinPlan(
      [
        { skill: "A", items: ["a1", "a2", "a3"] },
        { skill: "B", items: ["b1", "b2"] },
        { skill: "C", items: ["c1"] },
      ],
      5,
    );
    assert.deepEqual(plan.map((p) => p.text), ["a1", "b1", "c1", "a2", "b2"]);
    assert.deepEqual(plan.map((p) => p.skill), ["A", "B", "C", "A", "B"]);
  });

  it("stops when the steps run out, uses a repeated step once and handles empty lists", () => {
    assert.deepEqual(roundRobinPlan([{ skill: "A", items: ["x"] }, { skill: "B", items: ["x", "y"] }], 10).map((p) => p.text), ["x", "y"]);
    assert.deepEqual(roundRobinPlan([{ skill: "A", items: [] }], 3), []);
    assert.deepEqual(roundRobinPlan([], 3), []);
  });
});

describe("zone map and numbered plan settings are cleaned and checked", () => {
  const zones = (label = "Zone") => ({ topLeft: { label, description: "" }, topRight: { label, description: "" }, bottomLeft: { label, description: "" }, bottomRight: { label, description: "" } });
  const withZone = (patch: Record<string, unknown>) => {
    const copy = JSON.parse(JSON.stringify(def));
    copy.scoring.zoneMap = { ...copy.scoring.zoneMap, ...patch };
    return normalizeDefinition(copy);
  };
  const errors = (d = def) => validateDefinition(d, CHARISMA_META, DEFAULT_CATEGORIES).errors.map((e) => e.message);

  it("clamps the threshold to 1–99 and defaults it to 65", () => {
    assert.equal(withZone({ threshold: 150 }).scoring.zoneMap?.threshold, 99);
    assert.equal(withZone({ threshold: -5 }).scoring.zoneMap?.threshold, 1);
    assert.equal(withZone({ threshold: "abc" }).scoring.zoneMap?.threshold, 65);
  });

  it("needs two different existing skills and a name for every zone", () => {
    assert.match(errors(withZone({ ySkillId: "competence" })).join("|"), /two different skills/);
    assert.match(errors(withZone({ ySkillId: "gone" })).join("|"), /plots a skill that doesn't exist/);
    assert.match(errors(withZone({ zones: { ...zones("Named"), topLeft: { label: "", description: "x" } } })).join("|"), /Every zone on the map needs a name/);
    assert.deepEqual(errors(), []);
  });

  it("drops a zone map without two skills, and keeps an empty list of levels only for a zone assessment", () => {
    const none = JSON.parse(JSON.stringify(def));
    delete none.scoring.zoneMap.ySkillId;
    const cleaned = normalizeDefinition(none);
    assert.equal(cleaned.scoring.zoneMap, undefined);
    assert.equal(cleaned.scoring.levels.length, 3, "without a zone map the default levels are back");
    assert.equal(normalizeDefinition(JSON.parse(JSON.stringify(def))).scoring.levels.length, 0);
  });

  it("clamps the plan length to 1–30, trims the step word, and asks for steps on at least one skill", () => {
    const set = (plan: Record<string, unknown>) => {
      const copy = JSON.parse(JSON.stringify(def));
      copy.scoring.practicePlan = { ...copy.scoring.practicePlan, ...plan };
      return normalizeDefinition(copy);
    };
    assert.equal(set({ length: 99 }).scoring.practicePlan.length, 30);
    assert.equal(set({ length: 0 }).scoring.practicePlan.length, 1);
    assert.equal(set({ length: "" }).scoring.practicePlan.length, undefined);
    assert.equal(set({ labelPrefix: "  Day  " }).scoring.practicePlan.labelPrefix, "Day");
    assert.equal(planStepPrefix(undefined), "Step");
    assert.equal(planStepPrefix("  Day "), "Day");

    const noSteps = JSON.parse(JSON.stringify(def));
    for (const skill of noSteps.scoring.skills) delete skill.planItems;
    assert.match(errors(normalizeDefinition(noSteps)).join("|"), /no skill has plan steps/);
  });

  it("keeps the result page and email settings, switching the report on by default", () => {
    const fresh = normalizeDefinition({});
    assert.equal(fresh.results.reportDownload, true);
    assert.equal(fresh.email.attachReport, true);
    const off = JSON.parse(JSON.stringify(def));
    off.results.reportDownload = false;
    off.email.attachReport = false;
    off.results.eyebrow = "  Your charisma map ";
    const kept = normalizeDefinition(off);
    assert.equal(kept.results.reportDownload, false);
    assert.equal(kept.email.attachReport, false);
    assert.equal(kept.results.eyebrow, "Your charisma map");
    const odd = JSON.parse(JSON.stringify(def));
    odd.results.reportDownload = "no";
    odd.email.attachReport = 0;
    assert.equal(normalizeDefinition(odd).results.reportDownload, true, "only a real false switches it off");
    assert.equal(normalizeDefinition(odd).email.attachReport, true);
  });
});

describe("the result headline", () => {
  it("fills in the first name and puts the zone in a piece of its own", () => {
    assert.deepEqual(headlineParts("You are in the {zone}.", "Asha", "Warm Zone"), [{ text: "You are in the " }, { text: "Warm Zone", emphasis: true }, { text: "." }]);
    assert.deepEqual(headlineParts("{name}, you are in {zone}", "Asha", "Warm Zone"), [{ text: "Asha, you are in " }, { text: "Warm Zone", emphasis: true }]);
    assert.deepEqual(headlineParts("Your results", "Asha", undefined), [{ text: "Your results" }]);
  });

  it("falls back to 'Your results' when the headline needs a zone the result does not have", () => {
    assert.deepEqual(headlineParts("You are in the {zone}.", "Asha", undefined), [{ text: "Your results" }]);
    assert.deepEqual(headlineParts("", undefined, undefined), [{ text: "Your results" }]);
  });

  it("uses the admin's small heading, or the title", () => {
    assert.equal(resultEyebrow({ eyebrow: " Your charisma map " }, "Charisma Diagnostic"), "Your charisma map");
    assert.equal(resultEyebrow({}, "Charisma Diagnostic"), "Charisma Diagnostic");
  });
});

describe("thumbnail addresses", () => {
  const meta = (thumbnailUrl: unknown) => normalizeMeta({ title: "T", slug: "t", description: "d", thumbnailUrl }, DEFAULT_CATEGORIES).thumbnailUrl;

  it("keeps a Firebase Storage address or a site path and drops anything else", () => {
    const stored = "https://firebasestorage.googleapis.com/v0/b/bucket/o/assessment-thumbnails%2Fabc.png?alt=media&token=t";
    assert.equal(meta(stored), stored);
    assert.equal(meta("/images/photo.jpg"), "/images/photo.jpg");
    assert.equal(meta("https://evil.example/x.png"), undefined);
    assert.equal(meta("//evil.example/x.png"), undefined);
    assert.equal(meta("javascript:alert(1)"), undefined);
    assert.equal(meta("http://firebasestorage.googleapis.com/v0/b/x/o/y"), undefined);
    assert.equal(meta(""), undefined);
    assert.equal(meta(42), undefined);
  });
});

describe("zone map layout", () => {
  const config = { zones: { topLeft: { label: "Warm Zone" }, topRight: { label: "Charisma Zone" }, bottomLeft: { label: "Quiet Zone" }, bottomRight: { label: "Capable Zone" } } };
  const zone = (x: number, y: number, threshold = 65) => ({ key: "topRight", label: "Charisma Zone", x, y, threshold });

  it("maps 0 to the bottom left and 100 to the top right, and keeps values on the plot", () => {
    assert.ok(PLOT.left + PLOT.size < MAP_SIZE && PLOT.top + PLOT.size < MAP_SIZE);
    assert.equal(plotX(0), PLOT.left);
    assert.equal(plotX(100), PLOT.left + PLOT.size);
    assert.equal(plotY(0), PLOT.top + PLOT.size);
    assert.equal(plotY(100), PLOT.top);
    assert.equal(plotX(250), plotX(100));
    assert.equal(plotX(Number.NaN), plotX(0));
  });

  it("tiles the plot into four quadrants that meet at the threshold", () => {
    const layout = zoneMapLayout(zone(80, 90), config);
    const q = layout.quadrants;
    assert.equal(q.topLeft.width + q.topRight.width, PLOT.size);
    assert.equal(q.topLeft.height + q.bottomLeft.height, PLOT.size);
    assert.equal(layout.split.x, plotX(65));
    assert.equal(layout.split.y, plotY(65));
  });

  it("never draws a zone name over the dot or the word 'You', and keeps every name on the plot", () => {
    const steps = [0, 5, 12, 25, 40, 50, 64, 65, 66, 80, 95, 100];
    for (const x of steps) {
      for (const y of steps) {
        const layout = zoneMapLayout(zone(x, y), config);
        for (const name of layout.names) {
          const width = name.text.length * 6.8;
          const left = name.anchor === "end" ? name.x - width : name.x;
          assert.ok(left >= PLOT.left - 0.01 && left + width <= PLOT.left + PLOT.size + 0.01, `${name.text} at ${x}/${y} leaves the plot`);
          const near = Math.abs(name.y - layout.dot.y) < 20 && left < layout.dot.x + 20 && left + width > layout.dot.x - 20;
          assert.equal(near, false, `${name.text} sits on the dot at ${x}/${y}`);
        }
      }
    }
  });
});
