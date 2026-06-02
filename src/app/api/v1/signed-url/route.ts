import { NextResponse } from 'next/server';
import { requireActiveSubscription } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateMuxSignedToken, buildMuxStreamUrl } from '@/lib/video';
import { generateSignedReadUrl, isMockStorageMode } from '@/lib/storage';

/**
 * GET /api/v1/signed-url?courseId=X&lessonId=Y&type=video|pdf
 *
 * The content gate. Called by the lesson player/viewer before loading media.
 *
 * Security checks (in order):
 *   1. Valid session cookie — requireActiveSubscription throws if not logged in.
 *   2. Active subscription — requireActiveSubscription throws SUBSCRIPTION_REQUIRED if expired.
 *   3. Student is enrolled in the course.
 *   4. Lesson exists and is published.
 *   5. Rate limit: 30 requests/minute per user (prevents URL farming).
 *
 * Returns:
 *   - video: { type: 'video', streamUrl: string, thumbnailUrl: string }
 *   - pdf:   { type: 'pdf',   readUrl: string }
 *
 * The returned URLs expire in 15 minutes. The client must re-call this
 * endpoint if the user is still watching/reading after 15 minutes.
 */
export async function GET(request: Request) {
  try {
    const profile = await requireActiveSubscription();

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const lessonId = searchParams.get('lessonId');
    const type = searchParams.get('type') as 'video' | 'pdf' | null;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!courseId || !lessonId || !type) {
      return NextResponse.json(
        { error: 'courseId, lessonId, and type are required query parameters' },
        { status: 400 }
      );
    }

    if (type !== 'video' && type !== 'pdf') {
      return NextResponse.json(
        { error: 'type must be "video" or "pdf"' },
        { status: 400 }
      );
    }

    // ── Rate limit: 30 requests/minute ────────────────────────────────────────
    const { allowed, remaining } = await checkRateLimit(profile.uid, 'signed-url', 30);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment before trying again.' },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // ── Verify enrollment ─────────────────────────────────────────────────────
    // Admins bypass enrollment check
    if (profile.role !== 'admin') {
      const enrollmentId = `${profile.uid}_${courseId}`;
      const enrollmentDoc = await adminDb.collection('enrollments').doc(enrollmentId).get();

      if (!enrollmentDoc.exists) {
        return NextResponse.json(
          { error: 'You are not enrolled in this course. Please enroll first.' },
          { status: 403 }
        );
      }
    }

    // ── Fetch lesson ──────────────────────────────────────────────────────────
    const lessonDoc = await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('lessons')
      .doc(lessonId)
      .get();

    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const lesson = lessonDoc.data()!;

    // Students can only access published lessons; admins can preview any status
    if (profile.role !== 'admin' && lesson.status !== 'published') {
      return NextResponse.json(
        { error: 'This lesson is not yet available.' },
        { status: 403 }
      );
    }

    // Verify the requested type matches the lesson type
    if (lesson.type !== type) {
      return NextResponse.json(
        { error: `This lesson is of type "${lesson.type}", not "${type}"` },
        { status: 400 }
      );
    }

    // ── Generate signed URL ───────────────────────────────────────────────────

    if (type === 'video') {
      const muxPlaybackId: string | null = lesson.muxPlaybackId ?? null;

      if (!muxPlaybackId) {
        return NextResponse.json(
          {
            error: 'Video is still processing. Please check back in a few minutes.',
            code: 'VIDEO_PROCESSING',
          },
          { status: 202 }
        );
      }

      const token = generateMuxSignedToken(muxPlaybackId);
      const streamUrl = buildMuxStreamUrl(muxPlaybackId, token);
      const thumbnailUrl = token
        ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?token=${token}`
        : `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg`;

      return NextResponse.json(
        {
          type: 'video',
          streamUrl,
          thumbnailUrl,
          muxPlaybackId,
          durationSeconds: lesson.durationSeconds ?? null,
          expiresInSeconds: 900,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            // Prevent the URL from being cached by browsers or CDNs
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    if (type === 'pdf') {
      const storagePath: string | null = lesson.storagePath ?? null;

      if (!storagePath) {
        return NextResponse.json(
          { error: 'PDF file is not yet available for this lesson.' },
          { status: 404 }
        );
      }

      // In emulator mode, return a mock URL
      if (isMockStorageMode()) {
        return NextResponse.json({
          type: 'pdf',
          readUrl: `http://localhost:9199/${storagePath}?alt=media`,
          expiresInSeconds: 900,
        });
      }

      const readUrl = await generateSignedReadUrl(storagePath);

      return NextResponse.json(
        {
          type: 'pdf',
          readUrl,
          expiresInSeconds: 900,
        },
        {
          headers: {
            'X-RateLimit-Remaining': String(remaining),
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Should never reach here
    return NextResponse.json({ error: 'Unsupported type' }, { status: 400 });
  } catch (error) {
    return handleRouteError(error);
  }
}
