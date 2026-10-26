import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { getAssessmentAnalytics } from "@/lib/assessments/server/adminData";
import { ok, route } from "@/lib/assessments/server/http";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  return ok(await getAssessmentAnalytics(await getStore(), params.id));
});
