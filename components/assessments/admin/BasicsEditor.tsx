"use client";

import { useId } from "react";
import { ICON_KEYS } from "@/lib/assessments/definition";
import { slugify } from "@/lib/assessments/text";
import type { AssessmentCategory, AssessmentMeta } from "@/lib/assessments/types";
import { Alert, AssessmentIcon, cx, inputClass } from "../ui";
import { Field, NumberField, selectClass, textareaClass } from "./BuilderFields";
import { ThumbnailField } from "./ThumbnailField";

export interface BasicsEditorProps {
  meta: AssessmentMeta;
  onChange: (next: AssessmentMeta) => void;
  categories: AssessmentCategory[] | null;
  /** The slug can't change once an assessment has been published. */
  slugLocked: boolean;
}

const ICON_LABELS: Record<string, string> = {
  clipboard: "Clipboard",
  ear: "Ear (listening)",
  message: "Message",
  heart: "Heart",
  brain: "Brain",
  users: "People",
  briefcase: "Briefcase",
  sprout: "Sprout",
  compass: "Compass",
  sparkles: "Sparkles",
};

export function BasicsEditor({ meta, onChange, categories, slugLocked }: BasicsEditorProps) {
  const uid = useId();
  const set = (patch: Partial<AssessmentMeta>) => onChange({ ...meta, ...patch });

  const setTitle = (title: string) => {
    // Keep the slug in step with the title until the admin edits the slug themselves.
    const followsTitle = !slugLocked && (meta.slug === "" || meta.slug === slugify(meta.title));
    set({ title, ...(followsTitle ? { slug: slugify(title) } : {}) });
  };

  const setSlug = (raw: string) => set({ slug: raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-/, "").slice(0, 80) });

  return (
    <div className="card space-y-6 p-5 sm:p-7">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Title" htmlFor={`${uid}-title`} className="md:col-span-2">
          <input id={`${uid}-title`} value={meta.title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>

        <Field
          label="URL slug"
          htmlFor={`${uid}-slug`}
          className="md:col-span-2"
          hint={slugLocked ? undefined : "Lowercase letters, numbers and hyphens. It can’t be changed after you publish."}
        >
          <div className="flex items-center gap-2">
            <span className="hidden shrink-0 text-sm text-ink-soft sm:inline">/assessments/</span>
            <input
              id={`${uid}-slug`}
              value={meta.slug}
              readOnly={slugLocked}
              aria-readonly={slugLocked || undefined}
              maxLength={80}
              onChange={(e) => setSlug(e.target.value)}
              className={cx(inputClass, slugLocked && "bg-surface-soft/60")}
              placeholder="my-assessment"
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
          {slugLocked && (
            <Alert tone="info" className="mt-3">
              This assessment has been published, so its URL is fixed and existing links keep working.
            </Alert>
          )}
        </Field>

        <Field label="Short description" htmlFor={`${uid}-desc`} className="md:col-span-2" hint={`${meta.description.length}/400 — shown on the library card and in search results.`}>
          <textarea id={`${uid}-desc`} value={meta.description} maxLength={400} rows={3} onChange={(e) => set({ description: e.target.value })} className={textareaClass} />
        </Field>

        <Field label="Category" htmlFor={`${uid}-cat`}>
          <select id={`${uid}-cat`} value={meta.category} disabled={!categories} onChange={(e) => set({ category: e.target.value })} className={selectClass}>
            {!categories && <option value={meta.category}>Loading…</option>}
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {categories && !categories.some((c) => c.id === meta.category) && <option value={meta.category}>(choose a category)</option>}
          </select>
        </Field>

        <Field label="Estimated time (minutes)" htmlFor={`${uid}-min`}>
          <NumberField id={`${uid}-min`} value={meta.estimatedMinutes} min={1} max={240} step={1} onChange={(n) => set({ estimatedMinutes: Math.max(1, Math.round(n ?? 1)) })} />
        </Field>

        <div className="md:col-span-2">
          <ThumbnailField value={meta.thumbnailUrl} onChange={(thumbnailUrl) => set({ thumbnailUrl })} />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-primary-dark">Icon</legend>
        <div role="radiogroup" aria-label="Icon" className="mt-2 flex flex-wrap gap-2">
          {ICON_KEYS.map((key) => {
            const selected = meta.icon === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={ICON_LABELS[key] ?? key}
                title={ICON_LABELS[key] ?? key}
                onClick={() => set({ icon: key })}
                className={cx(
                  "inline-flex h-12 w-12 items-center justify-center rounded-xl border transition",
                  selected ? "border-primary bg-primary text-surface" : "border-primary/20 bg-surface text-primary-dark hover:bg-surface-soft",
                )}
              >
                <AssessmentIcon name={key} />
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-primary-dark">Access</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(["free", "premium"] as const).map((tier) => (
            <label
              key={tier}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                meta.tier === tier ? "border-primary bg-surface-soft text-primary-dark" : "border-primary/20 bg-surface text-ink hover:bg-surface-soft/60",
              )}
            >
              <input type="radio" name={`${uid}-tier`} checked={meta.tier === tier} onChange={() => set({ tier })} className="h-4 w-4 accent-primary" />
              {tier === "free" ? "Free" : "Premium"}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">The badge is shown on the library card. Payment isn’t built in; premium is a label only.</p>
      </fieldset>
    </div>
  );
}
