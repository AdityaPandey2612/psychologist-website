"use client";

import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { newQuestion } from "@/lib/assessments/definition";
import { newId } from "@/lib/assessments/text";
import type { FieldType, Question, Section } from "@/lib/assessments/types";
import { Alert, Badge, cx, inputClass } from "../ui";
import { IconButton, textareaClass } from "./BuilderFields";
import {
  deleteQuestionFrom,
  deleteSectionFrom,
  duplicateQuestion,
  duplicateSection,
  earlierQuestions,
  insertAt,
  moveItem,
  questionTitle,
  referencesTo,
  removeAt,
  replaceAt,
  type TabId,
} from "./builderState";
import { ConditionEditor } from "./ConditionEditor";
import { QuestionRow } from "./QuestionRow";
import { QuestionTypePicker } from "./QuestionTypePicker";
import type { EditorProps } from "./types";

export interface QuestionsEditorProps extends EditorProps {
  /** Set by the shell to open and scroll to a question (e.g. from the validation panel). */
  focus?: { sectionId?: string; questionId?: string; nonce: number } | null;
  onGoToTab?: (tab: TabId) => void;
}

export function QuestionsEditor({ definition, onChange, focus, onGoToTab }: QuestionsEditorProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focus) return;
    if (focus.questionId) setOpen((s) => new Set(s).add(focus.questionId as string));
    if (focus.sectionId)
      setCollapsed((s) => {
        const next = new Set(s);
        next.delete(focus.sectionId as string);
        return next;
      });
    const target = focus.questionId ? `question-${focus.questionId}` : focus.sectionId ? `section-${focus.sectionId}` : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [focus]);

  const { sections } = definition;
  const setSections = (next: Section[]) => onChange({ ...definition, sections: next });
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const addSection = () => {
    const section: Section = { id: newId("s"), title: `Section ${sections.length + 1}`, questions: [] };
    setSections([...sections, section]);
  };

  const removeSection = (index: number) => {
    const section = sections[index];
    const ids = new Set(section.questions.map((q) => q.id));
    // Only rules outside this section matter; the section's own rules disappear with it.
    const refs = referencesTo({ ...definition, sections: definition.sections.filter((s) => s.id !== section.id) }, ids);
    const parts = [`Delete “${section.title || `Section ${index + 1}`}”${section.questions.length ? ` and its ${section.questions.length} question${section.questions.length === 1 ? "" : "s"}` : ""}?`];
    if (refs.length) parts.push(`Rules that depend on these questions will be removed from: ${refs.join("; ")}.`);
    if (!window.confirm(parts.join("\n\n"))) return;
    onChange(deleteSectionFrom(definition, section.id));
  };

  const addQuestion = (sectionIndex: number, type: FieldType) => {
    const q: Question = newQuestion(type);
    setOpen((s) => new Set(s).add(q.id));
    const section = sections[sectionIndex];
    setSections(replaceAt(sections, sectionIndex, { ...section, questions: [...section.questions, q] }));
    requestAnimationFrame(() => document.getElementById(`question-${q.id}`)?.scrollIntoView({ block: "center" }));
  };

  const updateQuestion = (si: number, qi: number, q: Question) => {
    const section = sections[si];
    setSections(replaceAt(sections, si, { ...section, questions: replaceAt(section.questions, qi, q) }));
  };

  const removeQuestion = (si: number, qi: number) => {
    const q = sections[si].questions[qi];
    const refs = referencesTo(definition, new Set([q.id]));
    const message = refs.length
      ? `Delete “${questionTitle(q)}”?\n\nIt is used by ${refs.join("; ")}. Those rules will be removed.`
      : `Delete “${questionTitle(q)}”?`;
    if (!window.confirm(message)) return;
    onChange(deleteQuestionFrom(definition, q.id));
  };

  const moveQuestionToSection = (si: number, qi: number, targetId: string) => {
    const target = sections.findIndex((s) => s.id === targetId);
    if (target < 0 || target === si) return;
    const q = sections[si].questions[qi];
    const next = sections.map((s, i) => {
      if (i === si) return { ...s, questions: removeAt(s.questions, qi) };
      if (i === target) return { ...s, questions: [...s.questions, q] };
      return s;
    });
    setSections(next);
  };

  if (sections.length === 0) {
    return (
      <div className="space-y-4">
        <Alert tone="warning">This assessment has no sections yet. Add one to start adding questions.</Alert>
        <button type="button" onClick={addSection} className="btn-primary px-5 py-2.5 text-sm">
          <Plus aria-hidden="true" className="h-4 w-4" /> Add section
        </button>
      </div>
    );
  }

  const questionCount = sections.reduce((n, s) => n + s.questions.filter((q) => q.type !== "info").length, 0);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">
        {sections.length} section{sections.length === 1 ? "" : "s"} · {questionCount} question{questionCount === 1 ? "" : "s"}. Each section is one page for the participant. Use the arrows to reorder.
      </p>

      {sections.map((section, si) => {
        const isCollapsed = collapsed.has(section.id);
        const sectionCandidates = earlierQuestions(definition, si);
        return (
          <section key={section.id} id={`section-${section.id}`} aria-label={`Section ${si + 1}`} className="card scroll-mt-40 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-primary/10 bg-surface-soft/50 p-3 sm:flex-nowrap">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} section ${si + 1}`}
                onClick={() => setCollapsed((s) => toggle(s, section.id))}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-surface"
              >
                {isCollapsed ? <ChevronRight aria-hidden="true" className="h-5 w-5" /> : <ChevronDown aria-hidden="true" className="h-5 w-5" />}
              </button>
              <span className="shrink-0 font-mono text-xs uppercase tracking-wider text-ink-soft">Section {si + 1}</span>
              <input
                aria-label={`Title of section ${si + 1}`}
                value={section.title}
                maxLength={200}
                placeholder="Section title"
                onChange={(e) => setSections(replaceAt(sections, si, { ...section, title: e.target.value }))}
                className={cx(inputClass, "min-w-0 flex-1 py-2 font-display text-lg")}
              />
              {section.visibility && <Badge tone="gold">Conditional</Badge>}
              <div className="flex shrink-0 items-center gap-1.5">
                <IconButton label={`Move section ${si + 1} up`} disabled={si === 0} onClick={() => setSections(moveItem(sections, si, si - 1))}>
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Move section ${si + 1} down`} disabled={si === sections.length - 1} onClick={() => setSections(moveItem(sections, si, si + 1))}>
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Duplicate section ${si + 1}`} onClick={() => setSections(insertAt(sections, si + 1, duplicateSection(section)))}>
                  <Copy aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <IconButton label={`Delete section ${si + 1}`} tone="danger" disabled={sections.length === 1} onClick={() => removeSection(si)}>
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            {!isCollapsed && (
              <div className="space-y-5 p-4 sm:p-5">
                <div>
                  <label htmlFor={`sec-desc-${section.id}`} className="block text-sm font-semibold text-primary-dark">
                    Section description <span className="font-normal text-ink-soft">(optional)</span>
                  </label>
                  <textarea
                    id={`sec-desc-${section.id}`}
                    value={section.description ?? ""}
                    maxLength={1000}
                    rows={2}
                    onChange={(e) => setSections(replaceAt(sections, si, { ...section, description: e.target.value || undefined }))}
                    className={cx(textareaClass, "mt-1.5 min-h-[4rem]")}
                  />
                </div>

                <details className="group rounded-xl border border-primary/15" open={Boolean(section.visibility)}>
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-primary-dark marker:hidden">
                    Section visibility <span className="font-normal text-ink-soft">— skip this whole section based on earlier answers</span>
                  </summary>
                  <div className="px-4 pb-4">
                    <ConditionEditor
                      value={section.visibility}
                      onChange={(visibility) => setSections(replaceAt(sections, si, { ...section, visibility }))}
                      candidates={sectionCandidates}
                      label="section"
                    />
                  </div>
                </details>

                {section.questions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-primary/25 p-5 text-center text-sm text-ink-soft">No questions in this section yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {section.questions.map((q, qi) => (
                      <QuestionRow
                        key={q.id}
                        question={q}
                        position={qi + 1}
                        isFirst={qi === 0}
                        isLast={qi === section.questions.length - 1}
                        open={open.has(q.id)}
                        onToggle={() => setOpen((s) => toggle(s, q.id))}
                        onChange={(next) => updateQuestion(si, qi, next)}
                        onMoveUp={() => setSections(replaceAt(sections, si, { ...section, questions: moveItem(section.questions, qi, qi - 1) }))}
                        onMoveDown={() => setSections(replaceAt(sections, si, { ...section, questions: moveItem(section.questions, qi, qi + 1) }))}
                        onDuplicate={() => {
                          const copy = duplicateQuestion(q);
                          setOpen((s) => new Set(s).add(copy.id));
                          setSections(replaceAt(sections, si, { ...section, questions: insertAt(section.questions, qi + 1, copy) }));
                        }}
                        onDelete={() => removeQuestion(si, qi)}
                        sections={sections.map((s) => ({ id: s.id, title: s.title }))}
                        sectionId={section.id}
                        onMoveToSection={(target) => moveQuestionToSection(si, qi, target)}
                        definition={definition}
                        candidates={earlierQuestions(definition, si, qi)}
                        onGoToTab={onGoToTab}
                      />
                    ))}
                  </ol>
                )}

                <QuestionTypePicker onPick={(type) => addQuestion(si, type)} />
              </div>
            )}
          </section>
        );
      })}

      <button type="button" onClick={addSection} className="btn-outline px-5 py-2.5 text-sm">
        <Plus aria-hidden="true" className="h-4 w-4" /> Add section
      </button>
    </div>
  );
}
