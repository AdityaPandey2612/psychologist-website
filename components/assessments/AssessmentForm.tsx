"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Lock, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicForm } from "@/lib/assessments/definition";
import { ApiClientError, apiFetch } from "@/lib/assessments/client/api";
import { clearDraft, draftKey, newIdempotencyKey, readDraft, useDebouncedDraftSave } from "@/lib/assessments/client/useAssessmentDraft";
import { computeVisibility } from "@/lib/assessments/conditions";
import type { SubmitResponse } from "@/lib/assessments/server/submissions";
import { fillTokens, isValidEmail } from "@/lib/assessments/text";
import type { AnswerValue, Answers, AssessmentResult, ResultsConfig } from "@/lib/assessments/types";
import { validateAnswers } from "@/lib/assessments/validation";
import AssessmentProgress from "./AssessmentProgress";
import AssessmentResults from "./AssessmentResults";
import styles from "./assessments.module.css";
import DynamicQuestionRenderer, { questionDomId } from "./DynamicQuestionRenderer";
import { FormHeader, IntroHighlights, NoticeBox, QuestionsHeading } from "./FormBrand";
import { Alert, FieldLabel, Spinner, cx, inputClass } from "./ui";

export interface AssessmentFormProps {
  assessment: { id: string; slug: string; title: string; estimatedMinutes: number };
  /** Published version number the form was rendered from; sent back on submit. */
  version: number;
  form: PublicForm;
  /**
   * Admin preview mode: no name/email/consent step, nothing is stored. When the
   * participant finishes, `score` is called with the answers and, on success,
   * the form shows <AssessmentResults preview /> using `resultsConfig`.
   */
  preview?: {
    score: (answers: Answers) => Promise<{ ok: boolean; errors: Record<string, string>; result: AssessmentResult | null }>;
    resultsConfig: ResultsConfig;
    /** Names of the zone map's four zones, when it has one. */
    zones?: Record<string, { label?: string } | undefined> | null;
  };
}

interface Consent {
  storeResponses: boolean;
  emailResults: boolean;
  shareWithPractice: boolean;
}
interface DetailErrors {
  name?: string;
  email?: string;
  consent?: string;
}

const NO_CONSENT: Consent = { storeResponses: false, emailResults: false, shareWithPractice: false };

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i} className={cx("whitespace-pre-line leading-relaxed", className)}>
            {p}
          </p>
        ))}
    </>
  );
}

