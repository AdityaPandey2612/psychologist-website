"use client";

import type { SelfPerceptionConfig } from "@/lib/assessments/types";
import { Alert } from "@/components/assessments/ui";
import { NumberField, Panel, SelectField, TextAreaField, Toggle } from "./SettingsControls";
import { numericQuestions } from "./ScoringUtils";
import type { EditorProps } from "./types";

const DEFAULTS = {
  aligned: "How you see your listening is close to the pattern in your answers.",
  over: "You rated yourself higher than your detailed answers suggest. That's a common gap — noticing it is useful.",
  under: "You rated yourself lower than your detailed answers suggest. You may be harder on yourself than your habits warrant.",
};

export function ScoringSelfPerceptionEditor({ definition, onChange }: EditorProps) {
  const current = definition.scoring.selfPerception;
  const candidates = numericQuestions(definition);
  const set = (next: SelfPerceptionConfig | undefined) => {
    const scoring = { ...definition.scoring };
    if (next) scoring.selfPerception = next;
    else delete scoring.selfPerception;
    onChange({ ...definition, scoring });
  };

  return (
    <Panel
      title="Self-perception vs answers"
      description="Compare how participants rate themselves in one overall question (for example “How good a listener are you?”) with the score their detailed answers produce. The self-rating question itself should be unscored."
    >
      <Toggle
        checked={Boolean(current)}
        onChange={(on) => {
          if (!on) return set(undefined);
          set({ questionId: candidates[0]?.id ?? "", gapThreshold: 15, ...DEFAULTS });
        }}
        label="Compare self-rating with answers"
        description="Adds the “Self-perception vs answers” result section."
      />

      {current && (
        <>
          {candidates.length === 0 ? (
            <Alert tone="warning">Add a rating, slider or number question in the Questions tab to use as the self-rating question.</Alert>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
              <SelectField
                label="Self-rating question"
                value={current.questionId}
                options={[
                  ...(candidates.some((q) => q.id === current.questionId) ? [] : [{ value: current.questionId, label: "(choose a question)" }]),
                  ...candidates.map((q) => ({ value: q.id, label: q.label || "(untitled question)" })),
                ]}
                onChange={(questionId) => set({ ...current, questionId })}
              />
              <NumberField
                label="Gap that counts as different"
                value={current.gapThreshold}
                min={0}
                max={100}
                onChange={(gapThreshold) => set({ ...current, gapThreshold })}
                help="Points on the 0–100 scale."
              />
            </div>
          )}
          <TextAreaField label="Message when they match" rows={2} maxLength={800} value={current.aligned} onChange={(aligned) => set({ ...current, aligned })} />
          <TextAreaField label="Message when they rate themselves higher" rows={2} maxLength={800} value={current.over} onChange={(over) => set({ ...current, over })} />
          <TextAreaField label="Message when they rate themselves lower" rows={2} maxLength={800} value={current.under} onChange={(under) => set({ ...current, under })} />
        </>
      )}
    </Panel>
  );
}
