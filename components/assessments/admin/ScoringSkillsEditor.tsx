"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { newId } from "@/lib/assessments/text";
import type { Context, Skill } from "@/lib/assessments/types";
import { NumberField, Panel, RowActions, TextAreaField, TextField, moveItem, removeAt, replaceAt } from "./SettingsControls";
import { contextImpact, impactSentence, removeContext, removeSkill, skillImpact, updateScoring } from "./ScoringUtils";
import type { EditorProps } from "./types";

const MAX_SKILLS = 20;
const MAX_CONTEXTS = 6;

function SkillCard({
  skill,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  skill: Skill;
  index: number;
  count: number;
  onChange: (next: Skill) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const tips = skill.tips ?? [];
  const planItems = skill.planItems ?? [];
  // Open a brand-new (unnamed) skill once; afterwards the browser owns the open state.
  const [startOpen] = useState(!skill.name);
  return (
    <details className="group rounded-2xl border border-primary/15 bg-surface" open={startOpen}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3">
        <span className="min-w-0 flex-1 font-semibold text-primary-dark">
          {skill.name || "Unnamed skill"}
          <span className="ml-2 text-sm font-normal text-ink-soft">weight {skill.weight}</span>
        </span>
        <span className="text-sm text-primary group-open:hidden">Edit</span>
        <span className="hidden text-sm text-primary group-open:inline">Close</span>
      </summary>
      <div className="space-y-4 border-t border-primary/10 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <TextField label="Skill name" value={skill.name} maxLength={80} onChange={(name) => onChange({ ...skill, name })} />
          <NumberField
            label="Weight"
            value={skill.weight}
            min={0}
            max={100}
            step={0.5}
            onChange={(weight) => onChange({ ...skill, weight })}
            help="Relative importance in the overall score."
          />
        </div>
        <TextField
          label="Short description"
          value={skill.description ?? ""}
          maxLength={500}
          optional
          onChange={(description) => onChange({ ...skill, description: description || undefined })}
          help="Shown beside the skill's score in the results."
        />
        <TextAreaField
          label="Strength message"
          value={skill.strengthText ?? ""}
          maxLength={1000}
          optional
          onChange={(strengthText) => onChange({ ...skill, strengthText: strengthText || undefined })}
          help="Shown when this skill is one of the participant's strongest."
        />
        <TextAreaField
          label="Growth message"
          value={skill.growthText ?? ""}
          maxLength={1000}
          optional
          onChange={(growthText) => onChange({ ...skill, growthText: growthText || undefined })}
          help="Shown when this skill is one of the participant's growth areas."
        />
        <div>
          <p className="text-sm font-semibold text-primary-dark">
            Tips <span className="font-normal text-ink-soft">(shown with the growth message)</span>
          </p>
          <ul className="mt-2 space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-center gap-2">
                <input
                  aria-label={`${skill.name || "Skill"} tip ${i + 1}`}
                  value={tip}
                  maxLength={400}
                  onChange={(e) => onChange({ ...skill, tips: replaceAt(tips, i, e.target.value) })}
                  className="w-full rounded-xl border border-primary/25 bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  aria-label={`Remove tip ${i + 1}`}
                  onClick={() => onChange({ ...skill, tips: removeAt(tips, i) })}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-surface-soft hover:text-accent-ink"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {tips.length < 10 && (
            <button
              type="button"
              onClick={() => onChange({ ...skill, tips: [...tips, ""] })}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add tip
            </button>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-dark">
            Plan steps <span className="font-normal text-ink-soft">(for a numbered plan, one step per line)</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-soft">
            Used when the practice plan has a number of steps (Practice plan box below): the plan takes the first step of every skill, then the second, and so on, starting with the lowest-scoring skill.
          </p>
          <textarea
            aria-label={`${skill.name || "Skill"} plan steps, one per line`}
            rows={4}
            value={planItems.join("\n")}
            maxLength={5000}
            onChange={(e) => {
              const lines = e.target.value.split("\n").slice(0, 12);
              onChange({ ...skill, planItems: lines.some((l) => l.trim()) || lines.length > 1 ? lines : undefined });
            }}
            className="mt-2 w-full rounded-xl border border-primary/25 bg-surface px-3 py-2 text-sm leading-relaxed text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex justify-end border-t border-primary/10 pt-3">
          <RowActions index={index} count={count} onMove={onMove} onRemove={onRemove} noun={`skill ${skill.name || index + 1}`} />
        </div>
      </div>
    </details>
  );
}

export function ScoringSkillsEditor({ definition, onChange }: EditorProps) {
  const { skills, contexts } = definition.scoring;

  const setSkills = (next: Skill[]) => onChange(updateScoring(definition, { skills: next }));
  const setContexts = (next: Context[]) => onChange(updateScoring(definition, { contexts: next }));

  const deleteSkill = (skill: Skill) => {
    const impact = impactSentence(skillImpact(definition, skill.id));
    const ok = window.confirm(`Delete the skill "${skill.name || "Unnamed skill"}"?${impact ? `\n\n${impact}.` : ""}`);
    if (ok) onChange(removeSkill(definition, skill.id));
  };

  const deleteContext = (context: Context) => {
    const impact = impactSentence(contextImpact(definition, context.id));
    const ok = window.confirm(`Delete the context "${context.name || "Unnamed context"}"?${impact ? `\n\n${impact}.` : ""}`);
    if (ok) onChange(removeContext(definition, context.id));
  };

  return (
    <>
      <Panel
        title="Skills"
        description="A skill groups questions that measure the same thing (for example Attention). Link questions to skills in the Questions tab. Each skill gets its own 0–100 score, and the overall score is their weighted average."
      >
        {skills.length === 0 && (
          <p className="rounded-xl bg-surface-soft/60 px-4 py-3 text-sm text-ink-soft">
            No skills yet. Add at least one if the overall score should be built from skills, or switch the method above to “all scored questions”.
          </p>
        )}
        <div className="space-y-3">
          {skills.map((skill, i) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              index={i}
              count={skills.length}
              onChange={(next) => setSkills(replaceAt(skills, i, next))}
              onMove={(delta) => setSkills(moveItem(skills, i, delta))}
              onRemove={() => deleteSkill(skill)}
            />
          ))}
        </div>
        {skills.length < MAX_SKILLS && (
          <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setSkills([...skills, { id: newId("sk"), name: "", weight: 1 }])}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add skill
          </button>
        )}
      </Panel>

      <Panel
        title="Contexts"
        description="Optional. Contexts let you compare the same skills in different settings, such as Work and Home. Tag questions with a context in the Questions tab; the results can then show a side-by-side comparison."
      >
        <ul className="space-y-3">
          {contexts.map((context, i) => (
            <li key={context.id} className="flex flex-wrap items-end gap-3">
              <TextField
                className="min-w-[12rem] flex-1"
                label={`Context ${i + 1} name`}
                value={context.name}
                maxLength={60}
                onChange={(name) => setContexts(replaceAt(contexts, i, { ...context, name }))}
              />
              <RowActions index={i} count={contexts.length} onMove={(d) => setContexts(moveItem(contexts, i, d))} onRemove={() => deleteContext(context)} noun={`context ${context.name || i + 1}`} />
            </li>
          ))}
        </ul>
        {contexts.length < MAX_CONTEXTS ? (
          <button type="button" className="btn-outline px-4 py-2 text-sm" onClick={() => setContexts([...contexts, { id: newId("ctx"), name: "" }])}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add context
          </button>
        ) : (
          <p className="text-sm text-ink-soft">You can have up to {MAX_CONTEXTS} contexts.</p>
        )}
      </Panel>
    </>
  );
}
