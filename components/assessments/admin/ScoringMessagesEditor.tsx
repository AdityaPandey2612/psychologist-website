"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { newId } from "@/lib/assessments/text";
import { CONTENT_KINDS, type ContentKind, type ContentRule } from "@/lib/assessments/types";
import { Badge } from "@/components/assessments/ui";
import { Panel, RowActions, SelectField, TextAreaField, TextField, moveItem, removeAt, replaceAt } from "./SettingsControls";
import { ScoringConditionEditor } from "./ScoringConditionEditor";
import { updateScoring } from "./ScoringUtils";
import type { EditorProps } from "./types";

const KIND_LABELS: Record<ContentKind, string> = {
  insight: "Insight",
  misconception: "Misconception",
  recommendation: "Recommendation",
  message: "Message",
  support: "Support message (shown first)",
};

const KIND_HELP: Record<ContentKind, string> = {
  insight: "Appears in “Insights” (for example a patience insight).",
  misconception: "Appears in “Common misconceptions”.",
  recommendation: "Appears in “Recommendations”.",
  message: "A general note, shown with the interpretation.",
  support: "A highlighted note shown at the very top of the results and in the email, for example crisis contacts when a sensitive answer was given. It is always shown when its conditions are met and cannot be hidden from the Results tab.",
};

export function ScoringMessagesEditor({ definition, onChange }: EditorProps) {
  const { contentRules, skills, contexts } = definition.scoring;
  const scoredQuestions = definition.sections.flatMap((s) => s.questions).filter((q) => q.scoring?.scored);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const setRules = (next: ContentRule[]) => onChange(updateScoring(definition, { contentRules: next }));

  const add = () => {
    const rule: ContentRule = { id: newId("cr"), kind: "insight", title: "", text: "", when: [] };
    setJustAdded(rule.id);
    setRules([...contentRules, rule]);
  };

  return (
    <Panel
      title="Result messages"
      description="Messages that appear on the results page when their conditions are met — insights, misconceptions, recommendations or general notes. A message with no conditions is shown to everyone; with several conditions, all of them must be true. Which result sections display each kind is set in the Results tab."
    >
      {contentRules.length === 0 && <p className="rounded-xl bg-surface-soft/60 px-4 py-3 text-sm text-ink-soft">No result messages yet.</p>}
      <div className="space-y-3">
        {contentRules.map((rule, i) => (
          <details key={rule.id} className="group rounded-2xl border border-primary/15 bg-surface" open={rule.id === justAdded ? true : undefined}>
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
              <Badge tone={rule.kind === "support" ? "accent" : rule.kind === "misconception" ? "gold" : rule.kind === "recommendation" ? "primary" : "neutral"}>{KIND_LABELS[rule.kind]}</Badge>
              <span className="min-w-0 flex-1 truncate font-semibold text-primary-dark">{rule.title || "Untitled message"}</span>
              <span className="text-sm text-ink-soft">{rule.when.length === 0 ? "Always shown" : `${rule.when.length} condition${rule.when.length === 1 ? "" : "s"}`}</span>
              <span className="text-sm text-primary group-open:hidden">Edit</span>
              <span className="hidden text-sm text-primary group-open:inline">Close</span>
            </summary>
            <div className="space-y-4 border-t border-primary/10 px-4 py-4">
              <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <SelectField
                  label="Type"
                  value={rule.kind}
                  options={CONTENT_KINDS.map((k) => ({ value: k, label: KIND_LABELS[k] }))}
                  help={KIND_HELP[rule.kind]}
                  onChange={(kind) => setRules(replaceAt(contentRules, i, { ...rule, kind }))}
                />
                <TextField label="Title" value={rule.title} maxLength={200} onChange={(title) => setRules(replaceAt(contentRules, i, { ...rule, title }))} />
              </div>
              <TextAreaField label="Message" value={rule.text} rows={4} maxLength={3000} onChange={(text) => setRules(replaceAt(contentRules, i, { ...rule, text }))} help="Plain text only." />
              <ScoringConditionEditor
                conditions={rule.when}
                skills={skills}
                contexts={contexts}
                questions={scoredQuestions}
                onChange={(when) => setRules(replaceAt(contentRules, i, { ...rule, when }))}
              />
              <div className="flex justify-end border-t border-primary/10 pt-3">
                <RowActions
                  index={i}
                  count={contentRules.length}
                  noun={`message ${rule.title || i + 1}`}
                  onMove={(delta) => setRules(moveItem(contentRules, i, delta))}
                  onRemove={() => {
                    if (window.confirm(`Delete the message "${rule.title || "Untitled message"}"?`)) setRules(removeAt(contentRules, i));
                  }}
                />
              </div>
            </div>
          </details>
        ))}
      </div>
      {contentRules.length < 60 && (
        <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={add}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add message
        </button>
      )}
    </Panel>
  );
}
