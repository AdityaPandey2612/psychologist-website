import type { ResultsConfig } from "./types";

// Small pieces of result-page wording shared by the page, the email and the PDF report.

/**
 * The result headline with `{name}` (first name) and `{zone}` filled in, in pieces so the zone can be set
 * apart (in italics on the page, in a different colour in the PDF). A headline that needs a zone the
 * result doesn't have falls back to "Your results".
 */
export function headlineParts(headline: string, firstName: string | undefined, zoneLabel: string | undefined): Array<{ text: string; emphasis?: boolean }> {
  const text = (headline || "Your results").replaceAll("{name}", firstName ?? "").replace(/\s+/g, " ").trim();
  if (!text.includes("{zone}")) return [{ text: text || "Your results" }];
  if (!zoneLabel) return [{ text: "Your results" }];
  return text
    .split("{zone}")
    .flatMap((piece, index, all) => [...(piece ? [{ text: piece }] : []), ...(index < all.length - 1 ? [{ text: zoneLabel, emphasis: true }] : [])]);
}

/** The small label above the headline: the admin's own wording, or the assessment's title. */
export const resultEyebrow = (results: Pick<ResultsConfig, "eyebrow">, title: string): string => results.eyebrow?.trim() || title;

/** The word before a numbered plan step ("Day 1"); "Step" when the admin set none. */
export const planStepPrefix = (labelPrefix: string | undefined): string => labelPrefix?.trim() || "Step";
