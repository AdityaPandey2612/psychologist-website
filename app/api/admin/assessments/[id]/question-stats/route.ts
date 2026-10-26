import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { getQuestionStats } from "@/lib/assessments/server/adminData";
import { ok, route } from "@/lib/assessments/server/http";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How each scored question went across all participants (anonymous averages, lowest first). */
export const GET = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  return ok(await getQuestionStats(await getStore(), params.id));
});
