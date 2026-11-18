import type { AnswerValue, Answers, Condition, ConditionRule, Question, Section } from "./types";

// Evaluates the structured JSON visibility rules. There is no expression
// language and nothing is executed: a rule is {questionId, operator, value}.
//
// Semantics worth knowing:
//  * Rules are evaluated in document order, so a rule can only depend on
//    questions that come earlier in the form.
//  * A rule that points at a question which is itself hidden is false, so
//    hiding a question cascades to everything that depends on it.
//  * A visible but unanswered question: `equals`/`in`/`contains`/comparisons are
//    false, `not_equals`/`not_in`/`not_answered` are true.

export interface Visibility {
  sections: Record<string, boolean>;
  questions: Record<string, boolean>;
}

export function isAnswered(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

const asString = (v: unknown) => String(v).trim();

function matchesOne(answer: AnswerValue, expected: unknown): boolean {
  if (Array.isArray(answer)) return answer.length === 1 && asString(answer[0]) === asString(expected);
  return asString(answer) === asString(expected);
}

function matchesAny(answer: AnswerValue, options: unknown): boolean {
  const list = Array.isArray(options) ? options.map(asString) : [asString(options)];
  if (Array.isArray(answer)) return answer.some((a) => list.includes(asString(a)));
  return list.includes(asString(answer));
}

function compare(answer: AnswerValue, expected: unknown, op: "gt" | "gte" | "lt" | "lte"): boolean {
  const a = typeof answer === "number" ? answer : Number(answer);
  const e = typeof expected === "number" ? expected : Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(e)) return false;
  if (op === "gt") return a > e;
  if (op === "gte") return a >= e;
  if (op === "lt") return a < e;
  return a <= e;
}

export function evaluateRule(rule: ConditionRule, answers: Answers, hidden: ReadonlySet<string>): boolean {
  if (hidden.has(rule.questionId)) return false;
  const answer = answers[rule.questionId];
  const answered = isAnswered(answer);

  switch (rule.operator) {
    case "answered":
      return answered;
    case "not_answered":
      return !answered;
    case "equals":
      return answered && matchesOne(answer, rule.value);
    case "not_equals":
      return !answered || !matchesOne(answer, rule.value);
    case "in":
      return answered && matchesAny(answer, rule.value);
    case "not_in":
      return !answered || !matchesAny(answer, rule.value);
    case "contains": {
      if (!answered) return false;
      if (Array.isArray(answer)) return answer.map(asString).includes(asString(rule.value));
      return asString(answer).toLowerCase().includes(asString(rule.value).toLowerCase());
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return answered && compare(answer, rule.value, rule.operator);
    default:
      return false;
  }
}

/** True when the item guarded by `condition` should be shown. No/empty condition → visible. */
export function isVisible(condition: Condition | undefined, answers: Answers, hidden: ReadonlySet<string>): boolean {
  if (!condition || condition.rules.length === 0) return true;
  const met =
    condition.match === "any"
      ? condition.rules.some((r) => evaluateRule(r, answers, hidden))
      : condition.rules.every((r) => evaluateRule(r, answers, hidden));
  return condition.action === "hide" ? !met : met;
}

/**
 * Works out which sections and questions are visible for a set of answers.
 * Answers belonging to hidden questions are ignored while evaluating later rules.
 */
export function computeVisibility(sections: Section[], answers: Answers): Visibility {
  const hidden = new Set<string>();
  const effective: Answers = {};
  const visibility: Visibility = { sections: {}, questions: {} };

  for (const section of sections) {
    const sectionVisible = isVisible(section.visibility, effective, hidden);
    visibility.sections[section.id] = sectionVisible;
    for (const question of section.questions) {
      const visible = sectionVisible && isVisible(question.visibility, effective, hidden);
      visibility.questions[question.id] = visible;
      if (visible) {
        const value = answers[question.id];
        if (value !== undefined) effective[question.id] = value;
      } else {
        hidden.add(question.id);
      }
    }
  }
  return visibility;
}

export function flattenQuestions(sections: Section[]): Question[] {
  return sections.flatMap((s) => s.questions);
}

export function questionMap(sections: Section[]): Map<string, Question> {
  return new Map(flattenQuestions(sections).map((q) => [q.id, q]));
}

/** Questions that collect an answer (everything except information blocks). */
export function isInputQuestion(q: Question): boolean {
  return q.type !== "info";
}
