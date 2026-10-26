"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import type { Condition, ConditionRule, FieldType, Question, RuleOperator, RuleValue } from "@/lib/assessments/types";
import { cx } from "../ui";
import { IconButton, selectClass } from "./BuilderFields";
import { shorten } from "./builderState";

// Structured visibility rules. The editor can only produce the JSON shape in
// Condition — there is no expression or code input anywhere.

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  equals: "is",
  not_equals: "is not",
  in: "is one of",
  not_in: "is none of",
  contains: "includes",
  gt: "is greater than",
  gte: "is at least",
  lt: "is less than",
  lte: "is at most",
  answered: "is answered",
  not_answered: "is not answered",
};

const TEXT_OPERATOR_LABELS: Partial<Record<RuleOperator, string>> = { contains: "contains the text" };

const OPERATORS_BY_TYPE: Partial<Record<FieldType, RuleOperator[]>> = {
  radio: ["equals", "not_equals", "in", "not_in", "answered", "not_answered"],
  dropdown: ["equals", "not_equals", "in", "not_in", "answered", "not_answered"],
  checkbox: ["contains", "in", "not_in", "answered", "not_answered"],
  yes_no: ["equals", "not_equals", "answered", "not_answered"],
  peer_feedback: ["equals", "not_equals", "answered", "not_answered"],
  rating5: ["equals", "not_equals", "gt", "gte", "lt", "lte", "answered", "not_answered"],
  rating_scale: ["equals", "not_equals", "gt", "gte", "lt", "lte", "answered", "not_answered"],
  slider: ["equals", "not_equals", "gt", "gte", "lt", "lte", "answered", "not_answered"],
  number: ["equals", "not_equals", "gt", "gte", "lt", "lte", "answered", "not_answered"],
  short_text: ["equals", "not_equals", "contains", "answered", "not_answered"],
  long_text: ["contains", "answered", "not_answered"],
  email: ["equals", "not_equals", "contains", "answered", "not_answered"],
  date: ["equals", "not_equals", "answered", "not_answered"],
};

const CHOICE_TYPES: FieldType[] = ["radio", "dropdown", "checkbox"];
const YES_NO_TYPES: FieldType[] = ["yes_no", "peer_feedback"];
const NUMERIC_TYPES: FieldType[] = ["rating5", "rating_scale", "slider", "number"];

const operatorsFor = (q: Question): RuleOperator[] => OPERATORS_BY_TYPE[q.type] ?? ["answered", "not_answered"];
const needsValue = (op: RuleOperator) => op !== "answered" && op !== "not_answered";
const isMulti = (op: RuleOperator) => op === "in" || op === "not_in";

function operatorLabel(q: Question, op: RuleOperator): string {
  return (q.type === "short_text" || q.type === "long_text" || q.type === "email" ? TEXT_OPERATOR_LABELS[op] : undefined) ?? OPERATOR_LABELS[op];
}

function numberRange(q: Question): { min: number; max: number } {
  if (q.type === "rating5") return { min: 1, max: 5 };
  return { min: q.min ?? (q.type === "slider" ? 0 : 1), max: q.max ?? (q.type === "slider" ? 100 : 10) };
}

function defaultValue(q: Question, op: RuleOperator): RuleValue | undefined {
  if (!needsValue(op)) return undefined;
  if (CHOICE_TYPES.includes(q.type)) {
    const first = q.choices?.[0]?.id ?? "";
    return isMulti(op) ? (first ? [first] : []) : first;
  }
  if (YES_NO_TYPES.includes(q.type)) return "yes";
  if (NUMERIC_TYPES.includes(q.type)) return numberRange(q).min;
  return "";
}

function newRule(q: Question): ConditionRule {
  const operator = operatorsFor(q)[0];
  const value = defaultValue(q, operator);
  return { questionId: q.id, operator, ...(value !== undefined ? { value } : {}) };
}

/** Converts the current value when the operator changes (single value <-> list). */
function adaptValue(q: Question, from: ConditionRule, op: RuleOperator): RuleValue | undefined {
  if (!needsValue(op)) return undefined;
  const current = from.value;
  if (isMulti(op)) {
    if (Array.isArray(current)) return current;
    return current === undefined || current === "" || typeof current === "boolean" ? (defaultValue(q, op) as RuleValue) : [current];
  }
  if (Array.isArray(current)) return current[0] ?? defaultValue(q, op);
  return current ?? defaultValue(q, op);
}

