import { computeVisibility, isAnswered, type Visibility } from "./conditions";
import { ratingBounds } from "./validation";
import type {
  AnswerValue,
  Answers,
  AssessmentDefinition,
  AssessmentResult,
  ContentResult,
  ContextResult,
  HabitResult,
  Level,
  PeerComparison,
  PlanWeekResult,
  Question,
  ResultZone,
  ScoreCondition,
  ScoringConfig,
  SkillResult,
  ZoneKey,
} from "./types";

// Deterministic, rule-based scoring. All maths is plain arithmetic over the
// question configuration; there is no eval and no admin-supplied formula.
//
//   question score  = normalise(answer) to 0..1, flipped when `reverse`
//   skill score     = weighted mean of its question scores x 100
//   overall score   = weighted mean of skill scores (or of all questions)
//
// Hidden questions and unanswered optional questions are left out of both the
// numerator and the denominator, so skipping a question never lowers a score.

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Normalises an answer to 0..1 (before any reverse scoring); null when not numerically scorable. */
export function normalizeAnswer(q: Question, value: AnswerValue | undefined): number | null {
  if (value === undefined || value === null) return null;

  switch (q.type) {
    case "rating5":
    case "rating_scale":
    case "slider": {
      const { min, max } = ratingBounds(q);
      const v = Number(value);
      if (!Number.isFinite(v) || max <= min) return null;
      return clamp01((v - min) / (max - min));
    }
    case "number": {
      if (!Number.isFinite(q.min) || !Number.isFinite(q.max)) return null;
      const min = q.min as number;
      const max = q.max as number;
      const v = Number(value);
      if (!Number.isFinite(v) || max <= min) return null;
      return clamp01((v - min) / (max - min));
    }
    case "yes_no":
    case "peer_feedback":
      return value === "yes" ? 1 : value === "no" ? 0 : null;
    case "radio":
    case "dropdown": {
      const choices = q.choices ?? [];
      const points = choices.map((c, i) => c.points ?? i);
      const lo = Math.min(...points);
      const hi = Math.max(...points);
      const index = choices.findIndex((c) => c.id === value);
      if (index < 0 || hi <= lo) return null;
      return clamp01((points[index] - lo) / (hi - lo));
    }
    case "checkbox": {
      if (!Array.isArray(value)) return null;
      const choices = q.choices ?? [];
      const points = choices.map((c, i) => c.points ?? i);
      const maxSum = points.reduce((s, p) => s + Math.max(p, 0), 0);
      const minSum = points.reduce((s, p) => s + Math.min(p, 0), 0);
      if (maxSum <= minSum) return null;
      const sum = choices.reduce((s, c, i) => (value.includes(c.id) ? s + points[i] : s), 0);
      return clamp01((sum - minSum) / (maxSum - minSum));
    }
    default:
      return null;
  }
}

/** True for question types that can carry a numeric score. */
export function isScorableType(type: Question["type"]): boolean {
  return ["rating5", "rating_scale", "slider", "number", "yes_no", "radio", "dropdown", "checkbox"].includes(type);
}

interface Contribution {
  question: Question;
  /** 0..1 after reverse scoring. */
  value: number;
  weight: number;
  order: number;
}

interface Collected {
  contributions: Contribution[];
  /** Visible scored questions, answered or not. */
  considered: Question[];
  skippedOptional: number;
}

function collect(
  definition: AssessmentDefinition,
  answers: Answers,
  visibility: Visibility,
  filter?: (q: Question) => boolean,
): Collected {
  const out: Collected = { contributions: [], considered: [], skippedOptional: 0 };
  let order = 0;
  for (const section of definition.sections) {
    for (const q of section.questions) {
      order += 1;
      if (!visibility.questions[q.id]) continue;
      if (!q.scoring?.scored || !isScorableType(q.type)) continue;
      if (filter && !filter(q)) continue;
      out.considered.push(q);
      const answer = answers[q.id];
      if (!isAnswered(answer)) {
        out.skippedOptional += 1;
        continue;
      }
      const normalized = normalizeAnswer(q, answer);
      if (normalized === null) {
        out.skippedOptional += 1;
        continue;
      }
      const weight = Number.isFinite(q.scoring.weight) ? Math.max(0, q.scoring.weight) : 1;
      out.contributions.push({
        question: q,
        value: q.scoring.reverse ? 1 - normalized : normalized,
        weight,
        order,
      });
    }
  }
  return out;
}

