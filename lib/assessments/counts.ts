import { computeVisibility, isAnswered } from "./conditions";
import type { Answers, AssessmentDefinition } from "./types";

/**
 * How many of the questions this person was asked they answered, for the report and the emails. Information
 * blocks and questions hidden by a rule are not counted, so "21 of 21" means the whole form was answered.
 */
export function questionCounts(definition: Pick<AssessmentDefinition, "sections">, answers: Answers): { answered: number; total: number } {
  const visibility = computeVisibility(definition.sections, answers);
  let answered = 0;
  let total = 0;
  for (const question of definition.sections.flatMap((s) => s.questions)) {
    if (question.type === "info" || !visibility.questions[question.id]) continue;
    total += 1;
    if (isAnswered(answers[question.id])) answered += 1;
  }
  return { answered, total };
}

/** "21 of 21 questions answered". */
export function describeQuestionCounts(counts: { answered: number; total: number }): string {
  return `${counts.answered} of ${counts.total} question${counts.total === 1 ? "" : "s"} answered`;
}
