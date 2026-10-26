import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { badRequest, ok, readJson, route } from "@/lib/assessments/server/http";
import { listCategories, saveCategories } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin(req);
  return ok({ categories: await listCategories(await getStore()) });
});

/** Replaces the category list. Body: { categories: [{ id?, name, description? }] }. */
export const PUT = route(async (req) => {
  await requireAdmin(req);
  const body = await readJson(req, 50_000);
  if (!Array.isArray(body.categories)) throw badRequest("Send a list of categories.");
  return ok({ categories: await saveCategories(await getStore(), body.categories) });
});
