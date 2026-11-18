"use client";

import { Plus, RotateCcw } from "lucide-react";
import { defaultResultComponents } from "@/lib/assessments/definition";
import { newId } from "@/lib/assessments/text";
import {
  RESULT_COMPONENT_LABELS,
  RESULT_COMPONENT_TYPES,
  type AssessmentDefinition,
  type ResultComponent,
  type ResultComponentType,
} from "@/lib/assessments/types";
import { Alert, Badge, cx } from "@/components/assessments/ui";
import { AdminZoneMapEditor, withZoneMap } from "./AdminZoneMapEditor";
import { HelpTip } from "./HelpTip";
import { Panel, RowActions, SelectField, TextAreaField, TextField, Toggle, moveItem, removeAt, replaceAt } from "./SettingsControls";
import type { EditorProps } from "./types";

const DESCRIPTIONS: Record<ResultComponentType, string> = {
  overall_score: "The big 0–100 score.",
  classification: "The level label (for example Waiting → Attentive) with its description.",
  zone_map: "A map of two skills that places the participant in one of four named zones. Set it up in the Zone map box below.",
  skill_breakdown: "Each skill's score, band and description.",
  progress_bars: "A simple progress bar per skill.",
  chart: "A radar or bar chart of the skill scores.",
  context_comparison: "Side-by-side scores for your contexts, such as Work vs Home.",
  peer_comparison: "The participant's self-ratings next to the averages from people they invited.",
  self_perception: "How the participant's own overall rating compares with their answers.",
  interpretation: "A written interpretation based on the level reached.",
  strengths: "The strongest skills with your strength messages.",
  growth_areas: "The skills with most room to grow, with tips.",
  habits: "The individual habits that scored highest and lowest.",
  insights: "Result messages of type “Insight” whose conditions are met.",
  misconceptions: "Result messages of type “Misconception”.",
  recommendations: "Result messages of type “Recommendation” or “Message”.",
  practice_plan: "The personalised week-by-week plan.",
  custom_message: "A fixed note of your own (plain text).",
  copy_results: "A button that copies a text summary to the clipboard.",
  email_results: "Email status, with a button to send or retry the results email.",
};

/** Returns why an enabled component will show nothing, or null if it can show. */
function unavailableReason(type: ResultComponentType, d: AssessmentDefinition): string | null {
  const s = d.scoring;
  const hasKind = (kinds: string[]) => s.contentRules.some((r) => kinds.includes(r.kind));
  switch (type) {
    case "overall_score":
    case "classification":
    case "interpretation":
    case "habits":
      return s.enabled ? null : "Scoring is off (Scoring tab).";
    case "skill_breakdown":
    case "progress_bars":
    case "chart":
    case "strengths":
    case "growth_areas":
      if (!s.enabled) return "Scoring is off (Scoring tab).";
      return s.skills.length === 0 ? "There are no skills yet (Scoring tab)." : null;
    case "context_comparison":
      if (!s.enabled) return "Scoring is off (Scoring tab).";
      return s.contexts.length < 2 ? "Needs at least two contexts (Scoring tab)." : null;
    case "self_perception":
      if (!s.enabled) return "Scoring is off (Scoring tab).";
      return s.selfPerception ? null : "No self-rating comparison is set up (Scoring tab).";
    case "peer_comparison":
      return d.peer.enabled ? null : "Peer feedback is off (Settings tab).";
    case "zone_map":
      if (!s.enabled) return "Scoring is off (Scoring tab).";
      return s.zoneMap ? null : "No zone map is set up yet (Zone map box below).";
    case "practice_plan":
      if (!s.enabled) return "Scoring is off (Scoring tab).";
      if (!s.practicePlan.enabled) return "The practice plan is off (Scoring tab).";
      if (s.practicePlan.length) return s.skills.some((skill) => (skill.planItems?.length ?? 0) > 0) ? null : "The plan has a number of steps, but no skill has plan steps (Scoring tab).";
      return s.practicePlan.weeks.length > 0 ? null : "The practice plan has no weeks (Scoring tab).";
    case "insights":
      return hasKind(["insight"]) ? null : "There are no “Insight” messages (Scoring tab).";
    case "misconceptions":
      return hasKind(["misconception"]) ? null : "There are no “Misconception” messages (Scoring tab).";
    case "recommendations":
      return hasKind(["recommendation", "message"]) ? null : "There are no “Recommendation” messages (Scoring tab).";
    case "email_results":
      return d.email.enabled ? null : "Email is off (Settings tab).";
    default:
      return null;
  }
}

