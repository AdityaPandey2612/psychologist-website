"use client";

import { Alert } from "@/components/assessments/ui";
import { summarize } from "./ScoringUtils";
import type { EditorProps } from "./types";

/** Strip at the top of the Scoring tab: what is scored, and what needs attention. */
export function ScoringSummary({ definition }: Pick<EditorProps, "definition">) {
  const s = summarize(definition);
  const { scoring } = definition;
  const warnings: string[] = [];

  if (scoring.enabled && s.scored === 0) {
    warnings.push("Scoring is on, but no question is marked as scored. Open a rating, choice or yes/no question in the Questions tab and switch on “Include in score”.");
  }
  if (scoring.method === "skills") {
    for (const skill of s.perSkill) {
      if (s.scored > 0 && skill.count === 0) warnings.push(`No scored question is linked to the skill “${skill.name || "Unnamed skill"}”, so it will not get a score.`);
    }
    if (s.unlinked > 0) warnings.push(`${s.unlinked} scored question${s.unlinked === 1 ? " has" : "s have"} no skill. Overall scores are built from skills, so ${s.unlinked === 1 ? "it" : "they"} won’t count until linked.`);
    if (scoring.skills.length === 0 && scoring.enabled) warnings.push("Add at least one skill, or switch the method to “all scored questions”.");
  }

  return (
    <div className="space-y-3">
      {scoring.enabled && (
        <div className="card p-5">
          <h3 className="text-lg text-primary-dark">What is scored</h3>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-soft">Scored questions</dt>
              <dd className="text-2xl font-semibold text-primary-dark">{s.scored}</dd>
            </div>
            {s.perSkill.map((skill) => (
              <div key={skill.id}>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">{skill.name || "Unnamed skill"}</dt>
                <dd className="text-2xl font-semibold text-primary-dark">{skill.count}</dd>
              </div>
            ))}
            {s.perContext.map((ctx) => (
              <div key={ctx.id}>
                <dt className="text-xs uppercase tracking-wide text-ink-soft">{ctx.name || "Unnamed context"} (context)</dt>
                <dd className="text-2xl font-semibold text-primary-dark">{ctx.count}</dd>
              </div>
            ))}
          </dl>
          {s.unscoredScorable > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              {s.unscoredScorable} rating or choice question{s.unscoredScorable === 1 ? " is" : "s are"} not scored. That is fine for reflection or self-rating questions.
            </p>
          )}
        </div>
      )}
      {warnings.length > 0 && (
        <Alert tone="warning">
          <p className="font-semibold">Needs attention</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
