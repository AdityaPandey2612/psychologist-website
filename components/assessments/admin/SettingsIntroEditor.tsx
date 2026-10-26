"use client";

import { Plus } from "lucide-react";
import { defaultHighlights } from "@/lib/assessments/definition";
import type { IntroHighlight } from "@/lib/assessments/types";
import { Panel, RowActions, TextAreaField, TextField, moveItem, removeAt, replaceAt } from "./SettingsControls";
import type { EditorProps } from "./types";

const MAX_HIGHLIGHTS = 3;

/**
 * Introduction settings: the heading and text shown before the questions, plus the
 * printed-form details (title block, info tiles and the notice box).
 */
export function SettingsIntroEditor({ definition, onChange }: EditorProps) {
  const { intro } = definition;
  const set = (patch: Partial<typeof intro>) => onChange({ ...definition, intro: { ...intro, ...patch } });
  const highlights = intro.highlights ?? [];
  const setHighlights = (next: IntroHighlight[]) => set({ highlights: next });

  return (
    <Panel
      title="Introduction"
      description="The top of the form shows the practice logo, the assessment title, a subtitle and a short note. The text and tiles below appear on the introduction page, before the first question."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Subtitle"
          value={intro.subtitle ?? ""}
          maxLength={160}
          optional
          placeholder="e.g. Understanding Your Emotional Wellbeing"
          onChange={(subtitle) => set({ subtitle })}
          help="Shown under the title."
        />
        <TextField
          label="Short note under the subtitle"
          value={intro.badge ?? ""}
          maxLength={80}
          optional
          placeholder="e.g. Confidential & Self-Paced"
          onChange={(badge) => set({ badge })}
        />
      </div>

      <TextField label="Introduction heading" value={intro.heading} maxLength={200} onChange={(heading) => set({ heading })} />
      <TextAreaField
        label="Introduction text"
        value={intro.body}
        rows={5}
        maxLength={3000}
        onChange={(body) => set({ body })}
        help="Plain text. Blank lines start a new paragraph. Say how long it takes and that it is not a diagnosis."
      />

      <div>
        <p className="text-sm font-semibold text-primary-dark">Info tiles</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Up to three short tiles under the introduction, for example “Private” or “Takes about 12 minutes”. You can use{" "}
          <code className="rounded bg-surface-soft px-1">{"{{minutes}}"}</code>, <code className="rounded bg-surface-soft px-1">{"{{questions}}"}</code> and{" "}
          <code className="rounded bg-surface-soft px-1">{"{{sections}}"}</code> and they are filled in automatically. Only say what is true for this
          assessment — for example, answers are stored on the server to build each person&apos;s results.
        </p>
        <ul className="mt-3 space-y-3">
          {highlights.map((h, i) => (
            <li key={i} className="rounded-2xl border border-primary/15 bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-2">
                  <TextField label={`Tile ${i + 1} title`} value={h.title} maxLength={120} onChange={(title) => setHighlights(replaceAt(highlights, i, { ...h, title }))} />
                  <TextField label={`Tile ${i + 1} text`} value={h.text} maxLength={300} onChange={(text) => setHighlights(replaceAt(highlights, i, { ...h, text }))} />
                </div>
                <RowActions
                  index={i}
                  count={highlights.length}
                  noun={`tile ${i + 1}`}
                  onMove={(delta) => setHighlights(moveItem(highlights, i, delta))}
                  onRemove={() => setHighlights(removeAt(highlights, i))}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-outline px-4 py-2 text-sm"
            disabled={highlights.length >= MAX_HIGHLIGHTS}
            onClick={() => setHighlights([...highlights, { title: "", text: "" }])}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add tile
          </button>
          <button type="button" className="text-sm font-medium text-primary-dark underline underline-offset-4" onClick={() => setHighlights(defaultHighlights())}>
            Use the default tiles
          </button>
        </div>
      </div>

      <TextAreaField
        label="Important notice"
        value={intro.disclaimer ?? ""}
        rows={3}
        maxLength={1200}
        optional
        onChange={(disclaimer) => set({ disclaimer })}
        help="Shown in a highlighted box on the introduction page, for example that this is a self-reflection tool and not a diagnosis. Leave empty to hide the box."
      />
    </Panel>
  );
}
