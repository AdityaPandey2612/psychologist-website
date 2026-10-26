import { randomBytes, randomUUID } from "node:crypto";
import { ApiError } from "./http";
import type { ImageKind } from "./imageUpload";
import { hasFirestoreCredentials } from "./store";

// Where assessment thumbnails are kept: Firebase Storage, through the same Admin credentials the
// assessment data uses. Behind a small interface so tests can use an in-memory stand-in.

export interface ThumbnailStorage {
  /** Stores the picture under `path` and returns the address it can be opened by. */
  save(path: string, bytes: Buffer, kind: ImageKind): Promise<string>;
}

const globalForStorage = globalThis as typeof globalThis & { __assessmentThumbnailStorage?: ThumbnailStorage };

/** Test hook. */
export function setThumbnailStorageForTests(storage: ThumbnailStorage | undefined): void {
  globalForStorage.__assessmentThumbnailStorage = storage;
}

function bucketName() {
  const name = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!name) throw new ApiError(503, "not_configured", "Image upload is not configured yet: the Firebase storage bucket is not set.");
  return name;
}

const firebaseStorage: ThumbnailStorage = {
  async save(path, bytes, kind) {
    if (!hasFirestoreCredentials()) {
      throw new ApiError(503, "not_configured", "Image upload needs the Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_JSON), which are not set on this server.");
    }
    const [{ getStorage }, { getAssessmentsAdminApp }] = await Promise.all([import("firebase-admin/storage"), import("./firestoreStore")]);
    const bucket = getStorage(getAssessmentsAdminApp()).bucket(bucketName());
    const token = randomUUID();
    await bucket.file(path).save(bytes, {
      resumable: false,
      contentType: kind.contentType,
      metadata: { cacheControl: "public, max-age=31536000, immutable", metadata: { firebaseStorageDownloadTokens: token } },
    });
    // Firebase's own download-token address (the kind the site's gallery images use), so the bucket stays closed to the public.
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  },
};

/** Stores an assessment thumbnail under a random name and returns its address. */
export async function saveThumbnail(bytes: Buffer, kind: ImageKind): Promise<string> {
  const path = `assessment-thumbnails/${randomBytes(12).toString("hex")}.${kind.extension}`;
  return (globalForStorage.__assessmentThumbnailStorage ?? firebaseStorage).save(path, bytes, kind);
}
