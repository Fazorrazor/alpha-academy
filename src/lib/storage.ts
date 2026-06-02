/**
 * src/lib/storage.ts
 *
 * Cloud Storage helpers for:
 *   - Generating signed upload URLs (admin → Storage, for PDF lessons)
 *   - Generating signed read/download URLs (student → Storage, 15-min expiry)
 */
import { adminStorage } from '@/lib/firebase/admin';

const SIGNED_URL_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const MAX_PDF_SIZE_BYTES = 52_428_800;         // 50 MB

/**
 * Generate a V4 signed upload URL for an admin PDF upload.
 * The admin's browser POSTs the file directly to this URL.
 *
 * Returns { uploadUrl, storagePath } where storagePath is what gets
 * saved on the lesson document and later used to generate read URLs.
 */
export async function createSignedUploadUrl(
  courseId: string,
  filename: string
): Promise<{ uploadUrl: string; storagePath: string }> {
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `course-content/${courseId}/pdfs/${Date.now()}_${safeFilename}`;

  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);

  const [uploadUrl] = await file.generateSignedPostPolicyV4({
    expires: Date.now() + SIGNED_URL_EXPIRY_MS,
    conditions: [
      ['content-length-range', 0, MAX_PDF_SIZE_BYTES],
      ['eq', '$Content-Type', 'application/pdf'],
    ],
    fields: {
      'Content-Type': 'application/pdf',
    },
  });

  return { uploadUrl: uploadUrl as unknown as string, storagePath };
}

/**
 * Generate a V4 signed read URL for a private PDF stored in Cloud Storage.
 * Expiry: 15 minutes — short enough that URL theft is practically useless.
 *
 * This is called server-side only. The URL is never stored — it's generated
 * fresh on each lesson open request.
 */
export async function generateSignedReadUrl(storagePath: string): Promise<string> {
  const bucket = adminStorage.bucket();
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + SIGNED_URL_EXPIRY_MS,
    // Force browser to open as PDF inline rather than downloading
    responseDisposition: 'inline',
    responseType: 'application/pdf',
  });

  return url;
}

/**
 * In emulator mode, Cloud Storage signed URLs don't work.
 * Returns a mock URL so the UI doesn't break during local development.
 */
export function isMockStorageMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' ||
    !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET === 'demo-alpha-academy.appspot.com'
  );
}
