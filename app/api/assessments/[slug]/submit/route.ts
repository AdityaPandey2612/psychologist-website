import { clientIp, ok, readJson, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { submitAssessment } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The result email is sent before responding, so allow time for the mail server.
export const maxDuration = 30;

/**
 * Validates the answers, calculates the result on the server, saves the
 * submission and (with consent) emails the result. The browser never sends a score.
 */
export const POST = route(async (req, { params }: { params: { slug: string } }) => {
  const ip = clientIp(req);
  enforceRateLimit(ip, LIMITS.submitBurst);
  enforceRateLimit(ip, LIMITS.submit);
  const body = await readJson(req);
  const result = await submitAssessment(await getStore(), params.slug, body);
  return ok(result, result.duplicate ? 200 : 201);
});
