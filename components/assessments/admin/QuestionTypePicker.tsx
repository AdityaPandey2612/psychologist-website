"use client";

import {
  AlignLeft,
  Calendar,
  CheckSquare,
  CircleDot,
  Hash,
  Info,
  Mail,
  Plus,
  SlidersHorizontal,
  Star,
  ThumbsUp,
  Type,
  Users,
  ChevronDown as DropdownIcon,
  ListOrdered,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type FieldType } from "@/lib/assessments/types";

const TYPE_INFO: Record<FieldType, { icon: LucideIcon; hint: string }> = {
  short_text: { icon: Type, hint: "A single line of text" },
  long_text: { icon: AlignLeft, hint: "A paragraph for reflections" },
  email: { icon: Mail, hint: "Validated email address" },
  number: { icon: Hash, hint: "A number, optionally with limits" },
  date: { icon: Calendar, hint: "A calendar date" },
  radio: { icon: CircleDot, hint: "Pick exactly one option" },
  dropdown: { icon: DropdownIcon, hint: "Pick one from a list" },
  checkbox: { icon: CheckSquare, hint: "Pick any number of options" },
  rating5: { icon: Star, hint: "Fixed 1–5 scale, e.g. Never to Always" },
  rating_scale: { icon: ListOrdered, hint: "Your own range, e.g. 0–10" },
  slider: { icon: SlidersHorizontal, hint: "Drag along a range" },
  yes_no: { icon: ThumbsUp, hint: "Two-way choice" },
  peer_feedback: { icon: Users, hint: "Offer to invite someone for feedback" },
  info: { icon: Info, hint: "Explanatory text, no answer" },
};

/** "Add question" button that reveals every field type as a labelled choice. */
export function QuestionTypePicker({ onPick, label = "Add question" }: { onPick: (type: FieldType) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="btn-outline px-4 py-2 text-sm"
      >
        {open ? <X aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
        {open ? "Close" : label}
      </button>
      {open && (
        <div id={panelId} role="group" aria-label="Choose a question type" className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FIELD_TYPES.map((type) => {
            const { icon: Icon, hint } = TYPE_INFO[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  onPick(type);
                  setOpen(false);
                }}
                className="flex items-start gap-3 rounded-xl border border-primary/15 bg-surface p-3 text-left transition hover:border-primary/40 hover:bg-surface-soft"
              >
                <span className="icon-tile tone-teal !h-9 !w-9">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-primary-dark">{FIELD_TYPE_LABELS[type]}</span>
                  <span className="block text-xs text-ink-soft">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
