import type { AssessmentDefinition, Question, ScoringConfig } from "@/lib/assessments/types";

// Helpers for editing the scoring configuration without leaving dangling references.

export const NUMERIC_TYPES: Question["type"][] = ["rating5", "rating_scale", "slider", "number"];
const SCORABLE_TYPES: Question["type"][] = ["rating5", "rating_scale", "slider", "number", "yes_no", "radio", "dropdown", "checkbox"];

export function updateScoring(definition: AssessmentDefinition, patch: Partial<ScoringConfig>): AssessmentDefinition {
  return { ...definition, scoring: { ...definition.scoring, ...patch } };
}

export function allQuestions(definition: AssessmentDefinition): Question[] {
  return definition.sections.flatMap((s) => s.questions);
}

export function numericQuestions(definition: AssessmentDefinition): Question[] {
  return allQuestions(definition).filter((q) => NUMERIC_TYPES.includes(q.type));
}

export interface ScoringSummary {
  perSkill: Array<{ id: string; name: string; count: number }>;
  perContext: Array<{ id: string; name: string; count: number }>;
  scored: number;
  /** Scored questions with no skill while overall scores are built from skills. */
  unlinked: number;
  /** Rating/choice questions that are not scored (fine for reflection or comparison questions). */
  unscoredScorable: number;
}

export function summarize(definition: AssessmentDefinition): ScoringSummary {
  const questions = allQuestions(definition);
  const scored = questions.filter((q) => q.scoring?.scored);
  return {
    perSkill: definition.scoring.skills.map((s) => ({ id: s.id, name: s.name, count: scored.filter((q) => q.scoring?.skillId === s.id).length })),
    perContext: definition.scoring.contexts.map((c) => ({ id: c.id, name: c.name, count: scored.filter((q) => q.scoring?.contextId === c.id).length })),
    scored: scored.length,
    unlinked: definition.scoring.method === "skills" ? scored.filter((q) => !q.scoring?.skillId).length : 0,
    unscoredScorable: questions.filter((q) => SCORABLE_TYPES.includes(q.type) && !q.scoring?.scored).length,
  };
}

function withoutKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

export interface Impact {
  questions: number;
  practices: number;
  conditions: number;
  /** The zone map plots this skill, so it goes too. */
  zoneMap?: boolean;
}

export function skillImpact(definition: AssessmentDefinition, skillId: string): Impact {
  return {
    questions: allQuestions(definition).filter((q) => q.scoring?.skillId === skillId).length,
    practices: definition.scoring.practicePlan.weeks.flatMap((w) => w.practices).filter((p) => p.skillId === skillId).length,
    conditions: definition.scoring.contentRules.flatMap((r) => r.when).filter((c) => c.source.type === "skill" && c.source.id === skillId).length,
    zoneMap: definition.scoring.zoneMap?.xSkillId === skillId || definition.scoring.zoneMap?.ySkillId === skillId,
  };
}

export function contextImpact(definition: AssessmentDefinition, contextId: string): Impact {
  return {
    questions: allQuestions(definition).filter((q) => q.scoring?.contextId === contextId).length,
    practices: 0,
    conditions: definition.scoring.contentRules.flatMap((r) => r.when).filter((c) => c.source.type === "context" && c.source.id === contextId).length,
  };
}

/** Removes a skill and every reference to it (question links, plan practices, rule conditions). */
export function removeSkill(definition: AssessmentDefinition, skillId: string): AssessmentDefinition {
  const { scoring } = definition;
  const plotted = scoring.zoneMap?.xSkillId === skillId || scoring.zoneMap?.ySkillId === skillId;
  return {
    ...definition,
    results: plotted ? { ...definition.results, components: definition.results.components.filter((c) => c.type !== "zone_map") } : definition.results,
    sections: definition.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.scoring?.skillId === skillId ? { ...q, scoring: withoutKey(q.scoring, "skillId") } : q,
      ),
    })),
    scoring: {
      ...scoring,
      ...(plotted ? { zoneMap: undefined } : {}),
      skills: scoring.skills.filter((s) => s.id !== skillId),
      practicePlan: {
        ...scoring.practicePlan,
        weeks: scoring.practicePlan.weeks.map((w) => ({
          ...w,
          practices: w.practices.map((p) => (p.skillId === skillId ? withoutKey(p, "skillId") : p)),
        })),
      },
      contentRules: scoring.contentRules.map((r) => ({
        ...r,
        when: r.when.filter((c) => !(c.source.type === "skill" && c.source.id === skillId)),
      })),
    },
  };
}

export function removeContext(definition: AssessmentDefinition, contextId: string): AssessmentDefinition {
  const { scoring } = definition;
  return {
    ...definition,
    sections: definition.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.scoring?.contextId === contextId ? { ...q, scoring: withoutKey(q.scoring, "contextId") } : q,
      ),
    })),
    scoring: {
      ...scoring,
      contexts: scoring.contexts.filter((c) => c.id !== contextId),
      contentRules: scoring.contentRules.map((r) => ({
        ...r,
        when: r.when.filter((c) => !(c.source.type === "context" && c.source.id === contextId)),
      })),
    },
  };
}

export function impactSentence(impact: Impact): string {
  const parts: string[] = [];
  if (impact.questions) parts.push(`${impact.questions} question${impact.questions === 1 ? " will be" : "s will be"} unlinked`);
  if (impact.practices) parts.push(`${impact.practices} practice${impact.practices === 1 ? "" : "s"} will become general`);
  if (impact.zoneMap) parts.push("the zone map plots this skill, so the zone map will be removed");
  if (impact.conditions)
    parts.push(`${impact.conditions} result-message condition${impact.conditions === 1 ? "" : "s"} will be removed (a message with no conditions is shown to everyone)`);
  return parts.join("; ");
}
