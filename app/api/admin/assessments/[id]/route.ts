import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { ok, readJson, route } from "@/lib/assessments/server/http";
import { deleteAssessment, getAssessment, reportFor, updateAssessment } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const store = await getStore();
  const assessment = await getAssessment(store, params.id);
  return ok({ assessment, report: await reportFor(store, assessment) });
});

/** Saves the draft. Body: { meta?, definition?, baseRevision? }. Published versions are untouched. */
export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const body = await readJson(req, 1_500_000);
  return ok(await updateAssessment(await getStore(), params.id, body));
});

/** Deletes the assessment. A published one must be unpublished first; one with responses needs ?withResponses=true. */
export const DELETE = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const withResponses = new URL(req.url).searchParams.get("withResponses") === "true";
  return ok({ ok: true, ...(await deleteAssessment(await getStore(), params.id, { withResponses })) });
});
