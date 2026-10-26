"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { newQuestion } from "@/lib/assessments/definition";
import { newId } from "@/lib/assessments/text";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type AssessmentDefinition, type Choice, type FieldType, type Question } from "@/lib/assessments/types";
import { Alert, cx, inputClass } from "../ui";
import { Field, IconButton, NumberField, selectClass, textareaClass, Toggle } from "./BuilderFields";
import { CHOICE_TYPES, SCORABLE_TYPES, changeQuestionType, moveItem, removeAt, replaceAt } from "./builderState";
import { ConditionEditor } from "./ConditionEditor";
import { HelpTip } from "./HelpTip";
import type { TabId } from "./builderState";

// Plain-words explanations shown from the "i" beside each setting.
const TIPS = {
  description: "Extra words under the question, for example a short example or a reminder of the time period. Leave it empty if the question is clear on its own.",
  helpText: "A small note shown under the answer box, for example “Go with your first reaction”. Leave it empty if the question needs no extra note.",
  category: "A small heading shown above the question, for example “Sadness & Mood”. Questions with the same label look grouped together.",
  required: "The person has to answer this before they can go on. Leave it off if the question is optional. A skipped optional question is left out of the score, not counted as zero.",
  scored: "Adds this answer to the score. Leave it off for questions that are only for information or reflection, like a comment.",
  skill: "The group of questions this answer adds to, for example Warmth or Competence. Each skill gets its own score in the result.",
  context: "An optional tag such as work or home. It lets the result compare how the person answers in different situations.",
  weight: "How much this answer counts compared with the others. 1 is normal, 2 counts double and 0.5 counts half.",
  habit: "A short name for this question in the lists of strongest and weakest habits. If you leave it empty, the whole question is shown there.",
  reverse: "Use this when a high answer is a bad sign, for example “I often interrupt people”. The score is flipped, so a 5 counts like a 1.",
  peer: "Also asks this question to the friend or colleague who gives feedback about the person. Word it for them in the box that appears.",
  peerWording: "The same question, written for the other person, for example “They let me finish my sentences.”. If you leave it empty, the original wording is used.",
  visibility: "Shows or hides this question depending on earlier answers, for example only ask about work stress if the person said they work. Leave it off to always show the question.",
  placeholder: "Grey example text inside the empty answer box. It disappears when the person starts typing.",
  maxLength: "The most characters the person can type. Leave it empty to use the usual limit.",
  minimum: "The lowest number the person is allowed to enter. Leave it empty for no lower limit.",
  maximum: "The highest number the person is allowed to enter. Leave it empty for no upper limit.",
  step: "The size of each step on the scale, for example 5 moves a slider 0, 5, 10… A rating scale always uses whole numbers.",
  labelOne: "The words shown under the lowest number, for example “Not like me”.",
  labelFive: "The words shown under the highest number, for example “Very like me”.",
  minSelections: "The fewest options the person must tick. Leave it empty for no minimum.",
  maxSelections: "The most options the person may tick. Leave it empty for no maximum.",
} as const;

export interface AdminQuestionEditorProps {
  question: Question;
  onChange: (next: Question) => void;
  definition: AssessmentDefinition;
  /** Questions that appear before this one (for visibility rules). */
  candidates: Question[];
  onGoToTab?: (tab: TabId) => void;
}

