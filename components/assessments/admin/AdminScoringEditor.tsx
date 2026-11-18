"use client";

import { Alert } from "@/components/assessments/ui";
import { NumberField, Panel, SelectField, Toggle } from "./SettingsControls";
import { ScoringLevelsEditor } from "./ScoringLevelsEditor";
import { ScoringMessagesEditor } from "./ScoringMessagesEditor";
import { ScoringPlanEditor } from "./ScoringPlanEditor";
import { ScoringSelfPerceptionEditor } from "./ScoringSelfPerceptionEditor";
import { ScoringSkillsEditor } from "./ScoringSkillsEditor";
import { ScoringSummary } from "./ScoringSummary";
import { updateScoring } from "./ScoringUtils";
import type { EditorProps } from "./types";

/**
 * Scoring tab. Everything here is plain data (weights, thresholds, text). Scores
 * are always calculated on the server from these rules; no formula or code
 * entered here is ever executed.
 */
export function AdminScoringEditor({ definition, onChange }: EditorProps) {
  const { scoring } = definition;
  const set = (patch: Parameters<typeof updateScoring>[1]) => onChange(updateScoring(definition, patch));

  return (
    <div className="space-y-6">
      <Panel
        title="Scoring"
        description="Turn this on to give participants an overall score from 0 to 100, skill scores and a level. All scores are calculated on the server from the rules below — nothing a participant’s browser sends is trusted, and no formula or code is ever executed."
      >
        <Toggle
          checked={scoring.enabled}
          onChange={(enabled) => set({ enabled })}
          label="Score this assessment"
          description="Leave off for a reflection-only assessment with no numbers."
        />
        {!scoring.enabled && (
          <Alert tone="info">
            Scoring is off, so participants will not see a score, skills or levels. Result messages that have no conditions are still shown.
          </Alert>
        )}
        {scoring.enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Overall score is built from"
              value={scoring.method}
              options={[
                { value: "skills", label: "Skills (weighted average of skill scores)" },
                { value: "questions", label: "All scored questions (weighted average)" },
              ]}
              onChange={(method) => set({ method })}
              help={
                scoring.method === "skills"
                  ? "Each scored question belongs to a skill; skills are averaged using their weights. Questions without a skill are ignored."
                  : "Every scored question counts directly, using its own weight. Skills (if any) are still reported separately."
              }
            />
            <div className="grid grid-cols-3 gap-3">
              <NumberField label="Strengths" value={scoring.strengthsCount} min={0} max={10} onChange={(n) => set({ strengthsCount: Math.floor(n) })} help="Shown" />
              <NumberField label="Growth areas" value={scoring.growthCount} min={0} max={10} onChange={(n) => set({ growthCount: Math.floor(n) })} help="Shown" />
              <NumberField label="Habits" value={scoring.habitsCount} min={0} max={10} onChange={(n) => set({ habitsCount: Math.floor(n) })} help="Best / weakest" />
            </div>
            <NumberField
              label="Context gap that counts as different"
              value={scoring.contextGapThreshold}
              min={0}
              max={100}
              onChange={(contextGapThreshold) => set({ contextGapThreshold })}
              help="If two contexts (for example Work and Home) differ by at least this many points, the comparison highlights it."
            />
            <NumberField
              label="Show the score out of (optional)"
              value={scoring.displayMax ?? 0}
              min={0}
              max={1000}
              onChange={(n) => set({ displayMax: n > 0 ? Math.floor(n) : undefined })}
              help="0 shows the score out of 100. Enter 63 for a 21-item inventory scored 0–3 to show a total such as 14 out of 63. Level thresholds below stay on the 0–100 scale (percent of the maximum)."
            />
          </div>
        )}
      </Panel>

      <ScoringSummary definition={definition} />

      {scoring.enabled && (
        <>
          <ScoringSkillsEditor definition={definition} onChange={onChange} />
          <ScoringLevelsEditor definition={definition} onChange={onChange} />
          <ScoringSelfPerceptionEditor definition={definition} onChange={onChange} />
        </>
      )}
      <ScoringMessagesEditor definition={definition} onChange={onChange} />
      {scoring.enabled && <ScoringPlanEditor definition={definition} onChange={onChange} />}
    </div>
  );
}