function weightedMean(items: Array<{ value: number; weight: number }>): number | null {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (items.length === 0 || totalWeight <= 0) return null;
  return (items.reduce((s, i) => s + i.value * i.weight, 0) / totalWeight) * 100;
}

function skillScoresFrom(config: ScoringConfig, contributions: Contribution[]): Map<string, number | null> {
  const scores = new Map<string, number | null>();
  for (const skill of config.skills) {
    scores.set(skill.id, weightedMean(contributions.filter((c) => c.question.scoring?.skillId === skill.id)));
  }
  return scores;
}

function overallFrom(config: ScoringConfig, contributions: Contribution[], skillScores: Map<string, number | null>): number | null {
  if (config.method === "questions") return weightedMean(contributions);
  const parts: Array<{ value: number; weight: number }> = [];
  for (const skill of config.skills) {
    const score = skillScores.get(skill.id);
    if (score !== null && score !== undefined) parts.push({ value: score / 100, weight: Math.max(0, skill.weight) });
  }
  return weightedMean(parts);
}

const round = (n: number | null): number | null => (n === null ? null : Math.round(n));

export function levelFor(levels: Level[], score: number): Level | null {
  const sorted = [...levels].sort((a, b) => a.min - b.min);
  let found: Level | null = null;
  for (const level of sorted) if (score >= level.min) found = level;
  return found ?? sorted[0] ?? null;
}

function bandFor(config: ScoringConfig, score: number | null): string | undefined {
  if (score === null) return undefined;
  const bands = [...config.skillBands].sort((a, b) => a.min - b.min);
  let label: string | undefined;
  for (const band of bands) if (score >= band.min) label = band.label;
  return label;
}

interface ScoreContext {
  overall: number | null;
  skills: Map<string, number | null>;
  contexts: Map<string, number | null>;
  /** Each scored, answered, visible question as 0–100 after reverse scoring. */
  questions: Map<string, number>;
}

export function evaluateScoreCondition(cond: ScoreCondition, ctx: ScoreContext): boolean {
  let value: number | null | undefined;
  if (cond.source.type === "overall") value = ctx.overall;
  else if (cond.source.type === "skill") value = ctx.skills.get(cond.source.id);
  else if (cond.source.type === "context") value = ctx.contexts.get(cond.source.id);
  else value = ctx.questions.get(cond.source.id);
  if (value === null || value === undefined) return false;
  switch (cond.operator) {
    case "lt":
      return value < cond.value;
    case "lte":
      return value <= cond.value;
    case "gt":
      return value > cond.value;
    case "gte":
      return value >= cond.value;
    case "between":
      return value >= cond.value && value <= (cond.value2 ?? cond.value);
    default:
      return false;
  }
}

/**
 * The practice plan of a fixed length: one step at a time from each skill's list, the first list (the
 * lowest-scoring skill) first, then the next step of each, until `length` steps are collected.
 * A step that appears in two lists is used once.
 */
export function roundRobinPlan(lists: Array<{ skill: string; items: string[] }>, length: number): Array<{ text: string; skill: string }> {
  const plan: Array<{ text: string; skill: string }> = [];
  const seen = new Set<string>();
  for (let round = 0; plan.length < length; round += 1) {
    let any = false;
    for (const list of lists) {
      if (round >= list.items.length) continue;
      any = true;
      const text = list.items[round];
      if (plan.length >= length || seen.has(text)) continue;
      seen.add(text);
      plan.push({ text, skill: list.skill });
    }
    if (!any) break;
  }
  return plan;
}

