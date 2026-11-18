"use client";

import { useId } from "react";
import type { AdminViewMode } from "@/lib/assessments/types";
import { Badge, cx } from "@/components/assessments/ui";
import { Panel, SelectField, Toggle } from "./SettingsControls";
import { SettingsEmailEditor } from "./SettingsEmailEditor";
import { SettingsIntroEditor } from "./SettingsIntroEditor";
import { SettingsPeerEditor } from "./SettingsPeerEditor";
import type { EditorProps } from "./types";

const PRIVACY_OPTIONS: Array<{ value: AdminViewMode; title: string; text: string }> = [
  {
    value: "consented_only",
    title: "Only people who agreed to share",
    text: "Names, emails and answers are visible only for participants who ticked “Share my results with the practice”. Everyone else appears as scores only.",
  },
  {
    value: "anonymous",
    title: "Scores only (anonymous)",
    text: "You see scores, levels and dates, but never names, emails or answers.",
  },
  {
    value: "full",
    title: "Everything",
    text: "Names, emails and answers are visible for every submission. Only choose this if your privacy notice tells participants their answers are shared with the practice.",
  },
  {
    value: "none",
    title: "No individual submissions",
    text: "The submissions list is switched off. Only anonymous totals and charts are available in Analytics.",
  },
];

function PrivacyEditor({ definition, onChange }: EditorProps) {
  const name = useId();
  const mode = definition.privacy.adminViewMode;
  return (
    <Panel
      title="Privacy: what admins can see"
      description="Controls what the submissions screen shows about individual participants. Participants’ answers are used to calculate their results, and are stored for that purpose. Analytics totals are always anonymous. A privacy change applies immediately — even to existing submissions."
    >
      <fieldset>
        <legend className="sr-only">Admin visibility of submissions</legend>
        <div className="space-y-3">
          {PRIVACY_OPTIONS.map((option) => {
            const id = `${name}-${option.value}`;
            const selected = mode === option.value;
            return (
              <label
                key={option.value}
                htmlFor={id}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition",
                  selected ? "border-primary bg-surface-soft/60" : "border-primary/15 bg-surface hover:bg-surface-soft/40",
                )}
              >
                <input
                  id={id}
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={selected}
                  onChange={() => onChange({ ...definition, privacy: { adminViewMode: option.value } })}
                  className="mt-1 h-4 w-4 accent-[#1F5C56]"
                />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 font-semibold text-primary-dark">
                    {option.title}
                    {option.value === "consented_only" && <Badge tone="primary">Recommended</Badge>}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{option.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </Panel>
  );
}

export function AdminSettingsEditor({ definition, onChange }: EditorProps) {
  const { navigation } = definition;

  return (
    <div className="space-y-6">
      <SettingsIntroEditor definition={definition} onChange={onChange} />

      <Panel title="Navigation" description="How participants move through the questions.">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Layout"
            value={navigation.layout}
            options={[
              { value: "sections", label: "One section per page" },
              { value: "single_page", label: "Everything on one page" },
            ]}
            onChange={(layout) => onChange({ ...definition, navigation: { ...navigation, layout } })}
            help="One section per page works best for longer assessments."
          />
          <div className="space-y-4">
            <Toggle
              checked={navigation.allowBack}
              onChange={(allowBack) => onChange({ ...definition, navigation: { ...navigation, allowBack } })}
              label="Allow going back"
              description="Show a Previous button between sections."
            />
            <Toggle
              checked={navigation.showProgress}
              onChange={(showProgress) => onChange({ ...definition, navigation: { ...navigation, showProgress } })}
              label="Show a progress indicator"
            />
          </div>
        </div>
      </Panel>

      <SettingsEmailEditor definition={definition} onChange={onChange} />
      <SettingsPeerEditor definition={definition} onChange={onChange} />
      <PrivacyEditor definition={definition} onChange={onChange} />
    </div>
  );
}
