import type { EmailStatus } from "@/lib/assessments/types";
import { Badge } from "@/components/assessments/ui";

const LABELS: Record<EmailStatus, { label: string; tone: "primary" | "neutral" | "gold" | "accent" }> = {
  sent: { label: "Sent", tone: "primary" },
  failed: { label: "Failed", tone: "accent" },
  pending: { label: "Pending", tone: "gold" },
  not_configured: { label: "Email not set up", tone: "gold" },
  not_requested: { label: "Not requested", tone: "neutral" },
};

export const EMAIL_STATUS_LABEL = (status: EmailStatus) => LABELS[status].label;

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  const { label, tone } = LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

/** A retry makes sense when an email hasn't been accepted by the mail server (one that is still being sent is never started twice). */
export const canRetryEmail = (status: EmailStatus) => status === "failed" || status === "not_configured" || status === "pending";