/** Places the participant on the zone map: a skill score from the threshold up is "high" on that axis. */
export function zoneFor(config: ScoringConfig["zoneMap"], skills: SkillResult[]): ResultZone | null {
  if (!config) return null;
  const xSkill = skills.find((s) => s.id === config.xSkillId);
  const ySkill = skills.find((s) => s.id === config.ySkillId);
  if (!xSkill || !ySkill || xSkill.score === null || ySkill.score === null) return null;
  const highX = xSkill.score >= config.threshold;
  const highY = ySkill.score >= config.threshold;
  const key: ZoneKey = highY ? (highX ? "topRight" : "topLeft") : highX ? "bottomRight" : "bottomLeft";
  const zone = config.zones[key];
  return {
    key,
    label: zone.label,
    description: zone.description,
    x: xSkill.score,
    y: ySkill.score,
    xLabel: config.xLabel || xSkill.name,
    yLabel: config.yLabel || ySkill.name,
    threshold: config.threshold,
  };
}

function emptyResult(now: Date): AssessmentResult {
  return {
    scored: false,
    overall: null,
    zone: null,
    level: null,
    skills: [],
    contexts: [],
    contextComparison: null,
    strengths: [],
    growth: [],
    strongestHabits: [],
    growthHabits: [],
    selfPerception: null,
    content: [],
    practicePlan: null,
    stats: { scoredQuestions: 0, skippedOptional: 0 },
    computedAt: now.toISOString(),
  };
}

/**
 * Computes the full result for a participant's own answers. `answers` should
 * already have been through validateAnswers(); hidden questions are ignored
 * regardless.
 */
