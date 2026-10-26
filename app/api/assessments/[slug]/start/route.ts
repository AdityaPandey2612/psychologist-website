import { clientIp, notFound, ok, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getPublishedBySlug, recordStart } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous counter used for completion statistics; stores no personal data. */
export const POST = route(async (req, { params }: { params: { slug: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.start);
  const store = await getStore();
  const found = await getPublishedBySlug(store, params.slug);
  if (!found) throw notFound();
  await recordStart(store, found.summary.id);
  return ok({ ok: true });
});
