import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { deleteSubmission, getSubmissionDetail, retrySubmissionEmail } from "@/lib/assessments/server/adminData";
import { badRequest, ok, readJson, route } from "@/lib/assessments/server/http";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: { id: string; sid: string } };

export const GET = route(async (req, { params }: Ctx) => {
  await requireAdmin(req);
  return ok(await getSubmissionDetail(await getStore(), params.id, params.sid));
});

/** Body: { action: "retry-email" }. */
export const POST = route(async (req, { params }: Ctx) => {
  await requireAdmin(req);
  const { action } = await readJson(req, 2_000);
  if (action !== "retry-email") throw badRequest("Unknown action.");
  return ok(await retrySubmissionEmail(await getStore(), params.id, params.sid));
});

/** Erases one participant's data (e.g. on request). */
export const DELETE = route(async (req, { params }: Ctx) => {
  await requireAdmin(req);
  await deleteSubmission(await getStore(), params.id, params.sid);
  return ok({ ok: true });
});
