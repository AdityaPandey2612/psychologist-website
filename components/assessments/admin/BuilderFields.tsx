"use client";

import { useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx, inputClass } from "../ui";
import { HelpTip } from "./HelpTip";

// Small form primitives shared by the builder editors.

/** Square icon-only button; `label` becomes the accessible name and tooltip. */
export function IconButton({
  label,
  children,
  tone = "default",
  ...rest
}: { label: string; children: ReactNode; tone?: "default" | "danger" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-surface text-primary-dark transition",
        "hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface",
        tone === "danger" && "hover:border-accent-ink/40 hover:bg-[#FBEEE5] hover:text-accent-ink",
        rest.className,
      )}
    >
      {children}
    </button>
  );
}

/** Labelled switch built on a native checkbox so it stays keyboard and screen-reader friendly. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  tip,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  /** A plain-words explanation, shown from an "i" beside the label. */
  tip?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="peer mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-primary/25 transition checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50
          relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow before:transition checked:before:translate-x-4"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="cursor-pointer text-sm font-medium text-ink">
            {label}
          </label>
          {tip && <HelpTip label={label}>{tip}</HelpTip>}
        </div>
        {hint && (
          <p id={`${id}-hint`} className="mt-0.5 text-xs leading-relaxed text-ink-soft">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** Number input that tolerates half-typed values like "-" or "1." and clears to `undefined`. */
export function NumberField({
  value,
  onChange,
  id,
  min,
  max,
  step,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  id?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const parse = (text: string): number | undefined | null => {
    if (text.trim() === "") return undefined;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  };
  const [text, setText] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    if (parse(text) !== value) setText(value === undefined ? "" : String(value));
    // Only resync when the outside value changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cx(inputClass, "py-2", className)}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed !== null) onChange(parsed);
      }}
    />
  );
}

export function Field({
  label,
  hint,
  tip,
  children,
  htmlFor,
  optional,
  className,
}: {
  label: string;
  hint?: string;
  /** A plain-words explanation, shown from an "i" beside the label. */
  tip?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-primary-dark">
          {label}
          {optional && <span className="ml-2 font-normal text-ink-soft">(optional)</span>}
        </label>
        {tip && <HelpTip label={label}>{tip}</HelpTip>}
      </div>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{hint}</p>}
    </div>
  );
}

export const selectClass = cx(inputClass, "py-2");
export const textareaClass = cx(inputClass, "min-h-[5.5rem] resize-y py-2");
