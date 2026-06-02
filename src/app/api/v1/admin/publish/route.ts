import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';
import { safeRedisCall } from '@/lib/redis';
import {
  subjectCacheKeys,
  courseCacheKeys,
  lessonCacheKeys,
} from '@/lib/cache-keys';
import { FieldValue } from 'firebase-admin/firestore';

type PublishTarget = 'subject' | 'course' | 'lesson' | 'quiz';
type PublishAction = 'publish' | 'unpublish' | 'archive';

/**
 * POST /api/v1/admin/publish
 *
 * Body:
 *   targetType: 'subject' | 'course' | 'lesson' | 'quiz'
 *   targetId:   string
 *   action:     'publish' | 'unpublish' | 'archive'
 *   courseId?:  string   (required when targetType is 'lesson' or 'quiz')
 *   subjectId?: string   (optional — used to sharpen cache invalidation for courses)
 *
 * Effects:
 *   1. Validates the document exists.
 *   2. Sets status field on the Firestore document.
 *   3. Writes an auditLog entry in the same batch.
 *   4. Invalidates all relevant Redis cache keys.
 */
export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const body = await request.json();

    const { targetType, targetId, action, courseId, subjectId } = body as {
      targetType: PublishTarget;
      targetId: string;
      action: PublishAction;
      courseId?: string;
      subjectId?: string;
    };

    // ── Validation ────────────────────────────────────────────────────────────
    if (!targetType || !targetId || !action) {
      return NextResponse.json(
        { error: 'targetType, targetId, and action are required' },
        { status: 400 }
      );
    }

    const validTargets: PublishTarget[] = ['subject', 'course', 'lesson', 'quiz'];
    const validActions: PublishAction[] = ['publish', 'unpublish', 'archive'];

    if (!validTargets.includes(targetType)) {
      return NextResponse.json({ error: `Invalid targetType: ${targetType}` }, { status: 400 });
    }
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    if ((targetType === 'lesson' || targetType === 'quiz') && !courseId) {
      return NextResponse.json(
        { error: 'courseId is required when targetType is lesson or quiz' },
        { status: 400 }
      );
    }

    // ── Resolve Firestore document ref ───────────────────────────────────────
    let docRef: FirebaseFirestore.DocumentReference;

    switch (targetType) {
      case 'subject':
        docRef = adminDb.collection('subjects').doc(targetId);
        break;
      case 'course':
        docRef = adminDb.collection('courses').doc(targetId);
        break;
      case 'lesson':
        docRef = adminDb
          .collection('courses')
          .doc(courseId!)
          .collection('lessons')
          .doc(targetId);
        break;
      case 'quiz':
        docRef = adminDb.collection('quizzes').doc(targetId);
        break;
    }

    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { error: `${targetType} with id ${targetId} not found` },
        { status: 404 }
      );
    }

    // ── Status mapping ────────────────────────────────────────────────────────
    const statusMap: Record<PublishAction, string> = {
      publish: 'published',
      unpublish: 'draft',
      archive: 'archived',
    };
    const newStatus = statusMap[action];

    // ── Firestore batch: update + audit log ──────────────────────────────────
    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();

    batch.update(docRef, { status: newStatus, updatedAt: now });

    const auditRef = adminDb.collection('auditLogs').doc();
    batch.set(auditRef, {
      actorUid: profile.uid,
      actorEmail: profile.email ?? null,
      action: `${action}_${targetType}`,
      targetType,
      targetId,
      metadata: {
        previousStatus: doc.data()?.status ?? 'unknown',
        newStatus,
        courseId: courseId ?? null,
        subjectId: subjectId ?? null,
      },
      createdAt: now,
    });

    await batch.commit();

    // ── Redis cache invalidation ──────────────────────────────────────────────
    let keysToInvalidate: string[] = [];

    switch (targetType) {
      case 'subject':
        keysToInvalidate = subjectCacheKeys(targetId);
        break;
      case 'course':
        keysToInvalidate = courseCacheKeys(targetId, subjectId);
        break;
      case 'lesson':
        keysToInvalidate = lessonCacheKeys(courseId!);
        break;
      case 'quiz':
        // Quizzes don't have their own catalog cache, but course detail includes quiz count
        keysToInvalidate = courseId ? lessonCacheKeys(courseId) : [];
        break;
    }

    if (keysToInvalidate.length > 0) {
      await safeRedisCall(
        (client) => client.del(...keysToInvalidate),
        0
      );
      console.log(`[publish] Invalidated ${keysToInvalidate.length} cache keys:`, keysToInvalidate);
    }

    return NextResponse.json({
      targetType,
      targetId,
      action,
      newStatus,
      cacheKeysInvalidated: keysToInvalidate,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
