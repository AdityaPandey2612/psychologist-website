"use client";

import { Plus, X } from "lucide-react";
import type { Context, Question, ScoreCondition, ScoreOperator, Skill } from "@/lib/assessments/types";
import { cx, inputClass } from "@/components/assessments/ui";
import { NumberInput } from "./SettingsControls";

const OPERATORS: Array<{ value: ScoreOperator; label: string }> = [
  { value: "lt", label: "is below" },
  { value: "lte", label: "is at most" },
  { value: "gt", label: "is above" },
  { value: "gte", label: "is at least" },
  { value: "between", label: "is between" },
];

const encode = (c: ScoreCondition) => (c.source.type === "overall" ? "overall" : `${c.source.type}:${c.source.id}`);

function decode(value: string): ScoreCondition["source"] {
  if (value === "overall") return { type: "overall" };
  const [type, ...rest] = value.split(":");
  return { type: type === "context" ? "context" : type === "question" ? "question" : "skill", id: rest.join(":") };
}

const shorten = (text: string, max = 70) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Edits the "show when…" conditions of a result message. Conditions are plain
 * data (score source + comparison + number); all must hold for the message to
 * appear, and no conditions means it always appears.
 */
export function ScoringConditionEditor({
  conditions,
  onChange,
  skills,
  contexts,
  questions = [],
}: {
  conditions: ScoreCondition[];
  onChange: (next: ScoreCondition[]) => void;
  skills: Skill[];
  contexts: Context[];
  /** Scored questions a message can look at (their score is 0–100 after reverse scoring). */
  questions?: Question[];
}) {
  const update = (index: number, patch: Partial<ScoreCondition>) =>
    onChange(conditions.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  return (
    <div className="space-y-2">
      {conditions.length === 0 && <p className="text-sm text-ink-soft">No conditions — this message is shown to everyone.</p>}
      {conditions.map((cond, index) => {
        const known =
          cond.source.type === "overall" ||
          (cond.source.type === "skill" && skills.some((s) => s.id === (cond.source as { id: string }).id)) ||
          (cond.source.type === "context" && contexts.some((c) => c.id === (cond.source as { id: string }).id)) ||
          (cond.source.type === "question" && questions.some((q) => q.id === (cond.source as { id: string }).id));
        return (
          <div key={index} className="rounded-xl border border-primary/15 bg-surface-soft/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-primary-dark">{index === 0 ? "Show when" : "and"}</span>
              <select
                aria-label={`Condition ${index + 1}: score to check`}
                value={encode(cond)}
                onChange={(e) => update(index, { source: decode(e.target.value) })}
                className={cx(inputClass, "w-auto min-w-0 flex-1 py-2")}
              >
                <option value="overall">Overall score</option>
                {skills.map((s) => (
                  <option key={s.id} value={`skill:${s.id}`}>
                    Skill: {s.name || "(unnamed)"}
                  </option>
                ))}
                {contexts.map((c) => (
                  <option key={c.id} value={`context:${c.id}`}>
                    Context: {c.name || "(unnamed)"}
                  </option>
                ))}
                {questions.length > 0 && (
                  <optgroup label="A single question (0 = first answer … 100 = last answer, after reverse scoring)">
                    {questions.map((q) => (
                      <option key={q.id} value={`question:${q.id}`}>
                        Question: {shorten(q.label || "(untitled)")}
                      </option>
                    ))}
                  </optgroup>
                )}
                {!known && <option value={encode(cond)}>(missing {cond.source.type})</option>}
              </select>
              <select
                aria-label={`Condition ${index + 1}: comparison`}
                value={cond.operator}
                onChange={(e) => {
                  const operator = e.target.value as ScoreOperator;
                  update(index, { operator, value2: operator === "between" ? (cond.value2 ?? 100) : undefined });
                }}
                className={cx(inputClass, "w-auto py-2")}
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <NumberInput
                label={`Condition ${index + 1}: score${cond.operator === "between" ? " from" : ""}`}
                value={cond.value}
                onChange={(value) => update(index, { value })}
                min={0}
                max={100}
                className="w-24 py-2"
              />
              {cond.operator === "between" && (
                <>
                  <span className="text-sm text-ink-soft">and</span>
                  <NumberInput
                    label={`Condition ${index + 1}: score up to`}
                    value={cond.value2 ?? 100}
                    onChange={(value2) => update(index, { value2 })}
                    min={0}
                    max={100}
                    className="w-24 py-2"
                  />
                </>
              )}
              <button
                type="button"
                aria-label={`Remove condition ${index + 1}`}
                onClick={() => onChange(conditions.filter((_, i) => i !== index))}
                className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-white hover:text-accent-ink"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            {!known && <p className="mt-2 text-xs text-accent-ink">This condition points at a skill, context or question that no longer exists, so it will never match. Pick another or remove it.</p>}
          </div>
        );
      })}
      {conditions.length < 6 && (
        <button
          type="button"
          onClick={() => onChange([...conditions, { source: { type: "overall" }, operator: "lt", value: 50 }])}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-dark hover:underline"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add condition
        </button>
      )}
    </div>
  );
}
