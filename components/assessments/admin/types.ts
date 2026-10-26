import type { AssessmentDefinition } from "@/lib/assessments/types";

/** Props shared by the tab editors in the admin assessment builder. */
export interface EditorProps {
  definition: AssessmentDefinition;
  /** Receives a complete, updated definition (never mutate `definition` in place). */
  onChange: (next: AssessmentDefinition) => void;
}
