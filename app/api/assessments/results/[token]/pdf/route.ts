import { NextResponse } from "next/server";
import { clientIp, route } from "@/lib/assessments/server/http";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { getStore } from "@/lib/assessments/server/store";
import { getReportPdf } from "@/lib/assessments/server/submissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * The participant's report as a PDF to save. It is opened with the same private link as the result page
 * and made on the spot from the stored result, as the assessment was set up when they took it.
 */
export const GET = route(async (req, { params }: { params: { token: string } }) => {
  enforceRateLimit(clientIp(req), LIMITS.report);
  const { bytes, filename } = await getReportPdf(await getStore(), params.token);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
});
