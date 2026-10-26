"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { useId } from "react";
import { FIELD_TYPE_LABELS, type AssessmentDefinition, type Question } from "@/lib/assessments/types";
import { Badge, cx } from "../ui";
import { AdminQuestionEditor } from "./AdminQuestionEditor";
import { IconButton, selectClass } from "./BuilderFields";
import { questionTitle, type TabId } from "./builderState";

export interface QuestionRowProps {
  question: Question;
  /** 1-based position within its section, for display. */
  position: number;
  isFirst: boolean;
  isLast: boolean;
  open: boolean;
  onToggle: () => void;
  onChange: (next: Question) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  sections: Array<{ id: string; title: string }>;
  sectionId: string;
  onMoveToSection: (sectionId: string) => void;
  definition: AssessmentDefinition;
  candidates: Question[];
  onGoToTab?: (tab: TabId) => void;
}

export function QuestionRow(props: QuestionRowProps) {
  const { question: q, position, isFirst, isLast, open } = props;
  const uid = useId();
  const title = questionTitle(q);
  const scored = Boolean(q.scoring?.scored);

  return (
    <li id={`question-${q.id}`} className={cx("scroll-mt-40 rounded-xl border bg-surface transition", open ? "border-primary/40 shadow-sm" : "border-primary/15")}>
      <div className="flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${uid}-panel`}
          onClick={props.onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-soft/60"
        >
          {open ? <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" /> : <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
          <span className="w-7 shrink-0 font-mono text-xs text-ink-soft">Q{position}</span>
          <span className="min-w-0">
            <span className={cx("block truncate text-sm font-medium", q.label || q.type === "info" ? "text-ink" : "italic text-ink-soft")}>{title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge>{FIELD_TYPE_LABELS[q.type]}</Badge>
              {q.required && <Badge tone="accent">Required</Badge>}
              {scored && <Badge tone="primary">{q.scoring?.reverse ? "Scored · reversed" : "Scored"}</Badge>}
              {q.visibility && <Badge tone="gold">Conditional</Badge>}
              {q.peer?.enabled && <Badge>Peer</Badge>}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton label={`Move question ${position} up`} disabled={isFirst} onClick={props.onMoveUp}>
            <ArrowUp aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Move question ${position} down`} disabled={isLast} onClick={props.onMoveDown}>
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Duplicate question ${position}`} onClick={props.onDuplicate}>
            <Copy aria-hidden="true" className="h-4 w-4" />
          </IconButton>
          <IconButton label={`Delete question ${position}`} tone="danger" onClick={props.onDelete}>
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {open && (
        <div id={`${uid}-panel`} className="space-y-5 border-t border-primary/10 p-4 sm:p-5">
          {props.sections.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`${uid}-move`} className="font-medium text-primary-dark">
                Section
              </label>
              <select
                id={`${uid}-move`}
                value={props.sectionId}
                onChange={(e) => props.onMoveToSection(e.target.value)}
                className={cx(selectClass, "w-auto max-w-full")}
              >
                {props.sections.map((s, i) => (
                  <option key={s.id} value={s.id}>
                    {i + 1}. {s.title || "Untitled section"}
                  </option>
                ))}
              </select>
              <span className="text-xs text-ink-soft">Moving a question to another section adds it at the end.</span>
            </div>
          )}
          <AdminQuestionEditor question={q} onChange={props.onChange} definition={props.definition} candidates={props.candidates} onGoToTab={props.onGoToTab} />
        </div>
      )}
    </li>
  );
}
