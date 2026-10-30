import type { AssessmentVersionDoc, EmailRecordDoc, SubmissionDoc, SubmissionEmailState } from "../types";
import { COL, publicBaseUrl, SITE_NAME } from "./config";
import { renderAdminNotification, renderResultEmail } from "./emailTemplates";
import { getMailProvider, type MailMessage, type SendOutcome } from "./mail";
import { questionCounts } from "../counts";
import { OWNER_EMAIL } from "./mailAccount";
import { renderReportPdf, reportDataFor, reportFileName } from "./pdf/reportPdf";
import type { DocStore } from "./store";

// Sends result emails and keeps an honest delivery record.
//  * One record per submission and kind (`<submissionId>_result`), created
//    atomically, so a double click or a retry can never send the same email twice
//    at once, and a successful send is never repeated.
//  * "sent" is recorded only when the provider accepted the message.
//  * Failures keep the result page working and leave a retry available, capped
//    at MAX_ATTEMPTS sends per submission.

export const MAX_ATTEMPTS = 6;
const IN_PROGRESS_MS = 60_000;
const RETRY_DELAY_MS = 700;
/** One address is emailed at most this many results in a day, so the form cannot be used to flood someone's inbox. */
export const MAX_RESULT_EMAILS_PER_ADDRESS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Messages being handed to the mail server at the same moment, per server instance (Gmail refuses many parallel connections). */
const MAX_CONCURRENT_SENDS = 3;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface DeliveryOptions {
  now?: () => Date;
  /** Injected in tests to avoid real waiting. */
  wait?: (ms: number) => Promise<void>;
}

let activeSends = 0;
const waitingSends: Array<() => void> = [];

/** Runs the task when one of the few send slots is free; a finishing send hands its slot straight to the next in line. */
async function withSendSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeSends >= MAX_CONCURRENT_SENDS) await new Promise<void>((resolve) => waitingSends.push(resolve));
  else activeSends += 1;
  try {
    return await task();
  } finally {
    const next = waitingSends.shift();
    if (next) next();
    else activeSends -= 1;
  }
}

/** One try at the mail server. A provider that throws (instead of reporting a failure) is turned into a failure. */
async function trySend(message: MailMessage): Promise<SendOutcome> {
  const provider = getMailProvider();
  if (!provider) return { ok: false, retryable: false, error: "Email is not set up on this site yet." };
  try {
    return await withSendSlot(() => provider.send(message));
  } catch (error) {
    console.error("[assessments] The mail provider threw:", error instanceof Error ? error.message : "unknown error");
    return { ok: false, retryable: false, error: "The email could not be sent." };
  }
}

async function sendWithRetry(message: MailMessage, wait: (ms: number) => Promise<void>): Promise<SendOutcome & { attempts: number }> {
  let outcome = await trySend(message);
  let attempts = 1;
  if (!outcome.ok && outcome.retryable) {
    await wait(RETRY_DELAY_MS);
    outcome = await trySend(message);
    attempts = 2;
  }
  return { ...outcome, attempts };
}

/** How many results were already emailed to this address in the last day (not counting `exceptId`). */
async function recentResultEmailsTo(store: DocStore, address: string, now: Date, exceptId: string): Promise<number> {
  const rows = await store.query<EmailRecordDoc>(COL.emails, { where: [["to", address]], limit: 100 });
  return rows.filter(
    (r) => r.kind === "result" && r.id !== exceptId && (r.status === "sent" || r.status === "sending") && now.getTime() - Date.parse(r.createdAt) < DAY_MS,
  ).length;
}

async function updateSubmissionEmail(store: DocStore, submissionId: string, patch: Partial<SubmissionEmailState>): Promise<SubmissionEmailState> {
  const updated = await store.transact<SubmissionDoc>(COL.submissions, submissionId, (cur) =>
    cur ? { ...cur, email: { ...cur.email, ...patch } } : undefined,
  );
  return updated?.email ?? { status: "failed", attempts: 0 };
}

/**
 * The PDF report to attach, or nothing when the assessment doesn't attach it or it can't be made:
 * the email is then sent without it rather than not at all.
 */
async function reportAttachment(submission: SubmissionDoc, version: AssessmentVersionDoc): Promise<MailMessage["attachments"]> {
  if (version.definition.email.attachReport === false) return undefined;
  try {
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
    return [{ filename: reportFileName(version.meta.title, submission.respondent.name), content: Buffer.from(bytes), contentType: "application/pdf" }];
  } catch (error) {
    console.error("[assessments] The PDF report for a result email could not be made:", error instanceof Error ? error.message : "unknown");
    return undefined;
  }
}

