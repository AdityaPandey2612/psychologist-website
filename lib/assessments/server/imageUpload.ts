// What an uploaded picture may be. The kind is judged by the file's own first bytes, because a file
// name or a declared type can say anything. SVG is deliberately not accepted: it can carry scripts.

export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;

export interface ImageKind {
  contentType: string;
  extension: string;
}

export function detectImageType(bytes: Uint8Array): ImageKind | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: "image/png", extension: "png" };
  if (startsWith(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", extension: "jpg" };
  // "GIF87a" or "GIF89a"
  if (startsWith(0x47, 0x49, 0x46, 0x38) && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return { contentType: "image/gif", extension: "gif" };
  // "RIFF", four bytes of size, then "WEBP"
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return { contentType: "image/webp", extension: "webp" };
  return null;
}
