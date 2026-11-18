import { clientIp, ok, readJson, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { getPeerForm, submitPeerResponse } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The (reworded) questions a peer is asked. Shows the participant's first name only. */
export const GET = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.resultRead);
  return ok(await getPeerForm(await getStore(), params.token));
});

/** Body: { consent: true, relationship?, answers, idempotencyKey }. */
export const POST = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.peer);
  const body = await readJson(req);
  await submitPeerResponse(await getStore(), params.token, body);
  return ok({ ok: true }, 201);
});
