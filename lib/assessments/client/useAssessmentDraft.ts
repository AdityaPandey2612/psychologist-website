"use client";

import { useEffect } from "react";
import type { Answers } from "../types";

// Draft recovery for the assessment form. Everything lives in localStorage on
// the participant's own device and every access is wrapped in try/catch, so the
// form works (without recovery) when storage is blocked or full.

export interface AssessmentDraft {
  answers: Answers;
  name: string;
  email: string;
  consent: { storeResponses: boolean; emailResults: boolean; shareWithPractice: boolean };
  stepId: string;
  idempotencyKey: string;
  savedAt: number;
}

const PREFIX = "assessment-draft:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const draftKey = (assessmentId: string, version: number) => `${PREFIX}${assessmentId}:v${version}`;

function isDraft(value: unknown): value is AssessmentDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<AssessmentDraft>;
  return (
    typeof d.name === "string" &&
    typeof d.email === "string" &&
    typeof d.stepId === "string" &&
    typeof d.idempotencyKey === "string" &&
    typeof d.savedAt === "number" &&
    !!d.answers &&
    typeof d.answers === "object" &&
    !!d.consent &&
    typeof d.consent === "object"
  );
}

export function readDraft(key: string): AssessmentDraft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isDraft(parsed) || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: AssessmentDraft): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // Storage unavailable or full: recovery just won't be offered.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** 24-character URL-safe random key that identifies one submission attempt. */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Saves `draft` shortly after it stops changing. Pass null to pause saving. */
export function useDebouncedDraftSave(key: string | null, draft: Omit<AssessmentDraft, "savedAt"> | null, delay = 400): void {
  useEffect(() => {
    if (!key || !draft) return;
    const timer = window.setTimeout(() => writeDraft(key, { ...draft, savedAt: Date.now() }), delay);
    return () => window.clearTimeout(timer);
  }, [key, draft, delay]);
}
