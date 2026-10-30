import { createHash } from "node:crypto";
import { computeVisibility } from "../conditions";
import { sharingOffered, toPeerForm } from "../definition";
import { computePeerComparison, computeResult } from "../scoring";
import { isValidEmail, maskEmail, randomToken, sanitizeText, TOKEN_PATTERN } from "../text";
import {
  ZONE_KEYS,
  type Answers,
  type AssessmentResult,
  type AssessmentVersionDoc,
  type PeerComparison,
  type PeerResponseDoc,
  type ResultsConfig,
  type SubmissionDoc,
  type SubmissionEmailState,
} from "../types";
import { validateAnswers } from "../validation";
import { COL, versionId } from "./config";
import { deliverAdminNotification, deliverResultEmail, MAX_ATTEMPTS, type DeliveryOptions } from "./emailService";
import { isInlineBackground, runInBackground } from "./background";
import { badRequest, conflict, notFound, unprocessable, ApiError } from "./http";
import { isMailConfigured } from "./mail";
import { renderReportPdf, reportDataFor, reportFileName } from "./pdf/reportPdf";
import { getPublishedBySlug } from "./service";
import type { DocStore } from "./store";

const nowIso = () => new Date().toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const MIN_RESEND_GAP_MS = 30_000;

// ---------------------------------------------------------------- submitting

export interface SubmitResponse {
  resultToken: string;
  duplicate: boolean;
  email: { status: SubmissionEmailState["status"]; message: string };
}

export function describeEmail(state: SubmissionEmailState): string {
  switch (state.status) {
    case "sent":
      return "Your results were accepted for delivery by our mail server. If you don't see them in a few minutes, check your spam folder.";
    case "pending":
      return "Your results are on their way to your email. It usually takes less than a minute; please check your spam folder if it doesn't arrive.";
    case "failed":
      return state.error ? `We couldn't send your results email: ${state.error}` : "We couldn't send your results email.";
    case "not_configured":
      return "Email delivery isn't set up on this site yet, so your results were not emailed. They're shown below.";
    default:
      return "Your results were not emailed.";
  }
}

