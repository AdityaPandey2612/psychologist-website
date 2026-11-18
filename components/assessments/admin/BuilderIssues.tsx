"use client";

import { CircleAlert, CircleCheck, ChevronDown, ChevronUp, TriangleAlert } from "lucide-react";
import type { Issue } from "@/lib/assessments/definition";
import type { AssessmentDefinition } from "@/lib/assessments/types";
import { cx } from "../ui";
import { locateIssue, type IssueLocation } from "./builderState";

export interface BuilderIssuesProps {
  errors: Issue[];
  warnings: Issue[];
  definition: AssessmentDefinition;
  open: boolean;
  onToggle: () => void;
  onJump: (location: IssueLocation) => void;
}

/** Live validation summary. Errors block publishing; warnings are suggestions. */
export function BuilderIssues({ errors, warnings, definition, open, onToggle, onJump }: BuilderIssuesProps) {
  const clean = errors.length === 0 && warnings.length === 0;
  const tone = errors.length ? "border-accent-ink/40 bg-[#FBEEE5]" : warnings.length ? "border-gold/60 bg-[#FBF3DC]" : "border-primary/25 bg-[#E3F1EA]";

  return (
    <section aria-label="Validation" id="builder-issues" className={cx("rounded-2xl border", tone)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        disabled={clean}
        className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
      >
        {errors.length ? (
          <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-accent-ink" />
        ) : warnings.length ? (
          <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-[#6B4E0F]" />
        ) : (
          <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        )}
        <span className="min-w-0 flex-1 text-sm font-medium text-primary-dark">
          {clean
            ? "No problems found — this assessment is ready to publish."
            : [
                errors.length ? `${errors.length} problem${errors.length === 1 ? "" : "s"} to fix before publishing` : "Ready to publish",
                warnings.length ? `${warnings.length} suggestion${warnings.length === 1 ? "" : "s"}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
        {!clean && (open ? <ChevronUp aria-hidden="true" className="h-4 w-4 text-primary-dark" /> : <ChevronDown aria-hidden="true" className="h-4 w-4 text-primary-dark" />)}
      </button>

      {open && !clean && (
        <ul className="space-y-1 border-t border-primary/10 px-3 py-3">
          {[...errors.map((issue) => ({ issue, kind: "error" as const })), ...warnings.map((issue) => ({ issue, kind: "warning" as const }))].map(({ issue, kind }, i) => {
            const location = locateIssue(definition, issue);
            return (
              <li key={`${issue.path}-${i}`}>
                <button
                  type="button"
                  onClick={() => onJump(location)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-white/60"
                >
                  <span
                    aria-hidden="true"
                    className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", kind === "error" ? "bg-accent-ink" : "bg-gold")}
                  />
                  <span className="min-w-0">
                    <span className="sr-only">{kind === "error" ? "Problem: " : "Suggestion: "}</span>
                    <span className="block text-ink">{issue.message}</span>
                    <span className="block text-xs text-ink-soft">{location.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
