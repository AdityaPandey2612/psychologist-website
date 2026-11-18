"use client";

import { Plus } from "lucide-react";
import { newId } from "@/lib/assessments/text";
import type { Level, SkillBand } from "@/lib/assessments/types";
import { cx, FieldLabel } from "@/components/assessments/ui";
import { NumberInput, Panel, RowActions, TextAreaField, TextField, removeAt, replaceAt } from "./SettingsControls";
import { updateScoring } from "./ScoringUtils";
import type { EditorProps } from "./types";

const PALETTE = [
  { bg: "#F5D9C9", fg: "#7A3412" },
  { bg: "#F5E3B8", fg: "#6B4E0F" },
  { bg: "#CFE3DD", fg: "#123A36" },
  { bg: "#1F5C56", fg: "#FFFFFF" },
  { bg: "#123A36", fg: "#FFFFFF" },
  { bg: "#8A4356", fg: "#FFFFFF" },
];

const byMin = <T extends { min: number }>(list: T[]) => [...list].sort((a, b) => a.min - b.min);

function rangeText(sorted: Array<{ min: number }>, index: number): string {
  const start = sorted[index].min;
  const end = index + 1 < sorted.length ? sorted[index + 1].min - 1 : 100;
  return end > start ? `${start}–${end}` : String(start);
}

