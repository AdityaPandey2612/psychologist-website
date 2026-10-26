"use client";

import { useEffect, useState } from "react";
import { adminFetch, ApiClientError } from "@/lib/assessments/client/api";
import type { QuestionStat } from "@/lib/assessments/server/adminData";
import { Alert, Spinner, cx } from "@/components/assessments/ui";

const FIRST = 10;

/**
 * How each scored question went across everyone: the average answer on a 0–100 scale (after reverse scoring),
 * so it is easy to see which statements people agree with least and most. Only totals, never names.
 */
export function SubmissionQuestionStats({ base }: { base: string }) {
  const [data, setData] = useState<{ submissions: number; questions: QuestionStat[] } | null>(null);
  const [error, setError] = useState("");
  const [highestFirst, setHighestFirst] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let live = true;
    adminFetch<{ submissions: number; questions: QuestionStat[] }>(`${base}/question-stats`)
      .then((res) => live && setData(res))
      .catch((e) => live && setError(e instanceof ApiClientError ? e.message : "Couldn't load the question overview."));
    return () => {
      live = false;
    };
  }, [base]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data)
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Spinner label="Loading the question overview" className="h-4 w-4" /> Loading the question overview…
      </p>
    );
  if (data.questions.length === 0) return null;

  const ordered = highestFirst ? [...data.questions].reverse() : data.questions;
  const shown = showAll ? ordered : ordered.slice(0, FIRST);

  return (
    <details className="card group p-5 sm:p-6" open>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display text-xl text-primary-dark">How each question went</span>
          <span className="block text-sm text-ink-soft">
            Average answer for each scored question, from {data.submissions} response{data.submissions === 1 ? "" : "s"}. A low average means people agreed with it least.
          </span>
        </span>
        <span className="text-sm font-semibold text-primary group-open:hidden">Show</span>
        <span className="hidden text-sm font-semibold text-primary group-open:inline">Hide</span>
      </summary>

      <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Order of the questions">
        {[
          { id: false, label: "Lowest first" },
          { id: true, label: "Highest first" },
        ].map((option) => (
          <button
            key={String(option.id)}
            type="button"
            aria-pressed={highestFirst === option.id}
            onClick={() => setHighestFirst(option.id)}
            className={cx(
              "min-h-9 rounded-full border px-4 text-sm font-medium transition",
              highestFirst === option.id ? "border-primary bg-primary text-surface" : "border-primary/25 bg-surface text-primary-dark hover:bg-surface-soft",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <caption className="sr-only">Average answer for each scored question</caption>
          <thead className="border-b border-primary/10 text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">Question</th>
              <th scope="col" className="px-3 py-2 font-semibold">Skill</th>
              <th scope="col" className="px-3 py-2 font-semibold">Average</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Answered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/10">
            {shown.map((q) => (
              <tr key={q.questionId}>
                <td className="px-3 py-2.5 text-primary-dark">{q.question}</td>
                <td className="px-3 py-2.5 text-ink-soft">{q.skill ?? "—"}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-surface-soft">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${q.average}%` }} />
                    </span>
                    <strong className="w-8 font-semibold text-primary-dark">{q.average}</strong>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-ink-soft">{q.answered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.questions.length > FIRST && (
        <button type="button" className="btn-outline mt-4 px-4 py-2 text-sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show only ${FIRST}` : `Show all ${data.questions.length} questions`}
        </button>
      )}
    </details>
  );
}