export async function deliverResultEmail(
  store: DocStore,
  submission: SubmissionDoc,
  version: AssessmentVersionDoc,
  options: DeliveryOptions = {},
): Promise<SubmissionEmailState> {
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? sleep;

  if (!submission.consent.emailResults || !version.definition.email.enabled) {
    return updateSubmissionEmail(store, submission.id, { status: "not_requested" });
  }
  if (!getMailProvider()) {
    return updateSubmissionEmail(store, submission.id, { status: "not_configured", lastAttemptAt: now().toISOString() });
  }

  const recordId = `${submission.id}_result`;
  const claim: { won: boolean; blocked: "sent" | "in_progress" | "limit" | null } = { won: false, blocked: null };

  const record = await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) => {
    claim.won = false;
    claim.blocked = null;
    if (cur?.status === "sent") {
      claim.blocked = "sent";
      return undefined;
    }
    if (cur?.status === "sending" && now().getTime() - Date.parse(cur.updatedAt) < IN_PROGRESS_MS) {
      claim.blocked = "in_progress";
      return undefined;
    }
    if ((cur?.attempts ?? 0) >= MAX_ATTEMPTS) {
      claim.blocked = "limit";
      return undefined;
    }
    claim.won = true;
    const stamp = now().toISOString();
    return {
      id: recordId,
      submissionId: submission.id,
      assessmentId: submission.assessmentId,
      kind: "result",
      to: submission.respondent.email,
      subject: cur?.subject ?? "",
      status: "sending",
      attempts: (cur?.attempts ?? 0) + 1,
      createdAt: cur?.createdAt ?? stamp,
      updatedAt: stamp,
    };
  });

  if (!claim.won) {
    if (claim.blocked === "sent") return updateSubmissionEmail(store, submission.id, { status: "sent" });
    if (claim.blocked === "in_progress") return { ...submission.email, status: "pending" };
    return updateSubmissionEmail(store, submission.id, {
      status: "failed",
      error: "We've reached the maximum number of sending attempts for this email.",
    });
  }

  const attempts = record?.attempts ?? 1;

  // Emailing one address over and over is how a form gets used to flood someone's inbox: stop at a few a day.
  if ((await recentResultEmailsTo(store, submission.respondent.email, now(), recordId)) >= MAX_RESULT_EMAILS_PER_ADDRESS) {
    const error = "We've already emailed this address several times today, so we haven't sent another. Your results stay available on this page.";
    const stamp = now().toISOString();
    await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) => (cur ? { ...cur, status: "failed", attempts: MAX_ATTEMPTS, error, updatedAt: stamp } : undefined));
    return updateSubmissionEmail(store, submission.id, { status: "failed", attempts: MAX_ATTEMPTS, lastAttemptAt: stamp, error });
  }

  // Whatever goes wrong from here (the PDF, the template, the mail server), the record ends as "failed", never stuck on "sending".
  let rendered = { subject: "" };
  let outcome: SendOutcome;
  try {
    const attachments = await reportAttachment(submission, version);
    // Someone whose data was deleted (at their request) while this was being prepared gets no email.
    if (!(await store.get(COL.submissions, submission.id))) {
      await store.delete(COL.emails, recordId);
      return { status: "failed", attempts: 0, error: "Those results no longer exist." };
    }
    const email = renderResultEmail({
      attached: Boolean(attachments),
      name: submission.respondent.name,
      assessmentTitle: version.meta.title,
      completedAt: new Date(submission.createdAt),
      questions: questionCounts(version.definition, submission.answers),
      result: submission.result,
      definition: version.definition,
      resultUrl: `${publicBaseUrl()}/assessments/results/${submission.accessToken}`,
      siteName: SITE_NAME,
      logoUrl: `${publicBaseUrl()}/logo-transparent.png`,
    });
    rendered = email;
    outcome = await sendWithRetry(
      { to: submission.respondent.email, subject: email.subject, html: email.html, text: email.text, ...(attachments ? { attachments } : {}) },
      wait,
    );
  } catch (error) {
    console.error("[assessments] Preparing a result email failed:", error instanceof Error ? error.message : "unknown error");
    outcome = { ok: false, retryable: false, error: "The email could not be sent." };
  }
  const stamp = now().toISOString();

  await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) =>
    cur
      ? {
          ...cur,
          subject: rendered.subject,
          status: outcome.ok ? "sent" : "failed",
          messageId: outcome.ok ? outcome.messageId : cur.messageId,
          error: outcome.ok ? undefined : outcome.error,
          updatedAt: stamp,
        }
      : undefined,
  );

  return updateSubmissionEmail(
    store,
    submission.id,
    outcome.ok
      ? { status: "sent", attempts, lastAttemptAt: stamp, sentAt: stamp, messageId: outcome.messageId, error: undefined }
      : { status: "failed", attempts, lastAttemptAt: stamp, error: outcome.error },
  );
}