function describeValue(q: Question, rule: ConditionRule): string {
  if (!needsValue(rule.operator)) return "";
  const values = Array.isArray(rule.value) ? rule.value : rule.value === undefined ? [] : [rule.value];
  const label = (v: string | number | boolean) => {
    if (CHOICE_TYPES.includes(q.type)) return q.choices?.find((c) => c.id === v)?.label ?? String(v);
    if (YES_NO_TYPES.includes(q.type)) return v === "yes" ? "Yes" : v === "no" ? "No" : String(v);
    return String(v);
  };
  return values.length ? values.map(label).join(", ") : "…";
}

function describeRule(q: Question | undefined, rule: ConditionRule): string {
  if (!q) return "a question that no longer exists";
  const value = describeValue(q, rule);
  return `“${shorten(q.label || "Untitled question", 50)}” ${operatorLabel(q, rule.operator)}${value ? `: ${value}` : ""}`;
}

export function describeCondition(condition: Condition, candidates: Question[], noun = "this"): string {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const joiner = condition.match === "any" ? " or " : " and ";
  const parts = condition.rules.map((r) => describeRule(byId.get(r.questionId), r));
  return `${condition.action === "hide" ? "Hide" : "Show"} ${noun} ${condition.action === "hide" ? "when" : "if"} ${parts.join(joiner)}.`;
}

export interface ConditionEditorProps {
  value?: Condition;
  onChange: (next: Condition | undefined) => void;
  /** Only questions that come BEFORE the guarded item — a rule can't look forward. */
  candidates: Question[];
  /** What the rule guards, e.g. "section" or "question". */
  label: string;
}

