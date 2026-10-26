import { blankMeta, defaultDefinition } from "../definition";
import type { AssessmentDefinition, AssessmentMeta } from "../types";
import { CHARISMA_META, CHARISMA_TEMPLATE_ID, charismaDefinition } from "./charisma";
import { LISTENING_META, LISTENING_TEMPLATE_ID, listeningDefinition } from "./listening";
import { MOOD_META, MOOD_TEMPLATE_ID, moodDefinition } from "./mood";

export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string;
  /** Starter content that has not been professionally validated. */
  starter: boolean;
  build: () => { meta: AssessmentMeta; definition: AssessmentDefinition };
}

export const TEMPLATES: AssessmentTemplate[] = [
  {
    id: "blank",
    name: "Blank assessment",
    description: "Start from an empty form and build your own questions, scoring and results.",
    starter: false,
    build: () => ({ meta: blankMeta(), definition: defaultDefinition() }),
  },
  {
    id: LISTENING_TEMPLATE_ID,
    name: "Listening Self-Reflection (starter)",
    description:
      "Nine short sections, four listening skills, work and home comparison, optional peer feedback and a 30-day plan. Editable starter questions and thresholds — review before publishing.",
    starter: true,
    build: () => ({ meta: { ...LISTENING_META }, definition: listeningDefinition() }),
  },
  {
    id: MOOD_TEMPLATE_ID,
    name: "Mood Self-Assessment (from your Word document)",
    description:
      "The 21 items from your document (four statements each, scored 0–3, total out of 63) with minimal / mild / moderate / severe ranges, a support message when the self-harm item is answered, and next-step suggestions. The scoring and ranges were not in the document — confirm them before publishing.",
    starter: true,
    build: () => ({ meta: { ...MOOD_META }, definition: moodDefinition() }),
  },
  {
    id: CHARISMA_TEMPLATE_ID,
    name: "Charisma Diagnostic (from the Stature Group questionnaire)",
    description:
      "The 34 statements of the questionnaire in four parts, rated 1–5. The result is a zone on a warmth / competence map, strengths, gaps and a 7 day plan, not a score. The zone names, strengths, gaps and plan steps are starter wording — read them through before publishing.",
    starter: true,
    build: () => ({ meta: { ...CHARISMA_META }, definition: charismaDefinition() }),
  },
];

export function getTemplate(id: string): AssessmentTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export { CHARISMA_TEMPLATE_ID, LISTENING_TEMPLATE_ID, MOOD_TEMPLATE_ID };