export async function submitAssessment(
  store: DocStore,
  slug: string,
  body: Record<string, unknown>,
  options: DeliveryOptions = {},
): Promise<SubmitResponse> {
  if (typeof body.website === "string" && body.website.trim() !== "") throw badRequest("Unable to submit this form.");

  const published = await getPublishedBySlug(store, slug);
  if (!published) throw notFound("This self-check isn't available.");

  // The participant answers the version they were shown, as long as it belongs to this assessment.
  let version: AssessmentVersionDoc = published.version;
  if (body.version !== undefined) {
    const requested = Number(body.version);
    if (!Number.isInteger(requested) || requested < 1 || requested > published.version.version) throw badRequest("That self-check version isn't valid.");
    if (requested !== published.version.version) {
      const older = await store.get<AssessmentVersionDoc>(COL.versions, versionId(published.summary.id, requested));
      if (!older) throw badRequest("That self-check version isn't valid.");
      version = older;
    }
  }
  const definition = version.definition;

  const name = sanitizeText(body.name, 100);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const consent = (body.consent ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};
  if (!name) errors.name = "Please enter your name.";
  if (!isValidEmail(email)) errors.email = "Please enter a valid email address.";
  if (consent.storeResponses !== true) errors.consentStore = "Please agree to your answers being used to create your results.";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!KEY_PATTERN.test(idempotencyKey)) throw badRequest("Missing submission key. Please reload the page and try again.");

  const validation = validateAnswers(definition, body.answers);
  if (!validation.ok) Object.assign(errors, validation.errors);
  if (Object.keys(errors).length) throw unprocessable("Please fix the highlighted answers.", { errors });

  // Emailing the results is part of taking the self-check: when the assessment has email on and the server can send,
  // the results always go to the address the person entered (there is no box to untick).
  const wantsEmail = definition.email.enabled && isMailConfigured();
  const shares = consent.shareWithPractice === true && sharingOffered(definition);

  const result: AssessmentResult = computeResult(definition, validation.clean);
  const id = `sub_${hash(`${published.summary.id}:${idempotencyKey}`).slice(0, 28)}`;
  const stamp = options.now?.().toISOString() ?? nowIso();

  const inviteAnswered = definition.sections
    .flatMap((s) => s.questions)
    .some((q) => q.type === "peer_feedback" && validation.clean[q.id] === "yes");

  const submission: SubmissionDoc = {
    id,
    assessmentId: published.summary.id,
    versionId: version.id,
    version: version.version,
    respondent: { name, email },
    consent: { storeResponses: true, emailResults: wantsEmail, shareWithPractice: shares, at: stamp },
    answers: validation.clean,
    result,
    accessToken: randomToken(32),
    peer: {
      enabled: definition.peer.enabled && inviteAnswered,
      token: randomToken(24),
      maxResponses: definition.peer.maxResponses,
      responseCount: 0,
    },
    email: { status: wantsEmail ? "pending" : "not_requested", attempts: 0 },
    createdAt: stamp,
  };

  const created = await store.create(COL.submissions, id, submission);
  if (!created) {
    // Same idempotency key again (double click, retry after a dropped response): hand back the original.
    const existing = await store.get<SubmissionDoc>(COL.submissions, id);
    if (!existing) throw conflict("Please try submitting again.");
    return { resultToken: existing.accessToken, duplicate: true, email: { status: existing.email.status, message: describeEmail(existing.email) } };
  }

  // The emails go out after the response, so the participant sees their results straight away instead of
  // waiting for the mail server. Each email keeps its own delivery record, and the results page shows its state.
  let emailState: SubmissionEmailState = submission.email;
  const sendEmails = async () => {
    const toParticipant = async () => {
      if (!wantsEmail) return;
      try {
        emailState = await deliverResultEmail(store, submission, version, options);
      } catch (error) {
        console.error("[assessments] Email delivery crashed:", error instanceof Error ? error.message : "unknown");
        emailState = { status: "failed", attempts: 0, error: "The email could not be sent." };
      }
    };
    const toPractice = async () => {
      try {
        await deliverAdminNotification(store, submission, version, options);
      } catch (error) {
        console.error("[assessments] Notification failed:", error instanceof Error ? error.message : "unknown");
      }
    };
    await Promise.all([toParticipant(), toPractice()]);
  };
  const sending = runInBackground("assessment emails", sendEmails);
  if (isInlineBackground()) await sending;

  return { resultToken: submission.accessToken, duplicate: false, email: { status: emailState.status, message: describeEmail(emailState) } };
}

// ------------------------------------------------------------------- results

async function findByToken(store: DocStore, token: string): Promise<SubmissionDoc> {
  if (!TOKEN_PATTERN.test(token)) throw notFound("We couldn't find those results.");
  const [submission] = await store.query<SubmissionDoc>(COL.submissions, { where: [["accessToken", token]], limit: 1 });
  if (!submission) throw notFound("We couldn't find those results.");
  return submission;
}

async function versionFor(store: DocStore, submission: SubmissionDoc): Promise<AssessmentVersionDoc> {
  const version = await store.get<AssessmentVersionDoc>(COL.versions, submission.versionId);
  if (!version) throw notFound("We couldn't find those results.");
  return version;
}

async function peerComparisonFor(store: DocStore, submission: SubmissionDoc, version: AssessmentVersionDoc): Promise<PeerComparison | null> {
  if (!version.definition.peer.enabled || submission.peer.responseCount === 0) return null;
  const responses = await store.query<PeerResponseDoc>(COL.peers, { where: [["submissionId", submission.id]] });
  return computePeerComparison(version.definition, submission.answers, responses.map((r) => r.answers));
}

export interface ResultView {
  assessment: { title: string; slug: string };
  participant: { firstName: string };
  completedAt: string;
  result: AssessmentResult;
  results: ResultsConfig;
  /** The names of the four zones, for the zone map (the rest of the scoring set-up is never sent). */
  zones?: Record<string, { label: string }>;
  email: {
    status: SubmissionEmailState["status"];
    message: string;
    enabled: boolean;
    consented: boolean;
    address: string;
    canRetry: boolean;
    error?: string;
  };
  peer: {
    available: boolean;
    enabled: boolean;
    token?: string;
    maxResponses: number;
    responseCount: number;
    comparison: PeerComparison | null;
  };
}