/**
 * Tells the practice that a self-check was completed. The practice's own inbox is always told; the participant's
 * name, email, result and PDF report are included only when they agreed to share them, otherwise the note says
 * that someone completed it and nothing more. Extra recipients set on the assessment are told as well.
 */
export async function deliverAdminNotification(
  store: DocStore,
  submission: SubmissionDoc,
  version: AssessmentVersionDoc,
  options: DeliveryOptions & { retryOnly?: boolean } = {},
): Promise<void> {
  if (!getMailProvider()) return;
  const cfg = version.definition.email.adminNotify;
  // The practice sees who this was, with the result and the PDF, when the participant agreed or when the
  // self-check is set up so that the practice sees everyone ("full"); otherwise it only hears that someone finished.
  const agreed = submission.consent.shareWithPractice;
  const shared = agreed || version.definition.privacy.adminViewMode === "full";
  const recipients = [...new Set([OWNER_EMAIL, ...(cfg.enabled ? cfg.recipients : [])].map((r) => r.trim().toLowerCase()).filter(Boolean))];
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? sleep;

  // One record per submission. The first caller claims it; it can be claimed again only when the note failed or the
  // sender was interrupted (nothing happened for a minute). `retryOnly` (the admin's retry) never starts a first note.
  const recordId = `${submission.id}_admin`;
  let won = false;
  await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) => {
    won = false;
    if (cur?.status === "sent") return undefined;
    if (cur?.status === "sending" && now().getTime() - Date.parse(cur.updatedAt) < IN_PROGRESS_MS) return undefined;
    if (!cur && options.retryOnly) return undefined;
    if ((cur?.attempts ?? 0) >= MAX_ATTEMPTS) return undefined;
    won = true;
    const stamp = now().toISOString();
    return {
      id: recordId,
      submissionId: submission.id,
      assessmentId: submission.assessmentId,
      kind: "admin_notification",
      to: recipients.join(", "),
      subject: cur?.subject ?? "",
      status: "sending",
      attempts: (cur?.attempts ?? 0) + 1,
      createdAt: cur?.createdAt ?? stamp,
      updatedAt: stamp,
    } satisfies EmailRecordDoc;
  });
  if (!won) return;

  let subject = "";
  let failure: string | undefined;
  try {
    const attachments = shared ? await reportAttachment(submission, version) : undefined;
    if (!(await store.get(COL.submissions, submission.id))) {
      await store.delete(COL.emails, recordId);
      return;
    }
    const rendered = renderAdminNotification({
      name: submission.respondent.name,
      email: submission.respondent.email,
      assessmentTitle: version.meta.title,
      completedAt: new Date(submission.createdAt),
      result: submission.result,
      siteName: SITE_NAME,
      shared,
      reason: agreed ? "agreed" : "always",
      questions: questionCounts(version.definition, submission.answers),
      attached: Boolean(attachments),
      adminUrl: `${publicBaseUrl()}/admin/assessments/${submission.assessmentId}/submissions`,
      logoUrl: `${publicBaseUrl()}/logo-transparent.png`,
    });
    subject = rendered.subject;
    const outcomes = await Promise.all(
      recipients.map((to) => sendWithRetry({ to, subject: rendered.subject, html: rendered.html, text: rendered.text, ...(attachments ? { attachments } : {}) }, wait)),
    );
    const failed = outcomes.find((o) => !o.ok);
    if (failed && !failed.ok) failure = failed.error;
  } catch (error) {
    console.error("[assessments] Preparing the note to the practice failed:", error instanceof Error ? error.message : "unknown error");
    failure = "The note could not be sent.";
  }
  await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) =>
    cur ? { ...cur, subject, status: failure ? "failed" : "sent", error: failure, updatedAt: now().toISOString() } : undefined,
  );
}
