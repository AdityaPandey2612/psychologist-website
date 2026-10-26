import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { getOverview } from "@/lib/assessments/server/adminData";
import { hasFirestoreCredentials } from "@/lib/assessments/server/store";
import { getMailProvider } from "@/lib/assessments/server/mail";
import { ok, readJson, route } from "@/lib/assessments/server/http";
import { createAssessment, listAssessments, listCategories } from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";
import { TEMPLATES } from "@/lib/assessments/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dashboard data: assessments, categories, templates, overview analytics and setup status. */
export const GET = route(async (req) => {
  const admin = await requireAdmin(req);
  const store = await getStore();
  const [assessments, categories, overview] = await Promise.all([listAssessments(store), listCategories(store), getOverview(store)]);
  return ok({
    admin,
    setup: {
      storage: store.kind,
      firebaseAdminConfigured: hasFirestoreCredentials(),
      emailConfigured: getMailProvider() !== null,
    },
    templates: TEMPLATES.map(({ id, name, description, starter }) => ({ id, name, description, starter })),
    categories,
    assessments,
    overview,
  });
});

/** Body: { templateId?: "blank" | "listening-self-reflection", title?: string }. */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req);
  const body = await readJson(req, 10_000);
  return ok(await createAssessment(await getStore(), body, admin), 201);
});
