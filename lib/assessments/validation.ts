import { computeVisibility, isAnswered, type Visibility } from "./conditions";
import { isIsoDate, isValidEmail, sanitizeText } from "./text";
import type { AnswerValue, Answers, AssessmentDefinition, Question } from "./types";

// Validates and cleans submitted answers against an assessment definition.
// The same function runs in the browser (instant feedback) and on the server
// (the only place whose verdict counts).

export interface ValidationResult {
  ok: boolean;
  /** Error message per question id (visible questions only). */
  errors: Record<string, string>;
  /** Answers for visible, known questions only — safe to store and score. */
  clean: Answers;
  visibility: Visibility;
}

type Parsed = { kind: "empty" } | { kind: "ok"; value: AnswerValue } | { kind: "invalid"; message: string };

const EMPTY: Parsed = { kind: "empty" };
const invalid = (message: string): Parsed => ({ kind: "invalid", message });
const ok = (value: AnswerValue): Parsed => ({ kind: "ok", value });

export const DEFAULT_LIMITS = { short_text: 200, long_text: 3000, email: 254 } as const;
const HARD_LIMITS = { short_text: 1000, long_text: 10000, email: 254 } as const;

export function ratingBounds(q: Question): { min: number; max: number; step: number } {
  if (q.type === "rating5") return { min: 1, max: 5, step: 1 };
  const min = Number.isFinite(q.min) ? (q.min as number) : q.type === "slider" ? 0 : 1;
  const max = Number.isFinite(q.max) ? (q.max as number) : q.type === "slider" ? 100 : 10;
  const step = q.step && q.step > 0 ? q.step : 1;
  return { min, max, step };
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function onStep(value: number, min: number, step: number): boolean {
  const ratio = (value - min) / step;
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

function textLimit(q: Question, type: "short_text" | "long_text"): number {
  const requested = Number.isFinite(q.maxLength) && (q.maxLength as number) > 0 ? (q.maxLength as number) : DEFAULT_LIMITS[type];
  return Math.min(requested, HARD_LIMITS[type]);
}

export function parseAnswer(q: Question, raw: unknown): Parsed {
  if (raw === undefined || raw === null) return EMPTY;

  switch (q.type) {
    case "info":
      return EMPTY;

    case "short_text":
    case "long_text": {
      if (typeof raw !== "string") return invalid("Please enter text.");
      const limit = textLimit(q, q.type);
      const text = sanitizeText(raw, HARD_LIMITS[q.type], { multiline: q.type === "long_text" });
      if (!text) return EMPTY;
      if (text.length > limit) return invalid(`Please keep this under ${limit} characters.`);
      return ok(text);
    }

    case "email": {
      if (typeof raw !== "string") return invalid("Please enter an email address.");
      const email = raw.trim().toLowerCase();
      if (!email) return EMPTY;
      return isValidEmail(email) ? ok(email) : invalid("Please enter a valid email address.");
    }

    case "number": {
      if (typeof raw === "string" && raw.trim() === "") return EMPTY;
      const n = toNumber(raw);
      if (n === null) return invalid("Please enter a number.");
      if (Number.isFinite(q.min) && n < (q.min as number)) return invalid(`Please enter ${q.min} or more.`);
      if (Number.isFinite(q.max) && n > (q.max as number)) return invalid(`Please enter ${q.max} or less.`);
      return ok(n);
    }

    case "date": {
      if (typeof raw === "string" && raw.trim() === "") return EMPTY;
      return isIsoDate(raw) ? ok(raw) : invalid("Please choose a valid date.");
    }

    case "radio":
    case "dropdown": {
      if (typeof raw === "string" && raw === "") return EMPTY;
      if (typeof raw !== "string") return invalid("Please choose an option.");
      return q.choices?.some((c) => c.id === raw) ? ok(raw) : invalid("Please choose one of the listed options.");
    }

    case "checkbox": {
      if (!Array.isArray(raw)) return invalid("Please choose from the listed options.");
      if (raw.length === 0) return EMPTY;
      const ids = new Set(q.choices?.map((c) => c.id));
      const picked = Array.from(new Set(raw.filter((v): v is string => typeof v === "string")));
      if (picked.length !== new Set(raw).size || picked.some((id) => !ids.has(id))) {
        return invalid("Please choose from the listed options.");
      }
      if (q.minSelections && picked.length < q.minSelections) return invalid(`Choose at least ${q.minSelections}.`);
      if (q.maxSelections && picked.length > q.maxSelections) return invalid(`Choose at most ${q.maxSelections}.`);
      return ok(picked);
    }

    case "rating5":
    case "rating_scale":
    case "slider": {
      if (typeof raw === "string" && raw.trim() === "") return EMPTY;
      const n = toNumber(raw);
      const { min, max, step } = ratingBounds(q);
      if (n === null) return invalid("Please choose a value.");
      if (n < min || n > max) return invalid(`Please choose a value between ${min} and ${max}.`);
      if (q.type !== "slider" && !Number.isInteger(n)) return invalid("Please choose a whole number.");
      if (!onStep(n, min, step)) return invalid("Please choose one of the available values.");
      return ok(n);
    }

    case "yes_no":
    case "peer_feedback": {
      if (raw === true || raw === "yes") return ok("yes");
      if (raw === false || raw === "no") return ok("no");
      if (raw === "") return EMPTY;
      return invalid("Please choose Yes or No.");
    }

    default:
      return invalid("Unsupported question type.");
  }
}

export interface ValidateOptions {
  /** `peer` only asks questions flagged for peers and uses `contextAnswers` for visibility. */
  mode?: "self" | "peer";
  /** The participant's own answers; peers see the questions the participant would have seen. */
  contextAnswers?: Answers;
  /** Restrict reported errors to these question ids (e.g. the current page). */
  onlyQuestionIds?: ReadonlySet<string>;
}

const MAX_ANSWER_KEYS = 600;

export function validateAnswers(
  definition: Pick<AssessmentDefinition, "sections">,
  rawAnswers: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  const mode = options.mode ?? "self";
  const raw: Record<string, unknown> =
    rawAnswers && typeof rawAnswers === "object" && !Array.isArray(rawAnswers)
      ? (rawAnswers as Record<string, unknown>)
      : {};

  const result: ValidationResult = { ok: true, errors: {}, clean: {}, visibility: { sections: {}, questions: {} } };
  if (Object.keys(raw).length > MAX_ANSWER_KEYS) {
    result.ok = false;
    result.errors["_form"] = "Too many answers were submitted.";
    return result;
  }

  const parsed = new Map<string, Parsed>();
  const candidates: Answers = {};
  for (const section of definition.sections) {
    for (const q of section.questions) {
      if (mode === "peer" && !q.peer?.enabled) continue;
      const p = parseAnswer(q, Object.prototype.hasOwnProperty.call(raw, q.id) ? raw[q.id] : undefined);
      parsed.set(q.id, p);
      if (p.kind === "ok") candidates[q.id] = p.value;
    }
  }

  // Visibility is judged on the participant's own answers, even for peers.
  const visibilityBasis = mode === "peer" ? (options.contextAnswers ?? {}) : candidates;
  result.visibility = computeVisibility(definition.sections, visibilityBasis);

  for (const section of definition.sections) {
    for (const q of section.questions) {
      if (!result.visibility.questions[q.id]) continue;
      const p = parsed.get(q.id);
      if (!p || q.type === "info") continue;
      if (p.kind === "invalid") {
        result.errors[q.id] = p.message;
      } else if (p.kind === "empty") {
        if (q.required) result.errors[q.id] = "This question is required.";
      } else {
        result.clean[q.id] = p.value;
      }
    }
  }

  if (options.onlyQuestionIds) {
    for (const id of Object.keys(result.errors)) {
      if (!options.onlyQuestionIds.has(id)) delete result.errors[id];
    }
  }
  result.ok = Object.keys(result.errors).length === 0;
  return result;
}

export { isAnswered };
