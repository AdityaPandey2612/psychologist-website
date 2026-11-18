import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { ok, readJson, route } from "@/lib/assessments/server/http";
import { previewScore } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scores sample answers against the current draft; nothing is stored. Body: { answers }. */
export const POST = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const body = await readJson(req, 200_000);
  return ok(await previewScore(await getStore(), params.id, body.answers));
});