export default function AssessmentForm({ assessment, version, form, preview }: AssessmentFormProps) {
  const router = useRouter();
  const storageKey = preview ? null : draftKey(assessment.id, version);

  const [answers, setAnswers] = useState<Answers>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState<Consent>(NO_CONSENT);
  const [website, setWebsite] = useState("");
  const [stepId, setStepId] = useState<string>(preview ? "intro" : "details");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<DetailErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [previewResult, setPreviewResult] = useState<AssessmentResult | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);

  const idempotencyKey = useRef("");
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const submittingRef = useRef(false);
  const previousStep = useRef<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // ---- restore a saved draft (client only)
  useEffect(() => {
    idempotencyKey.current = newIdempotencyKey();
    if (storageKey) {
      const draft = readDraft(storageKey);
      if (draft) {
        setAnswers(draft.answers);
        setName(draft.name);
        setEmail(draft.email);
        setConsent({ ...NO_CONSENT, ...draft.consent });
        setStepId(draft.stepId);
        idempotencyKey.current = draft.idempotencyKey;
        setRestoredAt(draft.savedAt);
      }
    }
    setHydrated(true);
  }, [storageKey]);

  // ---- what is visible right now
  const visibility = useMemo(() => computeVisibility(form.sections, answers), [form.sections, answers]);
  const pages = useMemo(
    () =>
      form.sections
        .filter((s) => visibility.sections[s.id])
        .map((s) => ({ ...s, questions: s.questions.filter((q) => visibility.questions[q.id]) }))
        .filter((s) => s.questions.length > 0),
    [form.sections, visibility],
  );
  const single = form.navigation.layout === "single_page";
  const steps = useMemo(() => [...(preview ? [] : ["details"]), "intro", ...(single ? ["all"] : pages.map((p) => p.id))], [preview, single, pages]);
  const activeStep = steps.includes(stepId) ? stepId : "intro";
  const stepIndex = steps.indexOf(activeStep);
  const isLast = stepIndex === steps.length - 1;
  const orderedQuestionIds = useMemo(() => pages.flatMap((p) => p.questions.map((q) => q.id)), [pages]);
  const inputQuestions = useMemo(() => pages.flatMap((p) => p.questions).filter((q) => q.type !== "info"), [pages]);
  const answeredCount = inputQuestions.filter((q) => answers[q.id] !== undefined).length;
  const questionNumber = useMemo(() => new Map(inputQuestions.map((q, i) => [q.id, i + 1])), [inputQuestions]);
  // Values for {{minutes}}, {{questions}} and {{sections}} in the introduction text. Counts cover the whole form,
  // so a person who skips branches still sees an honest "up to" figure.
  const tokenValues = useMemo(
    () => ({
      minutes: assessment.estimatedMinutes,
      questions: form.sections.flatMap((s) => s.questions).filter((q) => q.type !== "info").length,
      sections: form.sections.length,
    }),
    [assessment.estimatedMinutes, form.sections],
  );
  const questionStep = activeStep !== "details" && activeStep !== "intro";

  const currentPages = activeStep === "all" ? pages : pages.filter((p) => p.id === activeStep);
  const sectionNumber = pages.findIndex((p) => p.id === activeStep) + 1;

  // ---- warn before leaving with unsent answers
  const hasProgress = Object.keys(answers).length > 0 || name.trim() !== "" || email.trim() !== "";
  const dirty = !preview && hasProgress;
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ---- save the draft shortly after changes
  const draft = useMemo(
    () => (hydrated && hasProgress ? { answers, name, email, consent, stepId: activeStep, idempotencyKey: idempotencyKey.current } : null),
    [hydrated, hasProgress, answers, name, email, consent, activeStep],
  );
  useDebouncedDraftSave(storageKey, draft);

  // ---- move focus to the new step's heading
  useEffect(() => {
    // Only when the step really changes (not on first mount).
    const changed = previousStep.current !== null && previousStep.current !== activeStep;
    previousStep.current = activeStep;
    if (!changed) return;
    topRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [activeStep, previewResult]);

  // ---- focus the first question with an error
  useEffect(() => {
    if (!focusRequest) return;
    const wrap = document.getElementById(questionDomId(focusRequest.id));
    if (!wrap) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    wrap.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    wrap.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
  }, [focusRequest]);

  const setAnswer = useCallback((id: string, value: AnswerValue | undefined) => {
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
    setSubmitError(null);
  }, []);

  function showQuestionErrors(errs: Record<string, string>, navigate: boolean) {
    setErrors(errs);
    const first = orderedQuestionIds.find((id) => errs[id]);
    if (!first) return;
    if (navigate && !single) {
      const page = pages.find((p) => p.questions.some((q) => q.id === first));
      if (page) setStepId(page.id);
    }
    setFocusRequest({ id: first, n: Date.now() });
  }

  function validateDetails(): boolean {
    const found: DetailErrors = {};
    if (!name.trim()) found.name = "Please enter your name.";
    if (!isValidEmail(email.trim().toLowerCase())) found.email = "Please enter a valid email address.";
    if (!consent.storeResponses) found.consent = "Please agree so we can use your answers to create your results.";
    setDetailErrors(found);
    if (found.name) document.getElementById("details-name")?.focus();
    else if (found.email) document.getElementById("details-email")?.focus();
    else if (found.consent) document.getElementById("details-consent")?.focus();
    return Object.keys(found).length === 0;
  }

  function goTo(id: string) {
    setErrors({});
    setSubmitError(null);
    setStepId(id);
  }

  function fireStart() {
    if (preview || startedRef.current) return;
    startedRef.current = true;
    // Anonymous counter for completion statistics; failures don't matter.
    apiFetch(`/api/assessments/${assessment.slug}/start`, { method: "POST", json: {}, keepalive: true }).catch(() => undefined);
  }

  async function submit() {
    if (submittingRef.current) return;
    const v = validateAnswers(form, answers);
    if (!v.ok) {
      if (Object.keys(v.errors).every((k) => !orderedQuestionIds.includes(k))) setSubmitError(v.errors._form ?? "Some answers need attention.");
      else showQuestionErrors(v.errors, true);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);

    if (preview) {
      try {
        const res = await preview.score(v.clean);
        if (!res.ok || !res.result) showQuestionErrors(res.errors, true);
        else setPreviewResult(res.result);
      } catch {
        setSubmitError("The preview couldn't be scored. Please try again.");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    if (!validateDetails()) {
      submittingRef.current = false;
      setSubmitting(false);
      setStepId("details");
      return;
    }

    try {
      const res = await apiFetch<SubmitResponse>(`/api/assessments/${assessment.slug}/submit`, {
        method: "POST",
        json: {
          name: name.trim(),
          email: email.trim(),
          answers: v.clean,
          version,
          idempotencyKey: idempotencyKey.current,
          website,
          consent: {
            storeResponses: consent.storeResponses,
            emailResults: form.emailEnabled && consent.emailResults,
            shareWithPractice: form.shareWithPracticeOffered && consent.shareWithPractice,
          },
        },
      });
      submittedRef.current = true;
      if (storageKey) clearDraft(storageKey);
      window.scrollTo(0, 0);
      router.push(`/assessments/results/${res.resultToken}`);
      // Stay in the submitting state until the results page takes over.
    } catch (e) {
      submittingRef.current = false;
      setSubmitting(false);
      if (e instanceof ApiClientError && (e.status === 422 || e.status === 400) && Object.keys(e.fieldErrors).length) {
        const detail: DetailErrors = {};
        const questionErrors: Record<string, string> = {};
        for (const [k, msg] of Object.entries(e.fieldErrors)) {
          if (k === "name") detail.name = msg;
          else if (k === "email") detail.email = msg;
          else if (k === "consentStore") detail.consent = msg;
          else questionErrors[k] = msg;
        }
        if (Object.keys(detail).length) {
          setDetailErrors(detail);
          setStepId("details");
        } else showQuestionErrors(questionErrors, true);
        setSubmitError(e.message);
      } else if (e instanceof ApiClientError) {
        setSubmitError(e.message);
      } else {
        setSubmitError("We couldn't reach the server. Your answers are saved on this device — please check your connection and try again.");
      }
    }
  }

  async function next() {
    if (submitting) return;
    if (activeStep === "details") {
      if (validateDetails()) goTo("intro");
      return;
    }
    const following = steps[stepIndex + 1];
    if (activeStep === "intro") {
      fireStart();
      if (following) goTo(following);
      else await submit();
      return;
    }
    const ids = new Set(currentPages.flatMap((p) => p.questions.map((q) => q.id)));
    const result = validateAnswers(form, answers, { onlyQuestionIds: ids });
    if (!result.ok) {
      showQuestionErrors(result.errors, false);
      return;
    }
    if (following) goTo(following);
    else await submit();
  }

  function back() {
    const previous = steps[stepIndex - 1];
    if (previous) goTo(previous);
  }

  function startOver() {
    if (!window.confirm("Clear everything you've entered and start again?")) return;
    if (storageKey) clearDraft(storageKey);
    setAnswers({});
    setName("");
    setEmail("");
    setConsent(NO_CONSENT);
    setErrors({});
    setDetailErrors({});
    setSubmitError(null);
    setRestoredAt(null);
    setPreviewResult(null);
    idempotencyKey.current = newIdempotencyKey();
    setStepId(preview ? "intro" : "details");
  }

  // ---- preview result
  if (preview && previewResult) {
    return (
      <div ref={topRef} className="scroll-mt-24">
        <AssessmentResults preview title={assessment.title} firstName="Preview" result={previewResult} config={preview.resultsConfig} zones={preview.zones} />
        <button
          type="button"
          className="btn-outline mt-8 min-h-11"
          onClick={() => {
            setAnswers({});
            setPreviewResult(null);
            setErrors({});
            setStepId("intro");
          }}
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Restart preview
        </button>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const showBack = stepIndex > 0 && form.navigation.allowBack;
  const lastLabel = preview ? "Preview my results" : "See my results";

  return (
    <div ref={topRef} className="scroll-mt-24">
      {preview && (
        <Alert tone="warning" className="mb-4">
          <strong>Preview.</strong> Answer as a participant would. Nothing is saved, and no email is sent.
        </Alert>
      )}

      {restoredAt && !preview && (
        <Alert tone="info" className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>We restored the answers you saved on this device on {new Date(restoredAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.</span>
            <button type="button" onClick={startOver} className="min-h-11 text-sm font-semibold underline underline-offset-4">
              Start over
            </button>
          </div>
        </Alert>
      )}

      <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-[0_1px_2px_rgba(18,58,54,0.05)]">
      <FormHeader
        title={assessment.title}
        subtitle={fillTokens(form.intro.subtitle ?? "", tokenValues)}
        badge={form.intro.badge ?? ""}
        compact={questionStep}
      />
      <div className="px-5 pb-8 pt-6 max-sm:pr-14 sm:px-8">
      {form.navigation.showProgress && questionStep && (
        <AssessmentProgress
          className="mb-6"
          current={single ? answeredCount : sectionNumber}
          total={single ? Math.max(inputQuestions.length, 1) : Math.max(pages.length, 1)}
          label={single ? `${answeredCount} of ${inputQuestions.length} answered` : `Section ${sectionNumber} of ${pages.length}`}
          detail={`About ${assessment.estimatedMinutes} min`}
        />
      )}

      <div key={activeStep} className={styles.fadeIn}>
        {/* ----------------------------------------------------------- details */}
        {activeStep === "details" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void next();
            }}
          >
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl text-primary-dark focus:outline-none sm:text-3xl">
              Before we start
            </h2>
            <p className="mt-3 leading-relaxed text-ink-soft">Tell us who these results are for. No account is needed.</p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="details-name">Full name</FieldLabel>
                <input
                  id="details-name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDetailErrors((d) => ({ ...d, name: undefined }));
                  }}
                  aria-invalid={detailErrors.name ? true : undefined}
                  aria-describedby={detailErrors.name ? "details-name-err" : undefined}
                  className={cx(inputClass, "mt-1.5")}
                />
                {detailErrors.name && (
                  <p id="details-name-err" role="alert" className="mt-1.5 text-sm font-medium text-accent-ink">
                    {detailErrors.name}
                  </p>
                )}
              </div>
              <div>
                <FieldLabel htmlFor="details-email">Email address</FieldLabel>
                <input
                  id="details-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setDetailErrors((d) => ({ ...d, email: undefined }));
                  }}
                  aria-invalid={detailErrors.email ? true : undefined}
                  aria-describedby={detailErrors.email ? "details-email-err" : undefined}
                  className={cx(inputClass, "mt-1.5")}
                />
                {detailErrors.email && (
                  <p id="details-email-err" role="alert" className="mt-1.5 text-sm font-medium text-accent-ink">
                    {detailErrors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Bot trap: invisible to people and assistive technology. */}
            <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label>
                Leave this field empty
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </label>
            </div>

            <fieldset className="mt-7 space-y-3">
              <legend className="text-sm font-semibold text-primary-dark">Your choices</legend>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 text-ink">
                <input
                  id="details-consent"
                  type="checkbox"
                  checked={consent.storeResponses}
                  onChange={(e) => {
                    setConsent((c) => ({ ...c, storeResponses: e.target.checked }));
                    setDetailErrors((d) => ({ ...d, consent: undefined }));
                  }}
                  aria-invalid={detailErrors.consent ? true : undefined}
                  aria-describedby={detailErrors.consent ? "details-consent-err" : undefined}
                  className="mt-1 h-5 w-5 shrink-0 accent-primary"
                />
                <span className="leading-snug">
                  I agree that my answers are used to create my results. <span className="text-ink-soft">(Required)</span>
                </span>
              </label>
              {detailErrors.consent && (
                <p id="details-consent-err" role="alert" className="text-sm font-medium text-accent-ink">
                  {detailErrors.consent}
                </p>
              )}
              {form.emailEnabled && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-ink">
                  <input
                    type="checkbox"
                    checked={consent.emailResults}
                    onChange={(e) => setConsent((c) => ({ ...c, emailResults: e.target.checked }))}
                    className="mt-1 h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="leading-snug">
                    Email my results to me. <span className="text-ink-soft">(Optional)</span>
                  </span>
                </label>
              )}
              {form.shareWithPracticeOffered && (
                <label className="flex min-h-11 cursor-pointer items-start gap-3 text-ink">
                  <input
                    type="checkbox"
                    checked={consent.shareWithPractice}
                    onChange={(e) => setConsent((c) => ({ ...c, shareWithPractice: e.target.checked }))}
                    className="mt-1 h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="leading-snug">
                    Share my results with the practice so they can see them. <span className="text-ink-soft">(Optional — they&apos;re never shared otherwise.)</span>
                  </span>
                </label>
              )}
            </fieldset>

            <p className="mt-6 flex gap-2 text-sm leading-relaxed text-ink-soft">
              <Lock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Your results are shown on a private link only you have. This is a self-reflection tool, not a diagnosis. Read our{" "}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-primary-dark underline underline-offset-4">
                  privacy policy
                </a>
                .
              </span>
            </p>

            <div className="mt-8 flex justify-end">
              <button type="submit" className="btn-primary min-h-11">
                Continue
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </form>
        )}

        {/* ------------------------------------------------------------- intro */}
        {activeStep === "intro" && (
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl text-primary-dark focus:outline-none sm:text-3xl">
              {form.intro.heading || "Before you begin"}
            </h2>
            <div className="mt-4 space-y-3 text-ink">
              <Paragraphs text={form.intro.body} />
            </div>
            {(form.intro.highlights?.length ?? 0) > 0 && (
              <div className="mt-6">
                <IntroHighlights items={form.intro.highlights} vars={tokenValues} />
              </div>
            )}
            {form.intro.disclaimer?.trim() && (
              <div className="mt-5">
                <NoticeBox>{fillTokens(form.intro.disclaimer, tokenValues)}</NoticeBox>
              </div>
            )}
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-soft">
              <li className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" className="h-4 w-4" />
                About {assessment.estimatedMinutes} minutes
              </li>
              {!single && pages.length > 0 && (
                <li className="inline-flex items-center gap-1.5">
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                  {pages.length} short section{pages.length === 1 ? "" : "s"}
                </li>
              )}
              {!preview && (
                <li className="inline-flex items-center gap-1.5">
                  <Lock aria-hidden="true" className="h-4 w-4" />
                  Answers are saved on this device as you go
                </li>
              )}
            </ul>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {stepIndex > 0 ? (
                <button type="button" onClick={back} className="btn-outline min-h-11">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <span />
              )}
              <button type="button" onClick={() => void next()} disabled={submitting} className="btn-primary min-h-11 disabled:opacity-60">
                {steps[stepIndex + 1] ? "Begin" : lastLabel}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------- questions */}
        {currentPages.length > 0 && activeStep !== "details" && activeStep !== "intro" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void next();
            }}
          >
            {errorCount > 0 && (
              <Alert tone="error" className="mb-6">
                Please check {errorCount} answer{errorCount === 1 ? "" : "s"} below.
              </Alert>
            )}

            {single && <QuestionsHeading count={inputQuestions.length} />}
            {currentPages.map((page, i) => (
              <section key={page.id} aria-labelledby={`sec-${page.id}-title`} className={i > 0 ? "mt-12 border-t border-primary/15 pt-10" : single ? "mt-6" : undefined}>
                <h2
                  id={`sec-${page.id}-title`}
                  ref={i === 0 ? headingRef : undefined}
                  tabIndex={i === 0 ? -1 : undefined}
                  className="text-2xl text-primary-dark focus:outline-none sm:text-3xl"
                >
                  {page.title}
                </h2>
                {page.description && <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{page.description}</p>}
                <div className="mt-6 space-y-5">
                  {page.questions.map((q) => (
                    <DynamicQuestionRenderer
                      key={q.id}
                      question={q}
                      value={answers[q.id]}
                      error={errors[q.id]}
                      onChange={setAnswer}
                      disabled={submitting}
                      numbering={{ index: questionNumber.get(q.id) ?? 0, total: inputQuestions.length, tag: q.tag ?? (single ? page.title : undefined) }}
                    />
                  ))}
                </div>
              </section>
            ))}

            {submitError && (
              <Alert tone="error" className="mt-6">
                {submitError}
              </Alert>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              {showBack ? (
                <button type="button" onClick={back} disabled={submitting} className="btn-outline min-h-11 disabled:opacity-60">
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  Previous
                </button>
              ) : (
                <span />
              )}
              <button type="submit" disabled={submitting} className="btn-primary min-h-11 disabled:opacity-60">
                {submitting ? <Spinner label="Submitting" /> : null}
                {submitting ? "Working out your results…" : isLast ? lastLabel : "Continue"}
                {!submitting && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {submitting ? "Submitting your answers" : ""}
            </p>
          </form>
        )}

        {activeStep !== "details" && activeStep !== "intro" && currentPages.length === 0 && (
          <Alert tone="info">There are no questions to show. Please go back and continue.</Alert>
        )}
      </div>
      </div>
      </div>

      {(submitError && (activeStep === "details" || activeStep === "intro")) && (
        <Alert tone="error" className="mt-4">
          {submitError}
        </Alert>
      )}

      {!preview && hasProgress && !submitting && (
        <p className="mt-4 text-center text-sm text-ink-soft">
          Answers are saved on this device only.{" "}
          <button type="button" onClick={startOver} className="min-h-11 font-medium text-primary-dark underline underline-offset-4">
            Clear and start over
          </button>
        </p>
      )}
    </div>
  );
}