export function computeResult(
  definition: AssessmentDefinition,
  answers: Answers,
  options: { now?: Date } = {},
): AssessmentResult {
  const now = options.now ?? new Date();
  const config = definition.scoring;
  const result = emptyResult(now);
  const visibility = computeVisibility(definition.sections, answers);
  const collected = collect(definition, answers, visibility);
  const nameOf = new Map(config.skills.map((s) => [s.id, s.name]));

  result.stats = { scoredQuestions: collected.contributions.length, skippedOptional: collected.skippedOptional };

  if (config.enabled) {
    const skillScores = skillScoresFrom(config, collected.contributions);
    const overallRaw = overallFrom(config, collected.contributions, skillScores);

    result.skills = config.skills.map<SkillResult>((skill) => {
      const score = round(skillScores.get(skill.id) ?? null);
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        score,
        band: bandFor(config, score),
        answered: collected.contributions.filter((c) => c.question.scoring?.skillId === skill.id).length,
        total: collected.considered.filter((q) => q.scoring?.skillId === skill.id).length,
      };
    });

    result.contexts = config.contexts.map<ContextResult>((ctx) => {
      const inContext = collected.contributions.filter((c) => c.question.scoring?.contextId === ctx.id);
      const bySkill = skillScoresFrom(config, inContext);
      return {
        id: ctx.id,
        name: ctx.name,
        score: round(weightedMean(inContext)),
        skills: config.skills.map((s) => ({ id: s.id, name: s.name, score: round(bySkill.get(s.id) ?? null) })),
      };
    });

    result.zone = zoneFor(config.zoneMap, result.skills);
    result.overall = round(overallRaw);
    result.scored = result.overall !== null;
    if (result.overall !== null && config.displayMax && config.displayMax > 0) {
      result.display = { score: Math.round(((overallRaw as number) / 100) * config.displayMax), max: config.displayMax };
    }
    if (result.overall !== null) {
      const level = levelFor(config.levels, result.overall);
      if (level) result.level = { id: level.id, label: level.label, description: level.description };
    }

    // Strengths and growth areas: rank skills with a score; ties fall back to skill order.
    const ranked = config.skills
      .map((skill, index) => ({ skill, index, raw: skillScores.get(skill.id) ?? null }))
      .filter((r): r is { skill: (typeof config.skills)[number]; index: number; raw: number } => r.raw !== null);
    const high = [...ranked].sort((a, b) => b.raw - a.raw || a.index - b.index);
    const low = [...ranked].sort((a, b) => a.raw - b.raw || a.index - b.index);

    const strengthPick = high.slice(0, Math.max(0, config.strengthsCount));
    const strengthIds = new Set(strengthPick.map((r) => r.skill.id));
    result.strengths = strengthPick.map((r) => ({
      skillId: r.skill.id,
      name: r.skill.name,
      score: Math.round(r.raw),
      text: r.skill.strengthText || `${r.skill.name} is one of your stronger listening habits.`,
    }));
    result.growth = low
      .filter((r) => !strengthIds.has(r.skill.id))
      .slice(0, Math.max(0, config.growthCount))
      .map((r) => ({
        skillId: r.skill.id,
        name: r.skill.name,
        score: Math.round(r.raw),
        text: r.skill.growthText || `${r.skill.name} is the area with the most room to grow.`,
        tips: r.skill.tips ?? [],
      }));

    // Individual habits (questions): best and weakest, no overlap.
    if (collected.contributions.length >= 2) {
      const toHabit = (c: Contribution): HabitResult => ({
        questionId: c.question.id,
        label: c.question.scoring?.habit || c.question.label,
        score: Math.round(c.value * 100),
        skillId: c.question.scoring?.skillId,
      });
      const best = [...collected.contributions].sort((a, b) => b.value - a.value || a.order - b.order);
      const worst = [...collected.contributions].sort((a, b) => a.value - b.value || a.order - b.order);
      const count = Math.max(0, config.habitsCount);
      const bestPick = best.slice(0, count);
      const bestIds = new Set(bestPick.map((c) => c.question.id));
      result.strongestHabits = bestPick.map(toHabit);
      result.growthHabits = worst.filter((c) => !bestIds.has(c.question.id)).slice(0, count).map(toHabit);
    }

    // Work vs home (or any two contexts).
    const scoredContexts = result.contexts.filter((c) => c.score !== null);
    if (scoredContexts.length >= 2) {
      const sorted = [...scoredContexts].sort((a, b) => (b.score as number) - (a.score as number));
      const hi = sorted[0];
      const lo = sorted[sorted.length - 1];
      const diff = (hi.score as number) - (lo.score as number);
      result.contextComparison = {
        higherId: hi.id,
        lowerId: lo.id,
        diff,
        message:
          diff >= config.contextGapThreshold
            ? `Your answers score ${diff} points higher for ${hi.name} than for ${lo.name}. What helps you listen well in ${hi.name} may be worth carrying into ${lo.name}.`
            : `Your answers look consistent across ${hi.name} and ${lo.name} (${diff} point${diff === 1 ? "" : "s"} apart).`,
      };
    }

    // Self-perception vs what the answers show.
    if (config.selfPerception && result.overall !== null) {
      const sp = config.selfPerception;
      const q = definition.sections.flatMap((s) => s.questions).find((x) => x.id === sp.questionId);
      if (q && visibility.questions[q.id]) {
        const n = normalizeAnswer(q, answers[q.id]);
        if (n !== null) {
          const selfScore = Math.round(n * 100);
          const gap = selfScore - result.overall;
          const status = gap > sp.gapThreshold ? "over" : gap < -sp.gapThreshold ? "under" : "aligned";
          result.selfPerception = {
            selfScore,
            computedScore: result.overall,
            gap,
            status,
            message: sp[status],
          };
        }
      }
    }

    // Insights, misconceptions, recommendations, custom messages.
    const ctx: ScoreContext = {
      overall: result.overall,
      skills: new Map(result.skills.map((s) => [s.id, s.score])),
      contexts: new Map(result.contexts.map((c) => [c.id, c.score])),
      questions: new Map(collected.contributions.map((c) => [c.question.id, Math.round(c.value * 100)])),
    };
    result.content = config.contentRules
      .filter((rule) => rule.when.every((cond) => evaluateScoreCondition(cond, ctx)))
      .map<ContentResult>((rule) => ({ id: rule.id, kind: rule.kind, title: rule.title, text: rule.text }));

    // Personalised practice plan: numbered steps taken from every skill in turn, or the weeks below.
    if (config.practicePlan.enabled && config.practicePlan.length) {
      const plan = config.practicePlan;
      const steps = roundRobinPlan(
        low.map((r) => ({ skill: r.skill.name, items: r.skill.planItems ?? [] })),
        plan.length as number,
      );
      if (steps.length) {
        const prefix = plan.labelPrefix?.trim() || "Step";
        result.practicePlan = {
          title: plan.title,
          intro: plan.intro,
          steps: true,
          weeks: steps.map((step, index) => ({
            id: `step-${index + 1}`,
            title: `${prefix} ${index + 1}`,
            days: "",
            practices: [{ id: `step-${index + 1}`, text: step.text, skillName: step.skill }],
          })),
        };
      }
    } else if (config.practicePlan.enabled && config.practicePlan.weeks.length > 0) {
      const focus = new Set(low.slice(0, Math.max(0, config.practicePlan.focusCount)).map((r) => r.skill.id));
      const weeks: PlanWeekResult[] = [];
      for (const week of config.practicePlan.weeks) {
        const practices = week.practices
          .filter((p) => !p.skillId || focus.has(p.skillId))
          .map((p) => ({ id: p.id, text: p.text, skillName: p.skillId ? nameOf.get(p.skillId) : undefined }));
        if (practices.length) weeks.push({ id: week.id, title: week.title, days: week.days, goal: week.goal, practices });
      }
      if (weeks.length) {
        result.practicePlan = { title: config.practicePlan.title, intro: config.practicePlan.intro, weeks };
      }
    }
  } else {
    // Unscored assessment: still surface unconditional messages.
    result.content = config.contentRules
      .filter((rule) => rule.when.length === 0)
      .map<ContentResult>((rule) => ({ id: rule.id, kind: rule.kind, title: rule.title, text: rule.text }));
  }

  return result;
}

