"use client";

import type { ReactNode } from "react";
import type { PublicQuestion } from "@/lib/assessments/definition";
import type { AnswerValue } from "@/lib/assessments/types";
import { DEFAULT_LIMITS, ratingBounds } from "@/lib/assessments/validation";
import { cx, inputClass } from "./ui";

export interface DynamicQuestionRendererProps {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (questionId: string, value: AnswerValue | undefined) => void;
  error?: string;
  /** Prefix for DOM ids; the question's wrapper gets `${idPrefix}-${question.id}`. */
  idPrefix?: string;
  disabled?: boolean;
  /**
   * Shows the question as a numbered card ("SADNESS & MOOD | Question 1 of 21").
   * Information blocks are never numbered.
   */
  numbering?: { index: number; total: number; tag?: string };
}

/** DOM id of a question's wrapper (used to scroll/focus the first error). */
export const questionDomId = (questionId: string, idPrefix = "q") => `${idPrefix}-${questionId}`;

const SLIDER_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className={cx("whitespace-pre-line", className)}>
            {p}
          </p>
        ))}
    </>
  );
}

const choiceRow =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-primary/25 bg-surface px-4 py-3 text-ink transition hover:bg-surface-soft/70 has-[:checked]:border-primary has-[:checked]:bg-surface-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2";

const pillLabel =
  "flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border border-primary/25 bg-surface px-3 text-base font-semibold text-primary-dark transition hover:bg-surface-soft peer-checked:border-primary peer-checked:bg-primary peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-60";

