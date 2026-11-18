import { newId } from "@/lib/assessments/text";
import type { Issue } from "@/lib/assessments/definition";
import { FIELD_TYPE_LABELS } from "@/lib/assessments/types";
import type {
  AssessmentDefinition,
  AssessmentDoc,
  AssessmentMeta,
  Condition,
  FieldType,
  Question,
  Section,
} from "@/lib/assessments/types";

// Pure helpers for editing an AssessmentDefinition immutably.

export type TabId = "basics" | "questions" | "scoring" | "results" | "settings" | "preview";

export const TABS: Array<{ id: TabId; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "questions", label: "Questions" },
  { id: "scoring", label: "Scoring" },
  { id: "results", label: "Results" },
  { id: "settings", label: "Settings" },
  { id: "preview", label: "Preview" },
];

export const SCORABLE_TYPES: FieldType[] = ["rating5", "rating_scale", "slider", "number", "yes_no", "radio", "dropdown", "checkbox"];
export const CHOICE_TYPES: FieldType[] = ["radio", "dropdown", "checkbox"];

export function metaOf(doc: AssessmentDoc): AssessmentMeta {
  return {
    title: doc.title,
    slug: doc.slug,
    description: doc.description,
    category: doc.category,
    icon: doc.icon,
    tier: doc.tier,
    estimatedMinutes: doc.estimatedMinutes,
    // An empty string means "no picture"; it is what is sent when the admin removes one.
    thumbnailUrl: doc.thumbnailUrl ?? "",
  };
}

// ----------------------------------------------------------------- lists

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export const replaceAt = <T,>(list: T[], index: number, value: T): T[] => list.map((item, i) => (i === index ? value : item));
export const removeAt = <T,>(list: T[], index: number): T[] => list.filter((_, i) => i !== index);
export const insertAt = <T,>(list: T[], index: number, value: T): T[] => [...list.slice(0, index), value, ...list.slice(index)];