function RangeBar({ levels }: { levels: Level[] }) {
  const sorted = byMin(levels);
  const summary = sorted.map((l, i) => `${l.label || "Unnamed"} ${rangeText(sorted, i).replace("–", " to ")}`).join(", ");
  return (
    <div>
      <div role="img" aria-label={`Score ranges from 0 to 100: ${summary}`} className="flex h-9 w-full overflow-hidden rounded-full border border-primary/15">
        {sorted.map((level, i) => {
          const end = i + 1 < sorted.length ? sorted[i + 1].min : 100;
          const width = Math.max(0, end - level.min);
          const colour = PALETTE[i % PALETTE.length];
          return (
            <div
              key={level.id}
              style={{ width: `${width}%`, background: colour.bg, color: colour.fg }}
              className="flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap px-1 text-xs font-semibold"
              title={`${level.label || "Unnamed"}: ${rangeText(sorted, i)}`}
            >
              {width >= 10 ? level.label || "—" : ""}
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-ink-soft">
        <span>0</span>
        <span>25</span>
        <span>50</span>
        <span>75</span>
        <span>100</span>
      </div>
    </div>
  );
}

function nextFreeMin(taken: number[]): number {
  const top = Math.max(0, ...taken);
  const guess = Math.min(99, Math.round((top + 100) / 2));
  for (let m = guess; m < 100; m++) if (!taken.includes(m)) return m;
  for (let m = guess - 1; m > 0; m--) if (!taken.includes(m)) return m;
  return 50;
}

export function ScoringLevelsEditor({ definition, onChange }: EditorProps) {
  const { levels, skillBands } = definition.scoring;
  const sorted = byMin(levels);
  const mins = levels.map((l) => l.min);
  const hasDuplicate = new Set(mins).size !== mins.length;
  const startsAtZero = sorted.length > 0 && sorted[0].min === 0;

  const setLevels = (next: Level[]) => onChange(updateScoring(definition, { levels: next }));
  const setBands = (next: SkillBand[]) => onChange(updateScoring(definition, { skillBands: next }));

  return (
    <>
      <Panel
        title="Result levels"
        description={
          <>
            Levels turn the overall score (0–100) into a label. A level starts at its threshold and runs up to the next one. The levels and thresholds in the starter
            template are editable defaults — they are <strong>not</strong> clinically validated, so review them before publishing.
          </>
        }
      >
        <RangeBar levels={levels} />

        {(!startsAtZero || hasDuplicate) && (
          <ul className="space-y-1 rounded-xl border border-accent-ink/30 bg-[#FBEEE5] px-4 py-3 text-sm text-accent-ink">
            {!startsAtZero && <li>The lowest level must start at 0 so every score has a level.</li>}
            {hasDuplicate && <li>Two levels start at the same score. Thresholds must be strictly increasing.</li>}
          </ul>
        )}

        <ol className="space-y-4">
          {levels.map((level, i) => {
            const position = sorted.findIndex((l) => l.id === level.id);
            const colour = PALETTE[position % PALETTE.length];
            return (
              <li key={level.id} className="rounded-2xl border border-primary/15 bg-surface p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <span aria-hidden="true" className="mb-2 h-4 w-4 shrink-0 rounded-full border border-primary/20" style={{ background: colour.bg }} />
                  <TextField className="min-w-[10rem] flex-1" label={`Level ${i + 1} label`} value={level.label} maxLength={60} onChange={(label) => setLevels(replaceAt(levels, i, { ...level, label }))} />
                  <div className="w-32">
                    <FieldLabel htmlFor={`level-min-${level.id}`}>Starts at</FieldLabel>
                    <NumberInput
                      id={`level-min-${level.id}`}
                      value={level.min}
                      min={0}
                      max={100}
                      className="mt-1.5"
                      onChange={(min) => setLevels(replaceAt(levels, i, { ...level, min }))}
                    />
                  </div>
                  <p className="mb-3 text-sm text-ink-soft">Scores {position >= 0 ? rangeText(sorted, position) : "—"}</p>
                  <div className="ml-auto">
                    <RowActions index={i} count={levels.length} onRemove={() => setLevels(removeAt(levels, i))} noun={`level ${level.label || i + 1}`} canRemove={levels.length > 1} />
                  </div>
                </div>
                <TextAreaField
                  className="mt-4"
                  label="Description shown to the participant"
                  value={level.description}
                  rows={3}
                  maxLength={1000}
                  onChange={(description) => setLevels(replaceAt(levels, i, { ...level, description }))}
                />
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          {levels.length < 12 && (
            <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setLevels(byMin([...levels, { id: newId("lvl"), label: "", min: nextFreeMin(mins), description: "" }]))}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add level
            </button>
          )}
          <button type="button" className="text-sm font-semibold text-primary-dark hover:underline" onClick={() => setLevels(sorted)}>
            Sort by threshold
          </button>
        </div>
      </Panel>

      <Panel
        title="Skill bands"
        description="A short label shown next to each skill's score (for example Emerging, Developing, Strong). Each band starts at its threshold."
      >
        <ul className="space-y-3">
          {skillBands.map((band, i) => (
            <li key={i} className="flex flex-wrap items-end gap-3">
              <TextField className="min-w-[10rem] flex-1" label={`Band ${i + 1} label`} value={band.label} maxLength={40} onChange={(label) => setBands(replaceAt(skillBands, i, { ...band, label }))} />
              <div className="w-28">
                <FieldLabel htmlFor={`band-min-${i}`}>Starts at</FieldLabel>
                <NumberInput id={`band-min-${i}`} value={band.min} min={0} max={100} className="mt-1.5" onChange={(min) => setBands(replaceAt(skillBands, i, { ...band, min }))} />
              </div>
              <RowActions index={i} count={skillBands.length} onRemove={() => setBands(removeAt(skillBands, i))} noun={`band ${band.label || i + 1}`} canRemove={skillBands.length > 1} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          {skillBands.length < 8 && (
            <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setBands(byMin([...skillBands, { label: "", min: nextFreeMin(skillBands.map((b) => b.min)) }]))}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add band
            </button>
          )}
          <button type="button" className="text-sm font-semibold text-primary-dark hover:underline" onClick={() => setBands(byMin(skillBands))}>
            Sort by threshold
          </button>
          {skillBands.length > 0 && byMin(skillBands)[0].min !== 0 && <span className={cx("text-sm text-accent-ink")}>The lowest band should start at 0.</span>}
        </div>
      </Panel>
    </>
  );
}
