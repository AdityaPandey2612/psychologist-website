import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { exportAllSubmissionsCsv } from "@/lib/assessments/server/adminData";
import { route } from "@/lib/assessments/server/http";
import { getStore } from "@/lib/assessments/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads a complete CSV export of all submissions for the assessment,
 * including individual question responses and chosen options for Excel.
 */
export const GET = route(async (req, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const { filename, csv } = await exportAllSubmissionsCsv(await getStore(), params.id);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