export function shorten(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export function questionTitle(q: Question): string {
  if (q.type === "info") return shorten(q.label || q.body || "") || "Untitled information block";
  return shorten(q.label) || "Untitled question";
}

export function allQuestions(definition: AssessmentDefinition): Question[] {
  return definition.sections.flatMap((s) => s.questions);
}

/** Questions that appear before position (sectionIndex, questionIndex); omit questionIndex for "before this section". */
export function earlierQuestions(definition: AssessmentDefinition, sectionIndex: number, questionIndex?: number): Question[] {
  const out: Question[] = [];
  definition.sections.forEach((section, si) => {
    if (si < sectionIndex) out.push(...section.questions);
    else if (si === sectionIndex && questionIndex !== undefined) out.push(...section.questions.slice(0, questionIndex));
  });
  return out;
}

// --------------------------------------------------------- cloning / ids

type ChoiceMap = Map<string, string>;

function freshQuestion(q: Question): { question: Question; choiceMap: ChoiceMap } {
  const choiceMap: ChoiceMap = new Map();
  const choices = q.choices?.map((c) => {
    const id = newId("c");
    choiceMap.set(c.id, id);
    return { ...c, id };
  });
  const copy = structuredClone(q);
  copy.id = newId("q");
  if (choices) copy.choices = choices;
  return { question: copy, choiceMap };
}

/** A copy of a question with new ids (question and choices); it keeps pointing at the same earlier questions. */
export function duplicateQuestion(q: Question): Question {
  const { question } = freshQuestion(q);
  if (q.label) question.label = `${q.label} (copy)`;
  return question;
}

function remapCondition(
  condition: Condition | undefined,
  mapping: Map<string, { id: string; choiceMap: ChoiceMap }>,
): Condition | undefined {
  if (!condition) return condition;
  return {
    ...condition,
    rules: condition.rules.map((rule) => {
      const target = mapping.get(rule.questionId);
      if (!target) return rule;
      const mapValue = (v: string | number) => (typeof v === "string" ? (target.choiceMap.get(v) ?? v) : v);
      const value = Array.isArray(rule.value) ? rule.value.map(mapValue) : typeof rule.value === "string" ? mapValue(rule.value) : rule.value;
      return { ...rule, questionId: target.id, ...(value !== undefined ? { value } : {}) };
    }),
  };
}

/** Duplicates a section with new ids and re-points rules between its own questions at the copies. */
export function duplicateSection(section: Section): Section {
  const mapping = new Map<string, { id: string; choiceMap: ChoiceMap }>();
  const questions = section.questions.map((q) => {
    const { question, choiceMap } = freshQuestion(q);
    mapping.set(q.id, { id: question.id, choiceMap });
    return question;
  });
  const remapped = questions.map((q) => {
    const visibility = remapCondition(q.visibility, mapping);
    return visibility ? { ...q, visibility } : q;
  });
  return { ...structuredClone(section), id: newId("s"), title: section.title ? `${section.title} (copy)` : section.title, questions: remapped };
}

// -------------------------------------------------------------- references

function conditionMentions(condition: Condition | undefined, ids: ReadonlySet<string>): boolean {
  return Boolean(condition?.rules.some((r) => ids.has(r.questionId)));
}

/** Where the given questions are used by visibility rules or the self-rating setting. */
export function referencesTo(definition: AssessmentDefinition, ids: ReadonlySet<string>): string[] {
  const out: string[] = [];
  definition.sections.forEach((section, si) => {
    if (conditionMentions(section.visibility, ids)) out.push(`the visibility of section "${section.title || si + 1}"`);
    section.questions.forEach((q) => {
      if (!ids.has(q.id) && conditionMentions(q.visibility, ids)) out.push(`the visibility of "${questionTitle(q)}"`);
    });
  });
  const sp = definition.scoring.selfPerception;
  if (sp && ids.has(sp.questionId)) out.push("the self-perception comparison (Scoring tab)");
  return out;
}

function stripCondition(condition: Condition | undefined, ids: ReadonlySet<string>): Condition | undefined {
  if (!condition) return undefined;
  const rules = condition.rules.filter((r) => !ids.has(r.questionId));
  return rules.length ? { ...condition, rules } : undefined;
}

/** Removes rules pointing at the given question ids and clears the self-rating link if it used one. */
export function stripReferences(definition: AssessmentDefinition, ids: ReadonlySet<string>): AssessmentDefinition {
  const { selfPerception, ...scoringRest } = definition.scoring;
  const clearSelf = selfPerception && ids.has(selfPerception.questionId);
  return {
    ...definition,
    sections: definition.sections.map((section) => {
      const { visibility: _sv, ...sectionRest } = section;
      void _sv;
      const visibility = stripCondition(section.visibility, ids);
      return {
        ...sectionRest,
        ...(visibility ? { visibility } : {}),
        questions: section.questions.map((q) => {
          const { visibility: _qv, ...qRest } = q;
          void _qv;
          const qVis = stripCondition(q.visibility, ids);
          return qVis ? { ...qRest, visibility: qVis } : qRest;
        }),
      };
    }),
    scoring: { ...scoringRest, ...(selfPerception && !clearSelf ? { selfPerception } : {}) },
  };
}

export function deleteQuestionFrom(definition: AssessmentDefinition, questionId: string): AssessmentDefinition {
  const ids = new Set([questionId]);
  const stripped = stripReferences(definition, ids);
  return { ...stripped, sections: stripped.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== questionId) })) };
}

export function deleteSectionFrom(definition: AssessmentDefinition, sectionId: string): AssessmentDefinition {
  const section = definition.sections.find((s) => s.id === sectionId);
  if (!section) return definition;
  const ids = new Set(section.questions.map((q) => q.id));
  const stripped = stripReferences(definition, ids);
  return { ...stripped, sections: stripped.sections.filter((s) => s.id !== sectionId) };
}

