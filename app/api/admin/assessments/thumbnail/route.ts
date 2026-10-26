import { requireAdmin } from "@/lib/assessments/server/adminAuth";
import { ApiError, clientIp, ok, route } from "@/lib/assessments/server/http";
import { MAX_THUMBNAIL_BYTES, detectImageType } from "@/lib/assessments/server/imageUpload";
import { enforceRateLimit, LIMITS } from "@/lib/assessments/server/rateLimit";
import { saveThumbnail } from "@/lib/assessments/server/thumbnails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TOO_LARGE = `The image is larger than ${MAX_THUMBNAIL_BYTES / (1024 * 1024)} MB. Choose a smaller one.`;

/** An admin uploads the picture shown on an assessment's library card; the answer is its address. */
export const POST = route(async (req) => {
  await requireAdmin(req);
  enforceRateLimit(clientIp(req), LIMITS.upload);
  // Refuse an oversized body before reading it (the form adds a little to the file's own size).
  if (Number(req.headers.get("content-length") || 0) > MAX_THUMBNAIL_BYTES + 64 * 1024) throw new ApiError(413, "too_large", TOO_LARGE);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "bad_request", "Choose an image to upload.");
  if (file.size > MAX_THUMBNAIL_BYTES) throw new ApiError(413, "too_large", TOO_LARGE);
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = detectImageType(bytes);
  if (!kind) throw new ApiError(400, "bad_request", "Upload a PNG, JPEG, WebP or GIF image.");
  return ok({ url: await saveThumbnail(bytes, kind) }, 201);
});