export function ConditionEditor({ value, onChange, candidates, label }: ConditionEditorProps) {
  const uid = useId();
  const usable = candidates.filter((q) => q.type !== "info");
  const byId = new Map(candidates.map((c) => [c.id, c]));

  if (!value) {
    return (
      <div className="rounded-xl border border-dashed border-primary/25 bg-surface-soft/40 p-4">
        <p className="text-sm font-medium text-primary-dark">Always shown</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          Optionally show or hide this {label} depending on an earlier answer, for example to skip a section when someone answers “No”.
        </p>
        <button
          type="button"
          disabled={usable.length === 0}
          onClick={() => onChange({ action: "show", match: "all", rules: [newRule(usable[0])] })}
          className="btn-outline mt-3 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-transparent disabled:hover:text-primary"
        >
          <Plus aria-hidden="true" className="h-4 w-4" /> Add a condition
        </button>
        {usable.length === 0 && <p className="mt-2 text-xs text-ink-soft">There are no earlier questions to base a condition on yet.</p>}
      </div>
    );
  }

  const update = (patch: Partial<Condition>) => onChange({ ...value, ...patch });
  const updateRule = (index: number, rule: ConditionRule) => update({ rules: value.rules.map((r, i) => (i === index ? rule : r)) });
  const removeRule = (index: number) => {
    const rules = value.rules.filter((_, i) => i !== index);
    onChange(rules.length ? { ...value, rules } : undefined);
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-surface-soft/40 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`${uid}-action`} className="sr-only">
          Show or hide
        </label>
        <select
          id={`${uid}-action`}
          value={value.action}
          onChange={(e) => update({ action: e.target.value as Condition["action"] })}
          className={cx(selectClass, "w-auto")}
        >
          <option value="show">Show this {label} when…</option>
          <option value="hide">Hide this {label} when…</option>
        </select>
        {value.rules.length > 1 && (
          <>
            <label htmlFor={`${uid}-match`} className="sr-only">
              Match all or any rule
            </label>
            <select
              id={`${uid}-match`}
              value={value.match}
              onChange={(e) => update({ match: e.target.value as Condition["match"] })}
              className={cx(selectClass, "w-auto")}
            >
              <option value="all">all of these are true</option>
              <option value="any">any of these is true</option>
            </select>
          </>
        )}
      </div>

      <ul className="space-y-3">
        {value.rules.map((rule, index) => {
          const question = byId.get(rule.questionId);
          const missing = !question;
          const operators = question ? operatorsFor(question) : [];
          return (
            <li key={index} className="rounded-lg border border-primary/15 bg-surface p-3">
              <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)_auto] md:items-start">
                <div>
                  <label htmlFor={`${uid}-q-${index}`} className="sr-only">
                    Question for rule {index + 1}
                  </label>
                  <select
                    id={`${uid}-q-${index}`}
                    value={rule.questionId}
                    onChange={(e) => {
                      const q = byId.get(e.target.value);
                      if (q) updateRule(index, newRule(q));
                    }}
                    className={selectClass}
                    aria-invalid={missing || undefined}
                  >
                    {missing && <option value={rule.questionId}>(question removed or moved)</option>}
                    {usable.map((q) => (
                      <option key={q.id} value={q.id}>
                        {shorten(q.label || "Untitled question", 70)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={`${uid}-op-${index}`} className="sr-only">
                    Condition for rule {index + 1}
                  </label>
                  <select
                    id={`${uid}-op-${index}`}
                    value={rule.operator}
                    disabled={!question}
                    onChange={(e) => {
                      if (!question) return;
                      const operator = e.target.value as RuleOperator;
                      const next = adaptValue(question, rule, operator);
                      updateRule(index, { questionId: rule.questionId, operator, ...(next !== undefined ? { value: next } : {}) });
                    }}
                    className={selectClass}
                  >
                    {question
                      ? operators.map((op) => (
                          <option key={op} value={op}>
                            {operatorLabel(question, op)}
                          </option>
                        ))
                      : null}
                  </select>
                </div>

                <div>
                  {question && needsValue(rule.operator) ? (
                    <ValueInput id={`${uid}-v-${index}`} question={question} rule={rule} onChange={(v) => updateRule(index, { ...rule, value: v })} />
                  ) : (
                    <p className="py-2 text-xs text-ink-soft">{question ? "No value needed" : ""}</p>
                  )}
                </div>

                <IconButton label={`Remove rule ${index + 1}`} tone="danger" onClick={() => removeRule(index)}>
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={usable.length === 0}
          onClick={() => update({ rules: [...value.rules, newRule(usable[0])] })}
          className="btn-outline px-4 py-2 text-sm"
        >
          <Plus aria-hidden="true" className="h-4 w-4" /> Add another rule
        </button>
        <button type="button" onClick={() => onChange(undefined)} className="text-sm font-medium text-accent-ink underline underline-offset-4">
          Remove all conditions
        </button>
      </div>

      <p className="rounded-lg bg-surface px-3 py-2 text-sm text-primary-dark">{describeCondition(value, candidates, `this ${label}`)}</p>
      <p className="text-xs leading-relaxed text-ink-soft">
        Required questions are only enforced while they are visible. Hidden questions are skipped, their answers are not saved, and they are not scored.
      </p>
    </div>
  );
}

function ValueInput({
  id,
  question,
  rule,
  onChange,
}: {
  id: string;
  question: Question;
  rule: ConditionRule;
  onChange: (value: RuleValue) => void;
}) {
  const label = `Value for ${shorten(question.label || "question", 40)}`;

  if (CHOICE_TYPES.includes(question.type)) {
    const choices = question.choices ?? [];
    if (isMulti(rule.operator)) {
      const selected = new Set(Array.isArray(rule.value) ? rule.value.map(String) : []);
      return (
        <fieldset className="space-y-1.5">
          <legend className="sr-only">{label}</legend>
          {choices.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  onChange(choices.filter((x) => next.has(x.id)).map((x) => x.id));
                }}
                className="h-4 w-4 accent-primary"
              />
              {c.label || "Untitled option"}
            </label>
          ))}
        </fieldset>
      );
    }
    const current = typeof rule.value === "string" ? rule.value : "";
    const known = choices.some((c) => c.id === current);
    return (
      <select id={id} aria-label={label} value={current} onChange={(e) => onChange(e.target.value)} className={selectClass} aria-invalid={!known || undefined}>
        {!known && <option value={current}>(choice removed)</option>}
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label || "Untitled option"}
          </option>
        ))}
      </select>
    );
  }

  if (YES_NO_TYPES.includes(question.type)) {
    return (
      <select id={id} aria-label={label} value={String(rule.value ?? "yes")} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }

  if (NUMERIC_TYPES.includes(question.type)) {
    const { min, max } = numberRange(question);
    return (
      <input
        id={id}
        aria-label={label}
        type="number"
        min={min}
        max={max}
        value={typeof rule.value === "number" || typeof rule.value === "string" ? String(rule.value) : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className={selectClass}
      />
    );
  }

  return (
    <input
      id={id}
      aria-label={label}
      type={question.type === "date" ? "date" : "text"}
      maxLength={200}
      value={typeof rule.value === "string" || typeof rule.value === "number" ? String(rule.value) : ""}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    />
  );
}
