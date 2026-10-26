"use client";

import { CheckCircle2, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { PeerForm } from "@/lib/assessments/definition";
import { ApiClientError, apiFetch } from "@/lib/assessments/client/api";
import { newIdempotencyKey } from "@/lib/assessments/client/useAssessmentDraft";
import type { AnswerValue, Answers } from "@/lib/assessments/types";
import { validateAnswers } from "@/lib/assessments/validation";
import { FormSkeleton } from "./AssessmentSkeletons";
import styles from "./assessments.module.css";
import DynamicQuestionRenderer, { questionDomId } from "./DynamicQuestionRenderer";
import { BrandLogo, FormHeader } from "./FormBrand";
import { Alert, FieldLabel, Spinner, cx, inputClass } from "./ui";

type PeerFormData = PeerForm & { assessmentTitle: string; participantFirstName: string; full: boolean };
type State = { kind: "loading" } | { kind: "ready"; data: PeerFormData } | { kind: "inactive" } | { kind: "error"; message: string } | { kind: "done" };

/** The page an invited person sees: consent, a few questions, then a thank-you. */
export default function PeerFeedbackForm({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [relationship, setRelationship] = useState("");
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idempotencyKey = useRef("");
  const submittingRef = useRef(false);

  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ kind: "loading" });
    apiFetch<PeerFormData>(`/api/assessments/peer/${token}`, { signal: controller.signal, cache: "no-store" })
      .then((data) => setState({ kind: "ready", data }))
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ApiClientError && e.status === 404) setState({ kind: "inactive" });
        else setState({ kind: "error", message: e instanceof ApiClientError ? e.message : "We couldn't reach the server. Please check your connection." });
      });
    return () => controller.abort();
  }, [token, attempt]);

  const data = state.kind === "ready" ? state.data : null;
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const orderedIds = useMemo(() => sections.flatMap((s) => s.questions.map((q) => q.id)), [sections]);

  function setAnswer(id: string, value: AnswerValue | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    setErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function focusQuestion(id: string) {
    const wrap = document.getElementById(questionDomId(id, "p"));
    wrap?.scrollIntoView({ block: "center" });
    wrap?.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!data || submittingRef.current) return;
    setSubmitError(null);

    // Questions asked of peers carry no visibility rules, so everything listed is shown.
    const v = validateAnswers({ sections }, answers);
    if (!v.ok) {
      setErrors(v.errors);
      const first = orderedIds.find((id) => v.errors[id]);
      if (first) window.requestAnimationFrame(() => focusQuestion(first));
      return;
    }
    if (Object.keys(v.clean).length === 0) {
      setSubmitError("Please answer at least one question.");
      return;
    }
    if (!agree) {
      setAgreeError("Please confirm that you're happy to share your answers.");
      document.getElementById("peer-consent")?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await apiFetch(`/api/assessments/peer/${token}`, {
        method: "POST",
        json: { consent: true, relationship, answers: v.clean, idempotencyKey: idempotencyKey.current },
      });
      setState({ kind: "done" });
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 404) setState({ kind: "inactive" });
      else if (e instanceof ApiClientError && e.status === 422 && Object.keys(e.fieldErrors).length) {
        const { consent: consentError, ...rest } = e.fieldErrors;
        if (consentError) setAgreeError(consentError);
        setErrors(rest);
        setSubmitError(e.message);
      } else setSubmitError(e instanceof ApiClientError ? e.message : "We couldn't reach the server. Please try again.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (state.kind === "loading") return <FormSkeleton />;

  if (state.kind === "inactive") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <BrandLogo className="mx-auto mb-5 w-44" />
        <h1 className="text-3xl text-primary-dark">This link isn&apos;t active</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">The person who shared it may have switched it off, or the link may be incomplete. Please ask them for a new link.</p>
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

  if (state.kind === "done") {
    return (
      <div className={cx("card mx-auto max-w-xl p-8 text-center", styles.fadeIn)}>
        <BrandLogo className="mx-auto mb-5 w-44" />
        <CheckCircle2 aria-hidden="true" className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-3xl text-primary-dark">Thank you</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">Your answers were sent. They&apos;re anonymous and will be shown only as part of an average. You can close this page now.</p>
        <Link href="/assessments" className="btn-outline mt-6 min-h-11">
          Explore the self-checks
        </Link>
      </div>
    );
  }

  const form = state.data;
  if (form.full) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <BrandLogo className="mx-auto mb-5 w-44" />
        <h1 className="text-3xl text-primary-dark">This link is full</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{form.participantFirstName} has already received the maximum number of responses. Thank you for being willing to help.</p>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const peerQuestions = form.sections.flatMap((section) => section.questions).filter((q) => q.type !== "info");
  const peerNumber = new Map(peerQuestions.map((q, i) => [q.id, i + 1]));

  return (
    <div className={cx("mx-auto max-w-3xl overflow-hidden rounded-2xl border border-primary/15 bg-surface", styles.fadeIn)}>
      <FormHeader title={form.assessmentTitle} subtitle="A short note of feedback" badge="Anonymous & Confidential" />
      <div className="px-5 pb-8 pt-6 max-sm:pr-14 sm:px-8">
      <h1 className="text-3xl text-primary-dark sm:text-4xl">{form.participantFirstName} would value your honest view</h1>
      <div className="mt-4 space-y-3 text-lg text-ink-soft">
        {form.intro
          .split(/\n{2,}/)
          .filter((p) => p.trim())
          .map((p, i) => (
            <p key={i} className="whitespace-pre-line leading-relaxed">
              {p}
            </p>
          ))}
      </div>

      <div className="mt-6 flex gap-3 rounded-2xl border border-primary/15 bg-surface-soft p-5 text-sm leading-relaxed text-ink">
        <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          You don&apos;t need an account and you won&apos;t be asked for your name or email. {form.participantFirstName} will never see your individual answers — only an average of everyone who responds.
          Please answer from your own experience of talking with them.
        </p>
      </div>

      <form noValidate onSubmit={submit} className="mt-8 space-y-8">
        {errorCount > 0 && <Alert tone="error">Please check {errorCount} answer{errorCount === 1 ? "" : "s"} below.</Alert>}

        <div className="rounded-lg border border-primary/15 bg-surface-soft/40 p-4 sm:p-5">
          <FieldLabel htmlFor="peer-relationship" optional>
            How do you know {form.participantFirstName}?
          </FieldLabel>
          <select id="peer-relationship" value={relationship} onChange={(e) => setRelationship(e.target.value)} className={cx(inputClass, "mt-1.5 sm:max-w-xs")}>
            <option value="">Prefer not to say</option>
            {form.relationships.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {form.sections.map((section) => (
          <section key={section.id} aria-labelledby={`peer-sec-${section.id}`}>
            <h2 id={`peer-sec-${section.id}`} className="text-2xl text-primary-dark">
              {section.title}
            </h2>
            {section.description && <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{section.description}</p>}
            <div className="mt-5 space-y-5">
              {section.questions.map((q) => (
                <DynamicQuestionRenderer
                  key={q.id}
                  question={q}
                  idPrefix="p"
                  value={answers[q.id]}
                  error={errors[q.id]}
                  onChange={setAnswer}
                  disabled={submitting}
                  numbering={{ index: peerNumber.get(q.id) ?? 0, total: peerQuestions.length, tag: q.tag }}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-lg border border-primary/15 bg-surface-soft/40 p-4 sm:p-5">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-ink">
            <input
              id="peer-consent"
              type="checkbox"
              checked={agree}
              onChange={(e) => {
                setAgree(e.target.checked);
                setAgreeError(null);
              }}
              aria-invalid={agreeError ? true : undefined}
              aria-describedby={agreeError ? "peer-consent-err" : undefined}
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
            />
            <span className="leading-snug">I&apos;m happy for my anonymous answers to be shared with {form.participantFirstName} as part of an average.</span>
          </label>
          {agreeError && (
            <p id="peer-consent-err" role="alert" className="mt-2 text-sm font-medium text-accent-ink">
              {agreeError}
            </p>
          )}

          {submitError && (
            <Alert tone="error" className="mt-5">
              {submitError}
            </Alert>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-6 min-h-11 w-full disabled:opacity-60 sm:w-auto">
            {submitting && <Spinner label="Sending" />}
            {submitting ? "Sending…" : "Send my answers"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
