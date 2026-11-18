"use client";

import { RotateCcw, Smartphone, Monitor, Wand2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import AssessmentForm from "@/components/assessments/AssessmentForm";
import AssessmentResults from "@/components/assessments/AssessmentResults";
import { computeResult } from "@/lib/assessments/scoring";
import { toPublicForm } from "@/lib/assessments/definition";
import { validateAnswers } from "@/lib/assessments/validation";
import type { Answers, AssessmentDefinition, AssessmentMeta, AssessmentResult } from "@/lib/assessments/types";
import { Alert, cx } from "../ui";
import { sampleAnswers, type SampleProfile as Profile } from "./BuilderSamples";

type Mode = "walk" | "sample";

const PROFILE_LABELS: Record<Profile, string> = { strong: "Strong habits", mixed: "Mixed", low: "Low scores" };

export function PreviewPanel({ assessmentId, meta, definition }: { assessmentId: string; meta: AssessmentMeta; definition: AssessmentDefinition }) {
  const [mode, setMode] = useState<Mode>("walk");
  const [mobile, setMobile] = useState(true);
  const [profile, setProfile] = useState<Profile>("strong");
  const [restart, setRestart] = useState(0);

  const form = useMemo(() => toPublicForm(definition), [definition]);

  // Same pure validation + scoring code the server runs, applied to the unsaved draft.
  const score = useCallback(
    async (answers: Answers) => {
      const validation = validateAnswers(definition, answers);
      if (!validation.ok) return { ok: false, errors: validation.errors, result: null };
      return { ok: true, errors: {} as Record<string, string>, result: computeResult(definition, validation.clean) };
    },
    [definition],
  );

  const sample = useMemo(() => {
    const validation = validateAnswers(definition, sampleAnswers(definition, profile));
    const result: AssessmentResult | null = validation.ok ? computeResult(definition, validation.clean) : null;
    return { errors: validation.errors, result };
  }, [definition, profile]);

  const assessment = { id: assessmentId, slug: meta.slug || "preview", title: meta.title, estimatedMinutes: meta.estimatedMinutes };
  const unscored = !definition.scoring.enabled;

  return (
    <div className="space-y-5">
      <Alert tone="info">
        The preview uses your <strong>unsaved edits</strong>. Nothing is stored or emailed, and the numbers come from the same scoring code the server uses for real submissions.
      </Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Preview mode" className="inline-flex rounded-full border border-primary/20 bg-surface p-1">
          {([
            ["walk", "Walk through the form"],
            ["sample", "Sample result"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cx("rounded-full px-4 py-2 text-sm font-medium transition", mode === id ? "bg-primary text-surface" : "text-primary-dark hover:bg-surface-soft")}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode === "walk" && (
            <button type="button" onClick={() => setRestart((n) => n + 1)} className="btn-outline px-4 py-2 text-sm">
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> Restart
            </button>
          )}
          <div role="group" aria-label="Preview width" className="inline-flex rounded-full border border-primary/20 bg-surface p-1">
            <button
              type="button"
              aria-pressed={mobile}
              onClick={() => setMobile(true)}
              className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition", mobile ? "bg-primary text-surface" : "text-primary-dark hover:bg-surface-soft")}
            >
              <Smartphone aria-hidden="true" className="h-4 w-4" /> Mobile
            </button>
            <button
              type="button"
              aria-pressed={!mobile}
              onClick={() => setMobile(false)}
              className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition", !mobile ? "bg-primary text-surface" : "text-primary-dark hover:bg-surface-soft")}
            >
              <Monitor aria-hidden="true" className="h-4 w-4" /> Full width
            </button>
          </div>
        </div>
      </div>

      {mode === "sample" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-dark">
            <Wand2 aria-hidden="true" className="h-4 w-4" /> Fill with sample answers:
          </span>
          <div role="group" aria-label="Sample answer profile" className="inline-flex rounded-full border border-primary/20 bg-surface p-1">
            {(Object.keys(PROFILE_LABELS) as Profile[]).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={profile === p}
                onClick={() => setProfile(p)}
                className={cx("rounded-full px-3 py-1.5 text-sm transition", profile === p ? "bg-primary text-surface" : "text-primary-dark hover:bg-surface-soft")}
              >
                {PROFILE_LABELS[p]}
              </button>
            ))}
          </div>
          {unscored && <span className="text-xs text-ink-soft">Scoring is off, so only your result messages will appear.</span>}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-bg p-3 sm:p-5">
        <div className="mx-auto transition-[max-width]" style={{ maxWidth: mobile ? 390 : undefined }}>
          {mode === "walk" ? (
            <AssessmentForm
              key={`${restart}-${JSON.stringify(form).length}`}
              assessment={assessment}
              version={0}
              form={form}
              preview={{ score, resultsConfig: definition.results, zones: definition.scoring.zoneMap?.zones }}
            />
          ) : sample.result ? (
            <AssessmentResults title={meta.title} firstName="Alex" completedAt={new Date().toISOString()} result={sample.result} config={definition.results} zones={definition.scoring.zoneMap?.zones} preview />
          ) : (
            <Alert tone="warning">
              The sample answers don’t satisfy every question yet, so there is no result to show.
              <ul className="mt-2 list-disc pl-5">
                {Object.entries(sample.errors)
                  .slice(0, 5)
                  .map(([id, message]) => (
                    <li key={id}>{message}</li>
                  ))}
              </ul>
              Try “Walk through the form” to answer by hand.
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
