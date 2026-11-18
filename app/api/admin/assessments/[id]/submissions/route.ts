import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { SUBMISSION_SORTS, listSubmissions, type SubmissionSort } from "@/lib/assessments/server/adminData";
import { ok, route } from "@/lib/assessments/server/http";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_STATUSES = ["not_requested", "pending", "sent", "failed", "not_configured"] as const;

/** Submissions, shaped by the assessment's privacy mode. Query: ?limit=&offset=&q=&email=&level=&shared=true&sort= */
export const GET = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  return ok(
    await listSubmissions(await getStore(), params.id, {
      limit: Number(url.searchParams.get("limit")) || undefined,
      offset: Number(url.searchParams.get("offset")) || undefined,
      q: url.searchParams.get("q")?.slice(0, 100) || undefined,
      email: EMAIL_STATUSES.find((s) => s === url.searchParams.get("email")),
      level: url.searchParams.get("level")?.slice(0, 100) || undefined,
      shared: url.searchParams.get("shared") === "true",
      sort: SUBMISSION_SORTS.includes(url.searchParams.get("sort") as SubmissionSort) ? (url.searchParams.get("sort") as SubmissionSort) : undefined,
    }),
  );
});