// ---------------------------------------------------------- type changes

const TEXT_TYPES: FieldType[] = ["short_text", "long_text"];
const RANGE_TYPES: FieldType[] = ["rating_scale", "slider"];
const LABEL_TYPES: FieldType[] = ["rating5", "rating_scale", "slider"];
const PLACEHOLDER_TYPES: FieldType[] = ["short_text", "long_text", "email", "number"];

/** Switches a question's type, keeping every setting that still makes sense and dropping the rest. */
export function changeQuestionType(q: Question, type: FieldType, defaults: Question): Question {
  if (q.type === type) return q;
  const next: Question = { ...defaults, id: q.id, type, label: q.label, required: type === "info" ? false : q.required };
  if (q.description) next.description = q.description;
  if (q.helpText) next.helpText = q.helpText;
  if (q.visibility) next.visibility = q.visibility;
  if (PLACEHOLDER_TYPES.includes(type) && PLACEHOLDER_TYPES.includes(q.type) && q.placeholder) next.placeholder = q.placeholder;
  if (TEXT_TYPES.includes(type) && TEXT_TYPES.includes(q.type) && q.maxLength) next.maxLength = q.maxLength;
  if (CHOICE_TYPES.includes(type) && CHOICE_TYPES.includes(q.type) && q.choices) next.choices = q.choices;
  if (type === "checkbox" && q.type === "checkbox") {
    next.minSelections = q.minSelections;
    next.maxSelections = q.maxSelections;
  }
  if (RANGE_TYPES.includes(type) && RANGE_TYPES.includes(q.type)) {
    next.min = q.min;
    next.max = q.max;
    next.step = q.step;
  }
  if (type === "number" && q.type === "number") {
    next.min = q.min;
    next.max = q.max;
  }
  if (LABEL_TYPES.includes(type) && LABEL_TYPES.includes(q.type)) {
    if (q.minLabel) next.minLabel = q.minLabel;
    if (q.maxLabel) next.maxLabel = q.maxLabel;
  }
  if (type === "info" && q.type === "info" && q.body) next.body = q.body;
  if (SCORABLE_TYPES.includes(type) && q.scoring) next.scoring = q.scoring;
  if (type !== "info" && type !== "peer_feedback" && q.peer) next.peer = q.peer;
  return next;
}

// ------------------------------------------------------- issue → location

export interface IssueLocation {
  tab: TabId;
  label: string;
  sectionId?: string;
  questionId?: string;
}

const SETTINGS_ROOTS = ["email", "peer", "privacy", "navigation", "intro"];

export function locateIssue(definition: AssessmentDefinition, issue: Issue): IssueLocation {
  const path = issue.path;
  const q = /^sections\[(\d+)\](?:\.questions\[(\d+)\])?/.exec(path);
  if (q) {
    const section = definition.sections[Number(q[1])];
    const question = q[2] !== undefined ? section?.questions[Number(q[2])] : undefined;
    const sectionLabel = section ? `Section ${Number(q[1]) + 1}${section.title ? ` “${shorten(section.title, 30)}”` : ""}` : "Questions";
    return {
      tab: "questions",
      label: question ? `${sectionLabel} · ${FIELD_TYPE_LABELS[question.type]}: ${questionTitle(question)}` : sectionLabel,
      sectionId: section?.id,
      questionId: question?.id,
    };
  }
  if (path === "sections") return { tab: "questions", label: "Questions" };
  if (path.startsWith("scoring")) return { tab: "scoring", label: "Scoring" };
  if (path.startsWith("results")) return { tab: "results", label: "Results" };
  if (SETTINGS_ROOTS.some((root) => path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`))) {
    return { tab: "settings", label: "Settings" };
  }
  return { tab: "basics", label: "Basics" };
}

export function mergeIssues(a: Issue[], b: Issue[]): Issue[] {
  const seen = new Set<string>();
  return [...a, ...b].filter((i) => {
    const key = `${i.path}|${i.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
