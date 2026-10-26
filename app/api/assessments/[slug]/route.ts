import { toPublicForm } from "@/lib/assessments/definition";
import { isMailConfigured } from "@/lib/assessments/server/mail";
import { notFound, ok, route } from "@/lib/assessments/server/http";
import { getPublishedBySlug } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One published assessment plus its dynamic form schema (without scoring rules). */
export const GET = route(async (_req, { params }: { params: { slug: string } }) => {
  const found = await getPublishedBySlug(await getStore(), params.slug);
  if (!found) throw notFound("This self-check isn't available.");
  return ok({ assessment: found.summary, version: found.version.version, form: toPublicForm(found.version.definition, { emailAvailable: isMailConfigured() }) });
});