/**
 * Compares the participant's answers with those of the people they invited.
 * Only questions flagged for peers are compared, scored with the same weights
 * and reverse flags, and peer scores are averaged per skill.
 */
export function computePeerComparison(
  definition: AssessmentDefinition,
  selfAnswers: Answers,
  peerAnswerSets: Answers[],
): PeerComparison | null {
  if (peerAnswerSets.length === 0) return null;
  const config = definition.scoring;
  if (!config.enabled) return null;

  const visibility = computeVisibility(definition.sections, selfAnswers);
  const onlyPeerQuestions = (q: Question) => Boolean(q.peer?.enabled);

  const self = collect(definition, selfAnswers, visibility, onlyPeerQuestions);
  const selfSkills = skillScoresFrom(config, self.contributions);
  const selfOverall = overallFrom(config, self.contributions, selfSkills);

  const peerSkillScores = new Map<string, number[]>();
  const peerOveralls: number[] = [];
  let usable = 0;
  for (const answers of peerAnswerSets) {
    const peer = collect(definition, answers, visibility, onlyPeerQuestions);
    if (peer.contributions.length === 0) continue;
    usable += 1;
    const skills = skillScoresFrom(config, peer.contributions);
    for (const [id, score] of skills) {
      if (score === null) continue;
      peerSkillScores.set(id, [...(peerSkillScores.get(id) ?? []), score]);
    }
    const overall = overallFrom(config, peer.contributions, skills);
    if (overall !== null) peerOveralls.push(overall);
  }
  if (usable === 0) return null;

  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const skills: PeerComparison["skills"] = [];
  for (const skill of config.skills) {
    const selfScore = selfSkills.get(skill.id);
    const peerScores = peerSkillScores.get(skill.id);
    if (selfScore === null || selfScore === undefined || !peerScores?.length) continue;
    const s = Math.round(selfScore);
    const p = Math.round(mean(peerScores));
    skills.push({ id: skill.id, name: skill.name, self: s, peer: p, diff: s - p });
  }
  const overall =
    selfOverall !== null && peerOveralls.length
      ? { self: Math.round(selfOverall), peer: Math.round(mean(peerOveralls)) }
      : null;

  return { responses: usable, overall, skills };
}
