"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { cx, FieldLabel, inputClass } from "@/components/assessments/ui";

// Small form controls shared by the scoring, results and settings editors.

export function Panel({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl text-primary-dark">{title}</h3>
          {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => onChange(!checked)}
        className={cx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-primary/30")}
      >
        <span
          aria-hidden="true"
          className={cx("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")}
        />
      </button>
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="cursor-pointer text-sm font-semibold text-primary-dark">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-sm leading-relaxed text-ink-soft">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  help,
  optional,
  maxLength,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  help?: ReactNode;
  optional?: boolean;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? `${id}-help` : undefined}
        className={cx(inputClass, "mt-1.5")}
      />
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-ink-soft">
          {help}
        </p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  help,
  optional,
  maxLength,
  rows = 3,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  help?: ReactNode;
  optional?: boolean;
  maxLength?: number;
  rows?: number;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id} optional={optional}>
        {label}
      </FieldLabel>
      <textarea
        id={id}
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? `${id}-help` : undefined}
        className={cx(inputClass, "mt-1.5 resize-y leading-relaxed")}
      />
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-ink-soft">
          {help}
        </p>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
  className,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  help?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        aria-describedby={help ? `${id}-help` : undefined}
        className={cx(inputClass, "mt-1.5")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-ink-soft">
          {help}
        </p>
      )}
    </div>
  );
}

/**
 * A number input that tolerates an empty/partial value while typing: it reports a
 * parsed (and clamped) number as soon as one exists and re-syncs on blur.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  id,
  className,
  describedBy,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** aria-label, for compact inputs that have no visible label. */
  label?: string;
  id?: string;
  className?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText((current) => (current !== "" && Number(current) === value ? current : String(value)));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={label}
      aria-describedby={describedBy}
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() === "" || !Number.isFinite(n)) return;
        onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
      }}
      onBlur={() => setText(String(value))}
      className={cx(inputClass, className)}
    />
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  help,
  className,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  help?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NumberInput id={id} value={value} onChange={onChange} min={min} max={max} step={step} className="mt-1.5" describedBy={help ? `${id}-help` : undefined} />
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs leading-relaxed text-ink-soft">
          {help}
        </p>
      )}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "border-accent-ink/30 text-accent-ink hover:bg-[#FBEEE5]"
          : "border-primary/25 text-primary-dark hover:bg-surface-soft",
      )}
    >
      {children}
    </button>
  );
}

/** Up / down / delete buttons for one row of a reorderable list. */
export function RowActions({
  index,
  count,
  onMove,
  onRemove,
  noun,
  canRemove = true,
}: {
  index: number;
  count: number;
  onMove?: (delta: -1 | 1) => void;
  onRemove: () => void;
  noun: string;
  canRemove?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {onMove && (
        <>
          <IconButton label={`Move ${noun} up`} onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Move ${noun} down`} onClick={() => onMove(1)} disabled={index === count - 1}>
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </>
      )}
      <IconButton label={`Delete ${noun}`} onClick={onRemove} disabled={!canRemove} tone="danger">
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

// ---------------------------------------------------------------- list helpers

export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export const replaceAt = <T,>(list: T[], index: number, value: T): T[] => list.map((item, i) => (i === index ? value : item));
export const removeAt = <T,>(list: T[], index: number): T[] => list.filter((_, i) => i !== index);
