import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { badRequest, ok, readJson, route } from "@/lib/assessments/server/http";
import {
  archiveAssessment,
  duplicateAssessment,
  publishAssessment,
  reportFor,
  restoreAssessment,
  unpublishAssessment,
} from "@/lib/assessments/server/service";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public pages are cached for a minute; refresh them right away when visibility changes. */
function refreshPublicPages(slug: string) {
  try {
    revalidatePath("/assessments");
    revalidatePath(`/assessments/${slug}`);
    revalidatePath(`/assessments/${slug}/start`);
    revalidatePath("/sitemap.xml");
  } catch {
    // Not fatal: the pages still refresh on their normal schedule.
  }
}

/** Body: { action: "publish" | "unpublish" | "archive" | "restore" | "duplicate" }. */
export const POST = route(async (req, { params }: { params: { id: string } }) => {
  const admin = await requireAdmin(req);
  const store = await getStore();
  const { action } = await readJson(req, 2_000);

  switch (action) {
    case "publish": {
      const result = await publishAssessment(store, params.id, admin);
      refreshPublicPages(result.assessment.slug);
      return ok(result);
    }
    case "duplicate":
      return ok(await duplicateAssessment(store, params.id, admin), 201);
    case "unpublish":
    case "archive":
    case "restore": {
      const run = { unpublish: unpublishAssessment, archive: archiveAssessment, restore: restoreAssessment }[action];
      const assessment = await run(store, params.id);
      refreshPublicPages(assessment.slug);
      return ok({ assessment, report: await reportFor(store, assessment) });
    }
    default:
      throw badRequest("Unknown action.");
  }
});
