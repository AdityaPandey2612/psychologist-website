import type { AdminIdentity } from "@/lib/assessments/server/adminAuth";
import type { SubmissionRow } from "@/lib/assessments/server/adminData";
import type { AdminAssessmentSummary } from "@/lib/assessments/server/service";
import type { AssessmentCategory } from "@/lib/assessments/types";

// Response shape of GET /api/admin/assessments (type-only imports from the server modules).

export type { AdminAssessmentSummary, SubmissionRow };

export interface DashboardRecent extends SubmissionRow {
  assessmentId: string;
  assessmentTitle: string;
}

export interface DashboardData {
  admin: AdminIdentity;
  setup: { storage: "firestore" | "file" | "memory"; firebaseAdminConfigured: boolean; emailConfigured: boolean };
  templates: Array<{ id: string; name: string; description: string; starter: boolean }>;
  categories: AssessmentCategory[];
  assessments: AdminAssessmentSummary[];
  overview: {
    totals: { assessments: number; published: number; drafts: number; archived: number; submissions: number };
    perAssessment: Array<{ id: string; title: string; status: AdminAssessmentSummary["status"]; submissions: number }>;
    recent: DashboardRecent[];
  };
}

export function formatDate(iso: string | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
