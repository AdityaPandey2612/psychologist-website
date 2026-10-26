import type { AssessmentVersionDoc, EmailRecordDoc, SubmissionDoc, SubmissionEmailState } from "../types";
import { COL, publicBaseUrl, SITE_NAME } from "./config";
import { renderAdminNotification, renderResultEmail } from "./emailTemplates";
import { getMailProvider, type MailMessage, type SendOutcome } from "./mail";
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface DeliveryOptions {
  now?: () => Date;
  /** Injected in tests to avoid real waiting. */
  wait?: (ms: number) => Promise<void>;
}

async function sendWithRetry(message: MailMessage, wait: (ms: number) => Promise<void>): Promise<SendOutcome & { attempts: number }> {
  const provider = getMailProvider();
  if (!provider) return { ok: false, retryable: false, error: "Email is not set up on this site yet.", attempts: 0 };
  let outcome = await provider.send(message);
  let attempts = 1;
  if (!outcome.ok && outcome.retryable) {
    await wait(RETRY_DELAY_MS);
    outcome = await provider.send(message);
    attempts = 2;
  }
  return { ...outcome, attempts };
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

  const attachments = await reportAttachment(submission, version);
  const rendered = renderResultEmail({
    attached: Boolean(attachments),
    name: submission.respondent.name,
    assessmentTitle: version.meta.title,
    completedAt: new Date(submission.createdAt),
    result: submission.result,
    definition: version.definition,
    resultUrl: `${publicBaseUrl()}/assessments/results/${submission.accessToken}`,
    siteName: SITE_NAME,
    logoUrl: `${publicBaseUrl()}/logo.png`,
  });

  const outcome = await sendWithRetry(
    { to: submission.respondent.email, subject: rendered.subject, html: rendered.html, text: rendered.text, ...(attachments ? { attachments } : {}) },
    wait,
  );
  const stamp = now().toISOString();
  const attempts = record?.attempts ?? 1;

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
 * Optional notification to the practice. Only ever called when the
 * assessment is configured for it AND the participant explicitly agreed.
 */
export async function deliverAdminNotification(
  store: DocStore,
  submission: SubmissionDoc,
  version: AssessmentVersionDoc,
  options: DeliveryOptions = {},
): Promise<void> {
  const cfg = version.definition.email.adminNotify;
  if (!cfg.enabled || !submission.consent.shareWithPractice || cfg.recipients.length === 0) return;
  if (!getMailProvider()) return;
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? sleep;

  const recordId = `${submission.id}_admin`;
  const created = await store.create(COL.emails, recordId, {
    id: recordId,
    submissionId: submission.id,
    assessmentId: submission.assessmentId,
    kind: "admin_notification",
    to: cfg.recipients.join(", "),
    subject: "",
    status: "sending",
    attempts: 1,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  } satisfies EmailRecordDoc);
  if (!created) return; // already sent (or in flight) for this submission

  const rendered = renderAdminNotification({
    name: submission.respondent.name,
    email: submission.respondent.email,
    assessmentTitle: version.meta.title,
    completedAt: new Date(submission.createdAt),
    result: submission.result,
    siteName: SITE_NAME,
  });
  const outcomes = await Promise.all(cfg.recipients.map((to) => sendWithRetry({ to, subject: rendered.subject, html: rendered.html, text: rendered.text }, wait)));
  const failed = outcomes.find((o) => !o.ok);
  await store.transact<EmailRecordDoc>(COL.emails, recordId, (cur) =>
    cur
      ? { ...cur, subject: rendered.subject, status: failed ? "failed" : "sent", error: failed && !failed.ok ? failed.error : undefined, updatedAt: now().toISOString() }
      : undefined,
  );
}
