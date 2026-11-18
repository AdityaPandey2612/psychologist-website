"use client";

import { Plus, X } from "lucide-react";
import { Alert } from "@/components/assessments/ui";
import { NumberField, Panel, TextAreaField, Toggle, removeAt, replaceAt } from "./SettingsControls";
import type { EditorProps } from "./types";

export function SettingsPeerEditor({ definition, onChange }: EditorProps) {
  const peer = definition.peer;
  const set = (patch: Partial<typeof peer>) => onChange({ ...definition, peer: { ...peer, ...patch } });
  const flagged = definition.sections.flatMap((s) => s.questions).filter((q) => q.peer?.enabled).length;

  return (
    <Panel
      title="Peer feedback"
      description="Let a participant invite someone (a colleague, friend or family member) to answer a few questions about them. The participant gets a private link to share; the other person's answers are stored separately and shown only as an anonymous average beside the participant's own answers."
    >
      <Toggle
        checked={peer.enabled}
        onChange={(enabled) => set({ enabled })}
        label="Enable peer feedback"
        description="Optional for participants — it never blocks completing the assessment."
      />
      {peer.enabled && (
        <>
          {flagged === 0 ? (
            <Alert tone="warning">
              No question is flagged for peers yet. In the Questions tab, open a question and switch on “Also ask the other person”, with wording from their point of view.
            </Alert>
          ) : (
            <p className="text-sm text-ink-soft">
              {flagged} question{flagged === 1 ? " is" : "s are"} asked of peers.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <NumberField
              label="Responses per link"
              value={peer.maxResponses}
              min={1}
              max={10}
              onChange={(maxResponses) => set({ maxResponses: Math.floor(maxResponses) })}
              help="1–10 people can answer."
            />
            <TextAreaField label="Message shown to the other person" value={peer.intro} rows={3} maxLength={1000} onChange={(intro) => set({ intro })} />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary-dark">Relationship options</p>
            <p className="text-xs text-ink-soft">The other person picks how they know the participant. Only this label is stored — never a name or email.</p>
            <ul className="mt-3 space-y-2">
              {peer.relationships.map((rel, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input
                    aria-label={`Relationship option ${i + 1}`}
                    value={rel}
                    maxLength={40}
                    onChange={(e) => set({ relationships: replaceAt(peer.relationships, i, e.target.value) })}
                    className="w-full rounded-xl border border-primary/25 bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    aria-label={`Remove relationship option ${i + 1}`}
                    disabled={peer.relationships.length <= 1}
                    onClick={() => set({ relationships: removeAt(peer.relationships, i) })}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-soft hover:text-accent-ink disabled:opacity-40"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {peer.relationships.length < 12 && (
              <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline" onClick={() => set({ relationships: [...peer.relationships, ""] })}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}
