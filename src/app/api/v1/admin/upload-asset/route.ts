import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminStorage } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * POST /api/v1/admin/upload-asset
 *
 * Generates a secure, time-limited signed upload URL.
 *
 * Body:
 *   type: 'video' | 'pdf'
 *   filename: string  (original file name, used to infer mime type + extension)
 *   courseId: string  (used to scope the storage path)
 *
 * Response for pdf:
 *   { uploadUrl: string, storagePath: string, type: 'pdf' }
 *
 * Response for video:
 *   { uploadUrl: string, muxUploadId: string, type: 'video' }
 *   (frontend polls /api/v1/admin/mux-status/:uploadId for muxPlaybackId after upload)
 */
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { type, filename, courseId } = body;

    if (!type || !filename || !courseId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, filename, courseId' },
        { status: 400 }
      );
    }

    if (type !== 'video' && type !== 'pdf') {
      return NextResponse.json(
        { error: 'type must be "video" or "pdf"' },
        { status: 400 }
      );
    }

    // ── PDF path: generate a Cloud Storage signed upload URL ─────────────────
    if (type === 'pdf') {
      const ext = filename.split('.').pop()?.toLowerCase() || 'pdf';
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `course-content/${courseId}/pdfs/${Date.now()}_${safeFilename}`;

      const bucket = adminStorage.bucket();
      const file = bucket.file(storagePath);

      const [uploadUrl] = await file.generateSignedPostPolicyV4({
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
        conditions: [
          ['content-length-range', 0, 52428800], // max 50 MB
          ['eq', '$Content-Type', `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`],
        ],
        fields: {
          'Content-Type': `application/${ext === 'pdf' ? 'pdf' : 'octet-stream'}`,
        },
      });

      return NextResponse.json({ uploadUrl, storagePath, type: 'pdf' });
    }

    // ── Video path: create a Mux direct upload URL ────────────────────────────
    if (type === 'video') {
      const muxTokenId = process.env.MUX_TOKEN_ID;
      const muxTokenSecret = process.env.MUX_TOKEN_SECRET;

      if (!muxTokenId || !muxTokenSecret) {
        return NextResponse.json(
          { error: 'Mux credentials not configured' },
          { status: 500 }
        );
      }

      // In emulator/dev mode, return a mock response
      if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' ||
          muxTokenId === 'mock_mux_token_id') {
        const mockUploadId = `mock_upload_${Date.now()}`;
        return NextResponse.json({
          uploadUrl: `https://storage.googleapis.com/mux-uploads/${mockUploadId}`,
          muxUploadId: mockUploadId,
          type: 'video',
          isMock: true,
        });
      }

      const credentials = Buffer.from(`${muxTokenId}:${muxTokenSecret}`).toString('base64');
      const muxResponse = await fetch('https://api.mux.com/video/v1/uploads', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cors_origin: process.env.NEXT_PUBLIC_APP_URL,
          new_asset_settings: {
            playback_policy: ['signed'],
          },
          timeout: 3600,
        }),
      });

      if (!muxResponse.ok) {
        const err = await muxResponse.json();
        console.error('Mux API error:', err);
        return NextResponse.json(
          { error: 'Failed to create Mux upload URL' },
          { status: 502 }
        );
      }

      const muxData = await muxResponse.json();
      const upload = muxData.data;

      return NextResponse.json({
        uploadUrl: upload.url,
        muxUploadId: upload.id,
        type: 'video',
      });
    }

  } catch (error) {
    return handleRouteError(error);
  }
}
