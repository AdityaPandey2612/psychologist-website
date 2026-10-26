import { defaultDefinition, newQuestion } from "../../lib/assessments/definition";
import type { AssessmentDefinition, Question } from "../../lib/assessments/types";

/** A small two-skill assessment used across tests. */
export function miniDefinition(): AssessmentDefinition {
  const def = defaultDefinition();
  const rate = (id: string, skillId: string, extra: Partial<Question> = {}, reverse = false): Question => ({
    ...newQuestion("rating5"),
    id,
    label: `Rate ${id}`,
    required: true,
    scoring: { scored: true, skillId, weight: 1, reverse },
    ...extra,
  });
  def.sections = [
    { id: "s1", title: "One", questions: [rate("a1", "A"), rate("a2", "A", {}, true), rate("b1", "B")] },
    { id: "s2", title: "Two", questions: [rate("b2", "B", { required: false })] },
  ];
  def.scoring.enabled = true;
  def.scoring.skills = [
    { id: "A", name: "Alpha", weight: 1 },
    { id: "B", name: "Beta", weight: 1 },
  ];
  def.scoring.levels = [
    { id: "l0", label: "Low", min: 0, description: "low" },
    { id: "l1", label: "Mid", min: 40, description: "mid" },
    { id: "l2", label: "High", min: 70, description: "high" },
  ];
  return def;
}