/** The participant's private result page data. Answers themselves are deliberately not returned. */
export async function getResultView(store: DocStore, token: string): Promise<ResultView> {
  const submission = await findByToken(store, token);
  const version = await versionFor(store, submission);
  const def = version.definition;
  const firstName = submission.respondent.name.split(/\s+/)[0] || submission.respondent.name;
  const exhausted = submission.email.attempts >= MAX_ATTEMPTS;
  return {
    assessment: { title: version.meta.title, slug: version.meta.slug },
    participant: { firstName },
    completedAt: submission.createdAt,
    result: submission.result,
    results: def.results,
    ...(def.scoring.zoneMap ? { zones: Object.fromEntries(ZONE_KEYS.map((key) => [key, { label: def.scoring.zoneMap!.zones[key].label }])) } : {}),
    email: {
      status: submission.email.status,
      message: describeEmail(submission.email),
      enabled: def.email.enabled && isMailConfigured(),
      consented: submission.consent.emailResults,
      address: maskEmail(submission.respondent.email),
      canRetry: def.email.enabled && isMailConfigured() && !exhausted && submission.email.status !== "sent",
      error: submission.email.error,
    },
    peer: {
      available: def.peer.enabled,
      enabled: submission.peer.enabled,
      token: submission.peer.enabled ? submission.peer.token : undefined,
      maxResponses: submission.peer.maxResponses,
      responseCount: submission.peer.responseCount,
      comparison: await peerComparisonFor(store, submission, version),
    },
  };
}

/**
 * The participant's PDF report, made on the spot from the stored result and the version of the assessment
 * they answered, so it always matches the page they saw. Refused when that version doesn't offer it.
 */
export async function getReportPdf(store: DocStore, token: string): Promise<{ bytes: Uint8Array; filename: string }> {
  const submission = await findByToken(store, token);
  const version = await versionFor(store, submission);
  if (version.definition.results.reportDownload === false) throw notFound("A PDF report isn't offered for this self-check.");
  const bytes = await renderReportPdf(
    reportDataFor({
      assessmentTitle: version.meta.title,
      participantName: submission.respondent.name,
      completedAt: submission.createdAt,
      result: submission.result,
      definition: version.definition,
      answers: submission.answers,
    }),
  );
  return { bytes, filename: reportFileName(version.meta.title, submission.respondent.name) };
}

export async function setPeerEnabled(store: DocStore, token: string, enabled: boolean): Promise<ResultView["peer"]> {
  const submission = await findByToken(store, token);
  const version = await versionFor(store, submission);
  if (!version.definition.peer.enabled) throw badRequest("Peer feedback isn't available for this assessment.");
  const saved = await store.transact<SubmissionDoc>(COL.submissions, submission.id, (cur) =>
    cur ? { ...cur, peer: { ...cur.peer, enabled } } : undefined,
  );
  if (!saved) throw notFound();
  return {
    available: true,
    enabled: saved.peer.enabled,
    token: saved.peer.enabled ? saved.peer.token : undefined,
    maxResponses: saved.peer.maxResponses,
    responseCount: saved.peer.responseCount,
    comparison: await peerComparisonFor(store, saved, version),
  };
}

export async function resendResultEmail(
  store: DocStore,
  token: string,
  body: { consent?: unknown },
  options: DeliveryOptions = {},
): Promise<{ status: SubmissionEmailState["status"]; message: string }> {
  let submission = await findByToken(store, token);
  const version = await versionFor(store, submission);
  if (!version.definition.email.enabled || !isMailConfigured()) throw badRequest("Emailing results isn't available right now.");
  if (submission.email.status === "sent") return { status: "sent", message: describeEmail(submission.email) };

  if (!submission.consent.emailResults) {
    // Someone who first declined can opt in later by explicitly asking for the email.
    if (body.consent !== true) throw badRequest("Please confirm that you'd like your results emailed to you.");
    const stamp = options.now?.().toISOString() ?? nowIso();
    const updated = await store.transact<SubmissionDoc>(COL.submissions, submission.id, (cur) =>
      cur ? { ...cur, consent: { ...cur.consent, emailResults: true, at: stamp }, email: { ...cur.email, status: "pending" } } : undefined,
    );
    if (!updated) throw notFound();
    submission = updated;
  } else {
    const last = submission.email.lastAttemptAt ? Date.parse(submission.email.lastAttemptAt) : 0;
    const now = (options.now?.() ?? new Date()).getTime();
    if (now - last < MIN_RESEND_GAP_MS) {
      throw new ApiError(429, "rate_limited", "Please wait a few seconds before trying again.", { retryAfter: Math.ceil((MIN_RESEND_GAP_MS - (now - last)) / 1000) });
    }
  }

  const state = await deliverResultEmail(store, submission, version, options);
  return { status: state.status, message: describeEmail(state) };
}

