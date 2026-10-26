import type { Answers, AssessmentDefinition, Question } from "@/lib/assessments/types";

export type SampleProfile = "strong" | "mixed" | "low";

/** Fills every question with a plausible answer; hidden questions are dropped by validation. */
export function sampleAnswers(definition: AssessmentDefinition, profile: SampleProfile): Answers {
  const answers: Answers = {};
  const reverseAware = (q: Question, wantHigh: boolean) => (q.scoring?.reverse ? !wantHigh : wantHigh);
  const wantHigh = profile === "strong";

  for (const q of definition.sections.flatMap((s) => s.questions)) {
    switch (q.type) {
      case "short_text":
        answers[q.id] = "Sample answer";
        break;
      case "long_text":
        answers[q.id] = "Sample reflection written for the preview.";
        break;
      case "email":
        answers[q.id] = "sample@example.com";
        break;
      case "number": {
        const lo = q.min ?? 0;
        const hi = q.max ?? lo + 10;
        answers[q.id] = profile === "mixed" ? Math.round((lo + hi) / 2) : reverseAware(q, wantHigh) ? hi : lo;
        break;
      }
      case "date":
        answers[q.id] = "2026-01-15";
        break;
      case "yes_no":
      case "peer_feedback":
        answers[q.id] = q.scoring?.scored && profile !== "mixed" ? (reverseAware(q, wantHigh) ? "yes" : "no") : "yes";
        break;
      case "rating5":
      case "rating_scale":
      case "slider": {
        const lo = q.type === "rating5" ? 1 : (q.min ?? (q.type === "slider" ? 0 : 1));
        const hi = q.type === "rating5" ? 5 : (q.max ?? (q.type === "slider" ? 100 : 10));
        const step = q.type === "rating5" ? 1 : q.step && q.step > 0 ? q.step : 1;
        const snap = (v: number) => Math.min(hi, Math.max(lo, lo + Math.round((v - lo) / step) * step));
        answers[q.id] = profile === "mixed" ? snap((lo + hi) / 2) : reverseAware(q, wantHigh) ? hi : lo;
        break;
      }
      case "radio":
      case "dropdown":
      case "checkbox": {
        const choices = q.choices ?? [];
        if (!choices.length) break;
        const points = choices.map((c, i) => c.points ?? i);
        const order = choices.map((_, i) => i).sort((a, b) => points[a] - points[b]);
        const pick = profile === "mixed" || !q.scoring?.scored ? order[Math.floor((order.length - 1) / 2)] : reverseAware(q, wantHigh) ? order[order.length - 1] : order[0];
        const chosen = choices[pick] ?? choices[0];
        answers[q.id] = q.type === "checkbox" ? choices.slice(0, Math.max(1, q.minSelections ?? 1)).map((c) => c.id) : chosen.id;
        break;
      }
      default:
        break;
    }
  }
  return answers;
}