export function AdminResultBuilder({ definition, onChange }: EditorProps) {
  const { results } = definition;
  const components = results.components;
  const setResults = (patch: Partial<typeof results>) => onChange({ ...definition, results: { ...results, ...patch } });
  const setComponents = (next: ResultComponent[]) => setResults({ components: next });
  const setComponent = (index: number, patch: Partial<ResultComponent>) => setComponents(replaceAt(components, index, { ...components[index], ...patch }));

  const present = new Set(components.map((c) => c.type));
  const missing = RESULT_COMPONENT_TYPES.filter((t) => t !== "custom_message" && !present.has(t));

  const addComponent = (type: ResultComponentType) => {
    const c: ResultComponent = { id: newId("rc"), type, enabled: true };
    if (type === "chart") c.variant = "radar";
    if (type === "custom_message") c.text = "";
    setComponents([...components, c]);
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Results page"
        description="Choose which sections the participant sees, and in what order. Sections that have nothing to show (for example no peer answers yet) are hidden automatically."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Headline"
            value={results.headline}
            maxLength={120}
            onChange={(headline) => setResults({ headline })}
            help={
              <>
                Use <code>{"{name}"}</code> for the participant&apos;s first name and <code>{"{zone}"}</code> for their zone, for example “You are in the {"{zone}"}.” (only when a zone map is set up).
              </>
            }
          />
          <TextField
            label="Small heading above the headline"
            value={results.eyebrow ?? ""}
            optional
            maxLength={80}
            placeholder="The assessment title"
            onChange={(eyebrow) => setResults({ eyebrow: eyebrow || undefined })}
          />
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Toggle
            checked={results.reportDownload !== false}
            onChange={(reportDownload) => setResults({ reportDownload })}
            label="Offer a “Download PDF report” button on the result page"
            description="The participant can save a PDF copy of their result. It follows the sections below, in the same order. Turning it off applies to results from then on."
          />
          <HelpTip label="Download PDF report">
            A PDF made from the participant&apos;s own result, with the practice logo, a headline and the sections you switched on below. Their answers are not included. It is only available through their private result link.
          </HelpTip>
        </div>
        <TextAreaField
          label="Disclaimer"
          value={results.disclaimer}
          rows={3}
          maxLength={1000}
          onChange={(disclaimer) => setResults({ disclaimer })}
          help="Shown at the bottom of the results and in the email. Keep it clear that this is self-reflection, not a diagnosis."
        />
      </Panel>

      <Panel
        title="Result sections"
        description="Switch sections on or off and use the arrows to reorder them. The same order is used for the on-screen results."
        actions={
          <button
            type="button"
            className="btn-outline px-4 py-2 text-sm"
            onClick={() => {
              if (window.confirm("Reset the result sections to the defaults? This replaces the current order, settings and any custom messages.")) setComponents(defaultResultComponents());
            }}
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reset to defaults
          </button>
        }
      >
        {components.length === 0 && <Alert tone="warning">No sections are configured, so participants would see an empty results page. Add sections below or reset to defaults.</Alert>}

        <ol className="space-y-3">
          {components.map((component, i) => {
            const reason = component.enabled ? unavailableReason(component.type, definition) : null;
            return (
              <li key={component.id} className={cx("rounded-2xl border bg-surface p-4", component.enabled ? "border-primary/25" : "border-primary/10 bg-surface-soft/40")}>
                <div className="flex flex-wrap items-start gap-3">
                  <span aria-hidden="true" className="mt-0.5 w-6 text-center font-mono text-sm text-ink-soft">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Toggle
                      checked={component.enabled}
                      onChange={(enabled) => setComponent(i, { enabled })}
                      label={RESULT_COMPONENT_LABELS[component.type]}
                      description={DESCRIPTIONS[component.type]}
                    />
                  </div>
                  <RowActions
                    index={i}
                    count={components.length}
                    noun={`section ${RESULT_COMPONENT_LABELS[component.type]}`}
                    onMove={(delta) => setComponents(moveItem(components, i, delta))}
                    onRemove={() => setComponents(removeAt(components, i))}
                  />
                </div>

                {reason && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#FBF3DC] px-3 py-2 text-sm text-[#6B4E0F]">
                    <Badge tone="gold">Won’t show</Badge>
                    <span>{reason}</span>
                  </div>
                )}

                {component.enabled && (
                  <div className="mt-4 grid gap-4 pl-9 sm:grid-cols-2">
                    <TextField
                      label="Custom heading"
                      value={component.title ?? ""}
                      optional
                      maxLength={200}
                      placeholder={RESULT_COMPONENT_LABELS[component.type]}
                      onChange={(title) => setComponent(i, { title: title || undefined })}
                    />
                    {component.type === "chart" && (
                      <SelectField
                        label="Chart style"
                        value={component.variant ?? "radar"}
                        options={[
                          { value: "radar", label: "Radar (needs 3+ skills)" },
                          { value: "bar", label: "Bars" },
                        ]}
                        onChange={(variant) => setComponent(i, { variant })}
                      />
                    )}
                    {component.type === "custom_message" && (
                      <TextAreaField
                        className="sm:col-span-2"
                        label="Message"
                        rows={4}
                        maxLength={3000}
                        value={component.text ?? ""}
                        onChange={(text) => setComponent(i, { text })}
                        help="Plain text only. Blank lines start a new paragraph."
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => addComponent("custom_message")}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add custom message
          </button>
          {missing.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="add-missing-section" className="sr-only">
                Add a missing section
              </label>
              <select
                id="add-missing-section"
                value=""
                onChange={(e) => {
                  if (e.target.value) addComponent(e.target.value as ResultComponentType);
                }}
                className="rounded-full border border-primary/30 bg-surface px-4 py-2 text-sm font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Add missing section…</option>
                {missing.map((t) => (
                  <option key={t} value={t}>
                    {RESULT_COMPONENT_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Panel>

      <AdminZoneMapEditor
        skills={definition.scoring.skills}
        zoneMap={definition.scoring.zoneMap}
        onChange={(zoneMap) => onChange(withZoneMap(definition, zoneMap, (prefix) => newId(prefix)))}
      />
    </div>
  );
}
