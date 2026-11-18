import { clientIp, ok, readJson, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { resendResultEmail } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Sends (or retries) the result email. Body: { consent?: true } when the participant hadn't opted in yet. */
export const POST = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.email);
  const body = await readJson(req, 2_000).catch(() => ({}));
  return ok(await resendResultEmail(await getStore(), params.token, body));
});
