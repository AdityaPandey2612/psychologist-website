"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { newId } from "@/lib/assessments/text";
import type { PlanPractice, PlanWeek } from "@/lib/assessments/types";
import { FieldLabel, cx, inputClass } from "@/components/assessments/ui";
import { NumberField, Panel, RowActions, TextAreaField, TextField, Toggle, moveItem, removeAt, replaceAt } from "./SettingsControls";
import { updateScoring } from "./ScoringUtils";
import type { EditorProps } from "./types";

export function ScoringPlanEditor({ definition, onChange }: EditorProps) {
  const plan = definition.scoring.practicePlan;
  const { skills } = definition.scoring;
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const setPlan = (patch: Partial<typeof plan>) => onChange(updateScoring(definition, { practicePlan: { ...plan, ...patch } }));
  const setWeeks = (weeks: PlanWeek[]) => setPlan({ weeks });
  const setWeek = (index: number, patch: Partial<PlanWeek>) => setWeeks(replaceAt(plan.weeks, index, { ...plan.weeks[index], ...patch }));

  const addWeek = () => {
    const week: PlanWeek = { id: newId("wk"), title: "", days: "", practices: [] };
    setJustAdded(week.id);
    setWeeks([...plan.weeks, week]);
  };

  return (
    <Panel
      title="30-day practice plan"
      description="A short, week-by-week plan shown on the results page and (optionally) in the email. A practice linked to a skill only appears if that skill is one of the participant's growth areas; practices with no skill are shown to everyone."
    >
      <Toggle checked={plan.enabled} onChange={(enabled) => setPlan({ enabled })} label="Include a practice plan" description="Turn off to hide the plan everywhere." />

      {plan.enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <TextField label="Plan title" value={plan.title} maxLength={120} onChange={(title) => setPlan({ title })} />
            <NumberField
              label="Growth areas to focus on"
              value={plan.focusCount}
              min={0}
              max={10}
              onChange={(focusCount) => setPlan({ focusCount: Math.floor(focusCount) })}
              help="Lowest-scoring skills that personalise the plan."
            />
          </div>
          <TextAreaField label="Introduction" value={plan.intro ?? ""} optional rows={2} maxLength={600} onChange={(intro) => setPlan({ intro: intro || undefined })} />

          <div className="rounded-2xl border border-primary/15 bg-surface-soft/30 p-4">
            <p className="text-sm font-semibold text-primary-dark">Numbered steps instead of weeks</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              Set a number of steps (for example 7 for a 7 day plan) to give every participant that many numbered steps, taken one at a time from each skill&apos;s plan steps, the lowest-scoring skill first. Write the steps on each skill (Skills box above). Leave the number empty to use the weeks below.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plan-length" className="block text-sm font-semibold text-primary-dark">
                  Number of steps <span className="font-normal text-ink-soft">(optional, 1–30)</span>
                </label>
                <input
                  id="plan-length"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  inputMode="numeric"
                  value={plan.length ?? ""}
                  placeholder="Use weeks"
                  onChange={(e) => {
                    const n = Math.floor(Number(e.target.value));
                    setPlan({ length: e.target.value.trim() === "" || !Number.isFinite(n) || n < 1 ? undefined : Math.min(30, n) });
                  }}
                  className={cx(inputClass, "mt-1.5")}
                />
              </div>
              {plan.length ? (
                <TextField label="Word before each step" value={plan.labelPrefix ?? ""} optional maxLength={20} placeholder="Step" help="For example “Day” gives “Day 1”, “Day 2”…" onChange={(labelPrefix) => setPlan({ labelPrefix: labelPrefix || undefined })} />
              ) : null}
            </div>
            {plan.length ? (
              skills.some((s) => (s.planItems?.length ?? 0) > 0) ? null : (
                <p className="mt-3 text-sm text-accent-ink">No skill has plan steps yet, so the plan would be empty. Add them on each skill.</p>
              )
            ) : null}
          </div>

          <div className={cx("space-y-3", plan.length ? "opacity-60" : undefined)} aria-label={plan.length ? "Weeks (not used while a number of steps is set)" : undefined}>
            {plan.length ? <p className="text-sm text-ink-soft">The weeks below are not used while a number of steps is set.</p> : null}
            {plan.weeks.map((week, wi) => (
              <details key={week.id} className="group rounded-2xl border border-primary/15 bg-surface" open={week.id === justAdded ? true : undefined}>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1 font-semibold text-primary-dark">
                    {week.title || `Week ${wi + 1}`}
                    {week.days && <span className="ml-2 text-sm font-normal text-ink-soft">{week.days}</span>}
                  </span>
                  <span className="text-sm text-ink-soft">{week.practices.length} practice{week.practices.length === 1 ? "" : "s"}</span>
                  <span className="text-sm text-primary group-open:hidden">Edit</span>
                  <span className="hidden text-sm text-primary group-open:inline">Close</span>
                </summary>
                <div className="space-y-4 border-t border-primary/10 px-4 py-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
                    <TextField label="Week title" value={week.title} maxLength={120} onChange={(title) => setWeek(wi, { title })} />
                    <TextField label="Days label" value={week.days} maxLength={40} placeholder="Days 1–7" onChange={(days) => setWeek(wi, { days })} />
                  </div>
                  <TextField label="Goal" value={week.goal ?? ""} optional maxLength={300} onChange={(goal) => setWeek(wi, { goal: goal || undefined })} />

                  <div>
                    <p className="text-sm font-semibold text-primary-dark">Practices</p>
                    <ul className="mt-2 space-y-3">
                      {week.practices.map((practice, pi) => {
                        const setPractice = (p: PlanPractice) => setWeek(wi, { practices: replaceAt(week.practices, pi, p) });
                        const selectId = `practice-skill-${practice.id}`;
                        return (
                          <li key={practice.id} className="rounded-xl border border-primary/10 bg-surface-soft/40 p-3">
                            <TextAreaField
                              label={`Practice ${pi + 1}`}
                              value={practice.text}
                              rows={2}
                              maxLength={500}
                              onChange={(text) => setPractice({ ...practice, text })}
                            />
                            <div className="mt-3 flex flex-wrap items-end gap-3">
                              <div className="min-w-[12rem] flex-1">
                                <FieldLabel htmlFor={selectId}>Shown to</FieldLabel>
                                <select
                                  id={selectId}
                                  value={practice.skillId ?? ""}
                                  onChange={(e) => {
                                    const { skillId: _drop, ...rest } = practice;
                                    void _drop;
                                    setPractice(e.target.value ? { ...rest, skillId: e.target.value } : rest);
                                  }}
                                  className={cx(inputClass, "mt-1.5 py-2")}
                                >
                                  <option value="">Everyone (general practice)</option>
                                  {skills.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      Only if {s.name || "(unnamed skill)"} is a growth area
                                    </option>
                                  ))}
                                  {practice.skillId && !skills.some((s) => s.id === practice.skillId) && <option value={practice.skillId}>(missing skill)</option>}
                                </select>
                              </div>
                              <RowActions
                                index={pi}
                                count={week.practices.length}
                                noun={`practice ${pi + 1}`}
                                onMove={(d) => setWeek(wi, { practices: moveItem(week.practices, pi, d) })}
                                onRemove={() => setWeek(wi, { practices: removeAt(week.practices, pi) })}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {week.practices.length < 30 && (
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline"
                        onClick={() => setWeek(wi, { practices: [...week.practices, { id: newId("pr"), text: "" }] })}
                      >
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        Add practice
                      </button>
                    )}
                  </div>

                  <div className="flex justify-end border-t border-primary/10 pt-3">
                    <RowActions
                      index={wi}
                      count={plan.weeks.length}
                      noun={`week ${week.title || wi + 1}`}
                      onMove={(d) => setWeeks(moveItem(plan.weeks, wi, d))}
                      onRemove={() => {
                        if (window.confirm(`Delete "${week.title || `Week ${wi + 1}`}" and its practices?`)) setWeeks(removeAt(plan.weeks, wi));
                      }}
                    />
                  </div>
                </div>
              </details>
            ))}
          </div>

          {plan.weeks.length < 8 && (
            <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={addWeek}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add week
            </button>
          )}
          {plan.weeks.length === 0 && <p className="text-sm text-ink-soft">Add at least one week, or the plan won’t be shown.</p>}
        </>
      )}
    </Panel>
  );
}
