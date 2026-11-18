import { ok, route } from "@/lib/assessments/server/http";
import { listPublished } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Published assessments for the public library. */
export const GET = route(async () => {
  const assessments = await listPublished(await getStore());
  return ok({ assessments });
});
