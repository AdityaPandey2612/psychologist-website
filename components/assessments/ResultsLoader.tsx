"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ApiClientError, apiFetch } from "@/lib/assessments/client/api";
import type { ResultView } from "@/lib/assessments/server/submissions";
import AssessmentResults from "./AssessmentResults";
import { ResultsSkeleton } from "./AssessmentSkeletons";
import { Alert } from "./ui";

type State = { kind: "loading" } | { kind: "ready"; view: ResultView } | { kind: "missing" } | { kind: "error"; message: string };

/** Fetches the participant's private result (never cached) and renders it. */
export default function ResultsLoader({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Arriving from a long form leaves the old scroll position behind; always start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    apiFetch<ResultView>(`/api/assessments/results/${token}`, { signal: controller.signal, cache: "no-store" })
      .then((view) => setState({ kind: "ready", view }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiClientError && e.status === 404) setState({ kind: "missing" });
        else setState({ kind: "error", message: e instanceof ApiClientError ? e.message : "We couldn't reach the server. Please check your connection." });
      });
    return () => controller.abort();
  }, [token, attempt]);

  const back = (
    <Link href="/assessments" className="mb-6 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-dark hover:underline">
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Back to self-checks
    </Link>
  );

  if (state.kind === "loading") return <ResultsSkeleton />;

  if (state.kind === "missing") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-3xl text-primary-dark">We couldn&apos;t find those results</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">This link isn&apos;t valid or has expired. Check that you copied the whole link, or take the self-check again.</p>
        <Link href="/assessments" className="btn-primary mt-6 min-h-11">
          Browse self-checks
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-xl">
        <Alert tone="error">{state.message}</Alert>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-outline mt-4 min-h-11">
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  const { view } = state;
  return (
    <div>
      {back}
      <AssessmentResults
        title={view.assessment.title}
        firstName={view.participant.firstName}
        completedAt={view.completedAt}
        result={view.result}
        config={view.results}
        zones={view.zones}
        email={view.email}
        peer={view.peer}
        token={token}
      />
      <div className="mt-10">{back}</div>
    </div>
  );
}