export function AdminQuestionEditor({ question: q, onChange, definition, candidates, onGoToTab }: AdminQuestionEditorProps) {
  const uid = useId();
  const set = (patch: Partial<Question>) => onChange({ ...q, ...patch });
  const isInfo = q.type === "info";
  const scorable = SCORABLE_TYPES.includes(q.type);
  const scoredOn = Boolean(q.scoring?.scored);
  const { skills, contexts } = definition.scoring;
  const isSelfRating = definition.scoring.selfPerception?.questionId === q.id;

  const toggleScored = (on: boolean) => {
    if (!on) {
      onChange({ ...q, scoring: q.scoring ? { ...q.scoring, scored: false } : undefined });
      return;
    }
    const base = q.scoring ?? { scored: true, weight: 1, reverse: false };
    // Make positional points explicit so reordering options later can't change the score.
    const choices = CHOICE_TYPES.includes(q.type) ? q.choices?.map((c, i) => ({ ...c, points: c.points ?? i })) : q.choices;
    onChange({ ...q, ...(choices ? { choices } : {}), scoring: { ...base, scored: true } });
  };
  const setScoring = (patch: Partial<NonNullable<Question["scoring"]>>) =>
    onChange({ ...q, scoring: { scored: true, weight: 1, reverse: false, ...q.scoring, ...patch } });

  return (
    <div className="space-y-5">
      {/* ---- type + wording ------------------------------------------------ */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <Field label={isInfo ? "Title" : "Question"} htmlFor={`${uid}-label`} hint={isInfo ? "Shown above the text. Optional if you add text below." : undefined}>
          <textarea
            id={`${uid}-label`}
            value={q.label}
            maxLength={300}
            rows={2}
            onChange={(e) => set({ label: e.target.value })}
            className={textareaClass}
            placeholder={isInfo ? "e.g. Before you continue" : "e.g. I let people finish their sentences."}
          />
        </Field>
        <Field label="Field type" htmlFor={`${uid}-type`}>
          <select
            id={`${uid}-type`}
            value={q.type}
            onChange={(e) => {
              const type = e.target.value as FieldType;
              onChange(changeQuestionType(q, type, newQuestion(type)));
            }}
            className={selectClass}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {!isInfo && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Description" htmlFor={`${uid}-desc`} optional tip={TIPS.description} hint="Extra context shown under the question.">
            <textarea
              id={`${uid}-desc`}
              value={q.description ?? ""}
              maxLength={1000}
              rows={2}
              onChange={(e) => set({ description: e.target.value || undefined })}
              className={textareaClass}
            />
          </Field>
          <Field label="Help text" htmlFor={`${uid}-help`} optional tip={TIPS.helpText} hint="A short hint, shown in a smaller size.">
            <input
              id={`${uid}-help`}
              value={q.helpText ?? ""}
              maxLength={500}
              onChange={(e) => set({ helpText: e.target.value || undefined })}
              className={cx(inputClass, "py-2")}
            />
          </Field>
          <Field label="Category label" htmlFor={`${uid}-tag`} optional tip={TIPS.category} hint="Small label above the question, e.g. Sadness & Mood. On one-page forms it defaults to the section title.">
            <input
              id={`${uid}-tag`}
              value={q.tag ?? ""}
              maxLength={60}
              onChange={(e) => set({ tag: e.target.value || undefined })}
              className={cx(inputClass, "py-2")}
            />
          </Field>
        </div>
      )}

      {!isInfo && (
        <Toggle
          checked={q.required}
          onChange={(required) => set({ required })}
          label="Required"
          tip={TIPS.required}
          hint="Only enforced while the question is visible. Optional questions that are skipped are left out of the score."
        />
      )}

      {/* ---- type-specific configuration ----------------------------------- */}
      <TypeConfig uid={uid} q={q} set={set} scored={scoredOn} />

      {/* ---- scoring --------------------------------------------------------- */}
      {scorable && (
        <section className="space-y-4 rounded-xl border border-primary/15 bg-surface-soft/40 p-4" aria-label="Scoring for this question">
          <Toggle
            checked={scoredOn}
            onChange={toggleScored}
            label="Count towards the score"
            tip={TIPS.scored}
            hint="Leave off for reflection or context questions that shouldn’t change the result."
          />
          {isSelfRating && (
            <Alert tone="info">This question is used as the self-rating in the “self vs answers” comparison, so it normally stays unscored.</Alert>
          )}
          {scoredOn && !definition.scoring.enabled && (
            <Alert tone="warning">
              Scoring is switched off for this assessment, so these settings have no effect yet.{" "}
              {onGoToTab && (
                <button type="button" onClick={() => onGoToTab("scoring")} className="font-semibold underline underline-offset-4">
                  Open the Scoring tab
                </button>
              )}
            </Alert>
          )}
          {scoredOn && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Skill"
                htmlFor={`${uid}-skill`}
                tip={TIPS.skill}
                hint={
                  skills.length === 0
                    ? "No skills yet — add them on the Scoring tab, then link this question to one."
                    : definition.scoring.method === "skills"
                      ? "Required: the overall score is built from skill scores."
                      : "Optional: groups questions into a skill score."
                }
              >
                <select id={`${uid}-skill`} value={q.scoring?.skillId ?? ""} onChange={(e) => setScoring({ skillId: e.target.value || undefined })} className={selectClass}>
                  <option value="">— none —</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || "Untitled skill"}
                    </option>
                  ))}
                </select>
                {skills.length === 0 && onGoToTab && (
                  <button type="button" onClick={() => onGoToTab("scoring")} className="mt-1 text-xs font-semibold text-primary-dark underline underline-offset-4">
                    Define skills
                  </button>
                )}
              </Field>
              <Field label="Context" htmlFor={`${uid}-ctx`} optional tip={TIPS.context} hint="For comparisons such as work vs home.">
                <select id={`${uid}-ctx`} value={q.scoring?.contextId ?? ""} onChange={(e) => setScoring({ contextId: e.target.value || undefined })} className={selectClass}>
                  <option value="">— none —</option>
                  {contexts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || "Untitled context"}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Weight" htmlFor={`${uid}-weight`} tip={TIPS.weight} hint="1 is normal; 2 counts twice as much within its skill.">
                <NumberField id={`${uid}-weight`} value={q.scoring?.weight ?? 1} min={0} max={100} step="any" onChange={(n) => setScoring({ weight: n ?? 1 })} />
              </Field>
              <Field label="Habit label" htmlFor={`${uid}-habit`} optional tip={TIPS.habit} hint="Short wording for the “strongest / weakest habits” lists.">
                <input
                  id={`${uid}-habit`}
                  value={q.scoring?.habit ?? ""}
                  maxLength={120}
                  onChange={(e) => setScoring({ habit: e.target.value || undefined })}
                  className={cx(inputClass, "py-2")}
                  placeholder="Defaults to the question text"
                />
              </Field>
              <div className="md:col-span-2">
                <Toggle
                  checked={Boolean(q.scoring?.reverse)}
                  onChange={(reverse) => setScoring({ reverse })}
                  label="Reverse-scored"
                  tip={TIPS.reverse}
                  hint="Use for negatively worded items such as “I interrupt people” — a high answer then lowers the score."
                />
              </div>
              {q.type === "number" && (q.min === undefined || q.max === undefined) && (
                <div className="md:col-span-2">
                  <Alert tone="warning">Scored number questions need both a minimum and a maximum above.</Alert>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ---- peer ------------------------------------------------------------- */}
      {!isInfo && q.type !== "peer_feedback" && (
        <section className="space-y-3 rounded-xl border border-primary/15 bg-surface-soft/40 p-4" aria-label="Peer feedback for this question">
          <Toggle
            checked={Boolean(q.peer?.enabled)}
            onChange={(enabled) => onChange({ ...q, peer: enabled ? { enabled: true, label: q.peer?.label } : undefined })}
            label="Also ask the other person"
            tip={TIPS.peer}
            hint={
              definition.peer.enabled
                ? "Included when someone is invited to give feedback on the participant."
                : "Peer feedback is switched off in Settings; turn it on there for this to be used."
            }
          />
          {q.peer?.enabled && (
            <Field label="Wording for the other person" htmlFor={`${uid}-peer`} tip={TIPS.peerWording} hint="Write it from their point of view, e.g. “They let me finish my sentences.”">
              <textarea
                id={`${uid}-peer`}
                value={q.peer.label ?? ""}
                maxLength={300}
                rows={2}
                onChange={(e) => onChange({ ...q, peer: { enabled: true, label: e.target.value || undefined } })}
                className={textareaClass}
                placeholder="Leave blank to reuse the question text"
              />
            </Field>
          )}
        </section>
      )}

      {/* ---- visibility -------------------------------------------------------- */}
      <section aria-label="Visibility for this question" className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="font-body text-sm font-semibold text-primary-dark">Conditional visibility</h4>
          <HelpTip label="Conditional visibility">{TIPS.visibility}</HelpTip>
        </div>
        <ConditionEditor value={q.visibility} onChange={(visibility) => set({ visibility })} candidates={candidates} label="question" />
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------------

function TypeConfig({ uid, q, set, scored }: { uid: string; q: Question; set: (patch: Partial<Question>) => void; scored: boolean }) {
  switch (q.type) {
    case "short_text":
    case "long_text":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Placeholder" htmlFor={`${uid}-ph`} optional tip={TIPS.placeholder}>
            <input id={`${uid}-ph`} value={q.placeholder ?? ""} maxLength={200} onChange={(e) => set({ placeholder: e.target.value || undefined })} className={cx(inputClass, "py-2")} />
          </Field>
          <Field label="Maximum length" htmlFor={`${uid}-max`} optional tip={TIPS.maxLength} hint={q.type === "short_text" ? "Up to 1,000 characters (200 if blank)." : "Up to 10,000 characters (3,000 if blank)."}>
            <NumberField id={`${uid}-max`} value={q.maxLength} min={1} max={q.type === "short_text" ? 1000 : 10000} step={1} onChange={(n) => set({ maxLength: n === undefined ? undefined : Math.round(n) })} />
          </Field>
        </div>
      );

    case "email":
      return (
        <Field label="Placeholder" htmlFor={`${uid}-ph`} optional tip={TIPS.placeholder}>
          <input id={`${uid}-ph`} value={q.placeholder ?? ""} maxLength={200} onChange={(e) => set({ placeholder: e.target.value || undefined })} className={cx(inputClass, "py-2")} />
        </Field>
      );

    case "number":
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Minimum" htmlFor={`${uid}-min`} optional tip={TIPS.minimum}>
            <NumberField id={`${uid}-min`} value={q.min} step="any" onChange={(n) => set({ min: n })} />
          </Field>
          <Field label="Maximum" htmlFor={`${uid}-max`} optional tip={TIPS.maximum}>
            <NumberField id={`${uid}-max`} value={q.max} step="any" onChange={(n) => set({ max: n })} />
          </Field>
          <Field label="Placeholder" htmlFor={`${uid}-ph`} optional tip={TIPS.placeholder}>
            <input id={`${uid}-ph`} value={q.placeholder ?? ""} maxLength={200} onChange={(e) => set({ placeholder: e.target.value || undefined })} className={cx(inputClass, "py-2")} />
          </Field>
        </div>
      );

    case "radio":
    case "dropdown":
    case "checkbox":
      return (
        <div className="space-y-4">
          <ChoicesEditor choices={q.choices ?? []} onChange={(choices) => set({ choices })} scored={scored} multiple={q.type === "checkbox"} />
          {q.type === "checkbox" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Minimum selections" htmlFor={`${uid}-mins`} optional tip={TIPS.minSelections}>
                <NumberField id={`${uid}-mins`} value={q.minSelections} min={0} max={50} step={1} onChange={(n) => set({ minSelections: n ? Math.round(n) : undefined })} />
              </Field>
              <Field label="Maximum selections" htmlFor={`${uid}-maxs`} optional tip={TIPS.maxSelections}>
                <NumberField id={`${uid}-maxs`} value={q.maxSelections} min={1} max={50} step={1} onChange={(n) => set({ maxSelections: n ? Math.round(n) : undefined })} />
              </Field>
            </div>
          )}
        </div>
      );

    case "rating5":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Label for 1" htmlFor={`${uid}-minl`} optional tip={TIPS.labelOne}>
            <input id={`${uid}-minl`} value={q.minLabel ?? ""} maxLength={60} onChange={(e) => set({ minLabel: e.target.value || undefined })} className={cx(inputClass, "py-2")} placeholder="Never" />
          </Field>
          <Field label="Label for 5" htmlFor={`${uid}-maxl`} optional tip={TIPS.labelFive}>
            <input id={`${uid}-maxl`} value={q.maxLabel ?? ""} maxLength={60} onChange={(e) => set({ maxLabel: e.target.value || undefined })} className={cx(inputClass, "py-2")} placeholder="Always" />
          </Field>
        </div>
      );

    case "rating_scale":
    case "slider": {
      const bound = 1000;
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Minimum" htmlFor={`${uid}-min`} tip={TIPS.minimum}>
            <NumberField id={`${uid}-min`} value={q.min} min={-bound} max={bound} step="any" onChange={(n) => set({ min: n })} />
          </Field>
          <Field label="Maximum" htmlFor={`${uid}-max`} tip={TIPS.maximum}>
            <NumberField id={`${uid}-max`} value={q.max} min={-bound} max={bound} step="any" onChange={(n) => set({ max: n })} />
          </Field>
          <Field label="Step" htmlFor={`${uid}-step`} tip={TIPS.step} hint={q.type === "rating_scale" ? "Rating scales use whole numbers." : undefined}>
            <NumberField id={`${uid}-step`} value={q.step} min={0.0001} step="any" onChange={(n) => set({ step: n })} />
          </Field>
          <Field label="Label for minimum" htmlFor={`${uid}-minl`} optional tip={TIPS.labelOne}>
            <input id={`${uid}-minl`} value={q.minLabel ?? ""} maxLength={60} onChange={(e) => set({ minLabel: e.target.value || undefined })} className={cx(inputClass, "py-2")} />
          </Field>
          <Field label="Label for maximum" htmlFor={`${uid}-maxl`} optional tip={TIPS.labelFive}>
            <input id={`${uid}-maxl`} value={q.maxLabel ?? ""} maxLength={60} onChange={(e) => set({ maxLabel: e.target.value || undefined })} className={cx(inputClass, "py-2")} />
          </Field>
        </div>
      );
    }

    case "info":
      return (
        <Field
          label="Text"
          htmlFor={`${uid}-body`}
          hint="Plain text only — HTML is not rendered. Leave a blank line between paragraphs."
        >
          <textarea id={`${uid}-body`} value={q.body ?? ""} maxLength={5000} rows={5} onChange={(e) => set({ body: e.target.value })} className={textareaClass} />
        </Field>
      );

    case "peer_feedback":
      return (
        <Alert tone="info">
          Shows an optional Yes/No invitation. If the participant says yes, their results page offers a private link to share with someone who can answer the peer questions.
          Turn peer feedback on in Settings and mark which questions to ask the other person.
        </Alert>
      );

    default:
      return null;
  }
}

