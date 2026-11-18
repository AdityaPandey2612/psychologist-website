import { badRequest, clientIp, ok, readJson, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { setPeerEnabled } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Turn the participant's peer-feedback link on or off. Body: { enabled: boolean }. */
export const POST = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.resultRead);
  const body = await readJson(req, 2_000);
  if (typeof body.enabled !== "boolean") throw badRequest("Say whether the link should be on or off.");
  return ok(await setPeerEnabled(await getStore(), params.token, body.enabled));
});