export default function DynamicQuestionRenderer({ question: q, value, onChange, error, idPrefix = "q", disabled, numbering }: DynamicQuestionRendererProps) {
  const card = numbering && q.type !== "info" ? numbering : null;
  const base = questionDomId(q.id, idPrefix);
  const descId = q.description ? `${base}-desc` : undefined;
  const helpId = q.helpText ? `${base}-help` : undefined;
  const errId = error ? `${base}-err` : undefined;
  const describedBy = [descId, helpId, errId].filter(Boolean).join(" ") || undefined;
  const set = (v: AnswerValue | undefined) => onChange(q.id, v);

  // ---- information block (no input)
  if (q.type === "info") {
    return (
      <div id={base} className="scroll-mt-28 rounded-2xl bg-surface-soft p-5 sm:p-6">
        {q.label && <h3 className="font-display text-xl text-primary-dark">{q.label}</h3>}
        {q.body && <Paragraphs text={q.body} className={cx("leading-relaxed text-ink", q.label && "mt-3")} />}
      </div>
    );
  }

  const marker = q.required ? (
    <>
      <span aria-hidden="true" className="ml-1 text-accent-ink">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  ) : (
    <span className="ml-2 text-xs font-normal text-ink-soft">Optional</span>
  );

  const hints: ReactNode = (
    <>
      {q.description && (
        <p id={descId} className={cx("mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft", card && "italic")}>
          {q.description}
        </p>
      )}
      {q.helpText && (
        <p id={helpId} className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
          {q.helpText}
        </p>
      )}
    </>
  );

  const errorEl = error ? (
    <p id={errId} role="alert" className="mt-2 text-sm font-medium text-accent-ink">
      {error}
    </p>
  ) : null;

  const labelClass = cx("block font-semibold leading-snug text-primary-dark", card ? "text-lg" : "text-base");
  const numberPrefix = card ? (
    <span aria-hidden="true" className="mr-1.5">
      {card.index}.
    </span>
  ) : null;
  const wrapper = (children: ReactNode, grouped: boolean) => (
    <div id={base} className={cx("scroll-mt-28", card && "rounded-lg border border-primary/15 border-l-4 border-l-primary-dark bg-surface-soft/40 p-4 sm:p-5")}>
      {card && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {card.tag && <span className="font-semibold uppercase tracking-wide text-primary-dark">{card.tag}</span>}
          {card.tag && (
            <span aria-hidden="true" className="text-ink-soft">
              |
            </span>
          )}
          <span className="text-ink-soft">
            Question {card.index} of {card.total}
          </span>
        </div>
      )}
      {grouped ? (
        <fieldset className="min-w-0" aria-describedby={describedBy}>
          <legend className={cx(labelClass, "p-0")} id={`${base}-legend`}>
            {numberPrefix}
            {q.label}
            {marker}
          </legend>
          {hints}
          <div className="mt-3">{children}</div>
        </fieldset>
      ) : (
        <>
          <label htmlFor={`${base}-input`} className={labelClass}>
            {numberPrefix}
            {q.label}
            {marker}
          </label>
          {hints}
          <div className="mt-3">{children}</div>
        </>
      )}
      {errorEl}
    </div>
  );

  const inputCommon = {
    id: `${base}-input`,
    disabled,
    "aria-describedby": describedBy,
    "aria-invalid": error ? true : undefined,
    "aria-required": q.required || undefined,
  } as const;

  switch (q.type) {
    case "short_text": {
      const limit = q.maxLength ?? DEFAULT_LIMITS.short_text;
      return wrapper(
        <input
          {...inputCommon}
          type="text"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          maxLength={limit}
          placeholder={q.placeholder}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />,
        false,
      );
    }

    case "long_text": {
      const limit = q.maxLength ?? DEFAULT_LIMITS.long_text;
      const text = typeof value === "string" ? value : "";
      return wrapper(
        <>
          <textarea
            {...inputCommon}
            rows={5}
            className={cx(inputClass, "resize-y")}
            value={text}
            maxLength={limit}
            placeholder={q.placeholder}
            onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
          />
          <p className="mt-1 text-right text-xs text-ink-soft" aria-hidden="true">
            {text.length} / {limit}
          </p>
        </>,
        false,
      );
    }

    case "email":
      return wrapper(
        <input
          {...inputCommon}
          type="email"
          inputMode="email"
          autoComplete="email"
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          placeholder={q.placeholder}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />,
        false,
      );

    case "number":
      return wrapper(
        <input
          {...inputCommon}
          type="number"
          inputMode="decimal"
          step="any"
          min={q.min}
          max={q.max}
          className={inputClass}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          placeholder={q.placeholder}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />,
        false,
      );

    case "date":
      return wrapper(
        <input
          {...inputCommon}
          type="date"
          className={cx(inputClass, "sm:max-w-xs")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        />,
        false,
      );

    case "dropdown":
      return wrapper(
        <select
          {...inputCommon}
          className={inputClass}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => set(e.target.value === "" ? undefined : e.target.value)}
        >
          <option value="">Choose an option…</option>
          {(q.choices ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>,
        false,
      );

    case "radio":
      return wrapper(
        <div role="radiogroup" aria-labelledby={`${base}-legend`} aria-required={q.required || undefined} aria-invalid={error ? true : undefined} className="grid gap-2">
          {(q.choices ?? []).map((c) => (
            <label key={c.id} className={choiceRow}>
              <input
                type="radio"
                name={base}
                value={c.id}
                checked={value === c.id}
                disabled={disabled}
                onChange={() => set(c.id)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              <span className="leading-snug">{c.label}</span>
            </label>
          ))}
        </div>,
        true,
      );

    case "checkbox": {
      const picked = Array.isArray(value) ? value : [];
      const range =
        q.minSelections && q.maxSelections
          ? `Choose ${q.minSelections}–${q.maxSelections}.`
          : q.maxSelections
            ? `Choose up to ${q.maxSelections}.`
            : q.minSelections
              ? `Choose at least ${q.minSelections}.`
              : "Choose all that apply.";
      return wrapper(
        <>
          <p className="mb-2 text-sm text-ink-soft">{range}</p>
          <div className="grid gap-2">
            {(q.choices ?? []).map((c) => (
              <label key={c.id} className={choiceRow}>
                <input
                  type="checkbox"
                  name={base}
                  value={c.id}
                  checked={picked.includes(c.id)}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.checked ? [...picked, c.id] : picked.filter((id) => id !== c.id);
                    set(next.length ? next : undefined);
                  }}
                  className="h-5 w-5 shrink-0 accent-primary"
                />
                <span className="leading-snug">{c.label}</span>
              </label>
            ))}
          </div>
        </>,
        true,
      );
    }

    case "rating5":
    case "rating_scale": {
      const { min, max, step } = ratingBounds(q);
      const count = Math.min(21, Math.floor((max - min) / step) + 1);
      const numbers = Array.from({ length: Math.max(count, 1) }, (_, i) => Math.round((min + i * step) * 1000) / 1000);
      const current = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : undefined;
      return wrapper(
        <>
          <div role="radiogroup" aria-labelledby={`${base}-legend`} aria-required={q.required || undefined} aria-invalid={error ? true : undefined} className="flex flex-wrap gap-1.5 sm:gap-2">
            {numbers.map((n) => (
              <div key={n} className="relative min-w-[2.25rem] flex-1 sm:min-w-[2.75rem]">
                <input
                  id={`${base}-${n}`}
                  type="radio"
                  name={base}
                  value={n}
                  checked={current === n}
                  disabled={disabled}
                  onChange={() => set(n)}
                  className="peer sr-only"
                />
                <label htmlFor={`${base}-${n}`} className={pillLabel}>
                  {n}
                  {n === numbers[0] && q.minLabel && <span className="sr-only"> ({q.minLabel})</span>}
                  {n === numbers[numbers.length - 1] && q.maxLabel && <span className="sr-only"> ({q.maxLabel})</span>}
                </label>
              </div>
            ))}
          </div>
          {(q.minLabel || q.maxLabel) && (
            <div className="mt-2 flex justify-between gap-4 text-xs text-ink-soft" aria-hidden="true">
              <span>{q.minLabel}</span>
              <span className="text-right">{q.maxLabel}</span>
            </div>
          )}
        </>,
        true,
      );
    }

    case "slider": {
      const { min, max, step } = ratingBounds(q);
      const answered = typeof value === "number" ? value : typeof value === "string" && value !== "" ? Number(value) : undefined;
      const shown = answered ?? Math.round(((min + max) / 2) / step) * step;
      return wrapper(
        <>
          <div className="flex items-center gap-4">
            <input
              {...inputCommon}
              type="range"
              min={min}
              max={max}
              step={step}
              value={shown}
              aria-valuetext={answered === undefined ? "Not answered yet" : String(answered)}
              className={cx("h-11 w-full min-w-0 flex-1 cursor-pointer accent-primary", answered === undefined && "opacity-60")}
              onChange={(e) => set(Number(e.target.value))}
              onPointerUp={(e) => set(Number((e.currentTarget as HTMLInputElement).value))}
              onKeyUp={(e) => {
                if (SLIDER_KEYS.includes(e.key)) set(Number((e.currentTarget as HTMLInputElement).value));
              }}
            />
            <output htmlFor={`${base}-input`} aria-live="polite" className="w-14 shrink-0 rounded-lg bg-surface-soft py-2 text-center text-lg font-semibold text-primary-dark">
              {answered === undefined ? "—" : answered}
            </output>
          </div>
          <div className="mt-1 flex justify-between gap-4 text-xs text-ink-soft" aria-hidden="true">
            <span>{q.minLabel ?? min}</span>
            <span className="text-right">{q.maxLabel ?? max}</span>
          </div>
          {answered === undefined ? (
            <p className="mt-1 text-xs text-ink-soft">Move the slider to give your answer.</p>
          ) : (
            !q.required && (
              <button type="button" className="mt-1 text-xs font-medium text-primary-dark underline underline-offset-4" onClick={() => set(undefined)}>
                Clear answer
              </button>
            )
          )}
        </>,
        false,
      );
    }

    case "yes_no":
    case "peer_feedback": {
      return wrapper(
        <>
          <div role="radiogroup" aria-labelledby={`${base}-legend`} aria-required={q.required || undefined} aria-invalid={error ? true : undefined} className="grid max-w-sm grid-cols-2 gap-2">
            {(["yes", "no"] as const).map((v) => (
              <div key={v} className="relative">
                <input
                  id={`${base}-${v}`}
                  type="radio"
                  name={base}
                  value={v}
                  checked={value === v}
                  disabled={disabled}
                  onChange={() => set(v)}
                  className="peer sr-only"
                />
                <label htmlFor={`${base}-${v}`} className={pillLabel}>
                  {v === "yes" ? "Yes" : "No"}
                </label>
              </div>
            ))}
          </div>
          {q.type === "peer_feedback" && (
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              If you choose Yes, you&apos;ll get a private link on your results page to share with one person. You stay in control — you can switch the link off at any time.
            </p>
          )}
        </>,
        true,
      );
    }

    default:
      return null;
  }
}