// ---------------------------------------------------------------------- peers

async function findByPeerToken(store: DocStore, token: string): Promise<SubmissionDoc> {
  if (!TOKEN_PATTERN.test(token)) throw notFound("This feedback link isn't valid.");
  const [submission] = await store.query<SubmissionDoc>(COL.submissions, { where: [["peer.token", token]], limit: 1 });
  if (!submission || !submission.peer.enabled) throw notFound("This feedback link isn't active.");
  return submission;
}

export async function getPeerForm(store: DocStore, token: string) {
  const submission = await findByPeerToken(store, token);
  const version = await versionFor(store, submission);
  if (!version.definition.peer.enabled) throw notFound("This feedback link isn't active.");
  const applicable = new Set(
    Object.entries(computeVisibility(version.definition.sections, submission.answers).questions)
      .filter(([, visible]) => visible)
      .map(([id]) => id),
  );
  const form = toPeerForm(version.definition, applicable);
  return {
    assessmentTitle: version.meta.title,
    participantFirstName: submission.respondent.name.split(/\s+/)[0] || submission.respondent.name,
    full: submission.peer.responseCount >= submission.peer.maxResponses,
    ...form,
  };
}

export async function submitPeerResponse(store: DocStore, token: string, body: Record<string, unknown>): Promise<void> {
  const submission = await findByPeerToken(store, token);
  const version = await versionFor(store, submission);
  const def = version.definition;
  if (!def.peer.enabled) throw notFound("This feedback link isn't active.");

  if (body.consent !== true) throw unprocessable("Please confirm you're happy to share your answers.", { errors: { consent: "Please confirm to continue." } });
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
  if (!KEY_PATTERN.test(key)) throw badRequest("Missing submission key. Please reload the page and try again.");
  const relationship = sanitizeText(body.relationship, 40);
  if (relationship && !def.peer.relationships.includes(relationship)) throw badRequest("Please choose one of the listed relationships.");

  const validation = validateAnswers(def, body.answers as Answers, { mode: "peer", contextAnswers: submission.answers });
  if (!validation.ok) throw unprocessable("Please fix the highlighted answers.", { errors: validation.errors });
  if (Object.keys(validation.clean).length === 0) throw unprocessable("Please answer at least one question.", { errors: { _form: "Please answer at least one question." } });

  // Reserve a slot atomically, then store the response; give the slot back if it was a repeat.
  let reserved = false;
  await store.transact<SubmissionDoc>(COL.submissions, submission.id, (cur) => {
    reserved = false;
    if (!cur || !cur.peer.enabled || cur.peer.responseCount >= cur.peer.maxResponses) return undefined;
    reserved = true;
    return { ...cur, peer: { ...cur.peer, responseCount: cur.peer.responseCount + 1 } };
  });
  if (!reserved) throw conflict("This feedback link has already received the maximum number of responses.");

  const id = `peer_${hash(`${submission.id}:${key}`).slice(0, 28)}`;
  const doc: PeerResponseDoc = {
    id,
    submissionId: submission.id,
    assessmentId: submission.assessmentId,
    versionId: submission.versionId,
    relationship,
    answers: validation.clean,
    consentAt: nowIso(),
    createdAt: nowIso(),
  };
  let stored = false;
  try {
    stored = await store.create(COL.peers, id, doc);
  } finally {
    if (!stored) {
      await store.transact<SubmissionDoc>(COL.submissions, submission.id, (cur) =>
        cur ? { ...cur, peer: { ...cur.peer, responseCount: Math.max(0, cur.peer.responseCount - 1) } } : undefined,
      );
    }
  }
}