function ChoicesEditor({
  choices,
  onChange,
  scored,
  multiple,
}: {
  choices: Choice[];
  onChange: (next: Choice[]) => void;
  scored: boolean;
  multiple: boolean;
}) {
  const uid = useId();
  const add = () => {
    const nextPoints = choices.reduce((m, c, i) => Math.max(m, (c.points ?? i) + 1), 0);
    onChange([...choices, { id: newId("c"), label: `Option ${choices.length + 1}`, ...(scored ? { points: nextPoints } : {}) }]);
  };
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-primary-dark">Answer options</legend>
      {scored && (
        <p className="text-xs leading-relaxed text-ink-soft">
          Points decide the score: the highest-point option scores 100, the lowest 0{multiple ? " (selected options add up)" : ""}. Points stay with their option when you reorder.
        </p>
      )}
      <ul className="space-y-2">
        {choices.map((c, i) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-right text-xs text-ink-soft" aria-hidden="true">
              {i + 1}.
            </span>
            <input
              aria-label={`Option ${i + 1} text`}
              value={c.label}
              maxLength={200}
              onChange={(e) => onChange(replaceAt(choices, i, { ...c, label: e.target.value }))}
              className={cx(inputClass, "min-w-0 flex-1 py-2")}
            />
            {scored && (
              <div className="w-24">
                <NumberField aria-label={`Points for option ${i + 1}`} value={c.points ?? i} step="any" onChange={(n) => onChange(replaceAt(choices, i, { ...c, points: n ?? 0 }))} />
              </div>
            )}
            <IconButton label={`Move option ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveItem(choices, i, i - 1))}>
              <ArrowUp aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <IconButton label={`Move option ${i + 1} down`} disabled={i === choices.length - 1} onClick={() => onChange(moveItem(choices, i, i + 1))}>
              <ArrowDown aria-hidden="true" className="h-4 w-4" />
            </IconButton>
            <IconButton label={`Remove option ${i + 1}`} tone="danger" disabled={choices.length <= 2} onClick={() => onChange(removeAt(choices, i))}>
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="btn-outline px-4 py-2 text-sm" id={`${uid}-add`}>
        <Plus aria-hidden="true" className="h-4 w-4" /> Add option
      </button>
      {choices.length <= 2 && <p className="text-xs text-ink-soft">A choice question needs at least two options.</p>}
    </fieldset>
  );
}
