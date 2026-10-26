import { clientIp, ok, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { getResultView } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The participant's private result, addressed by an unguessable token. */
export const GET = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.resultRead);
  return ok(await getResultView(await getStore(), params.token));
});
