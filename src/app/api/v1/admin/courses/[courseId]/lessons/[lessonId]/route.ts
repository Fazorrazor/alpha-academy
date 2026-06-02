import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * PATCH /api/v1/admin/courses/[courseId]/lessons/[lessonId]
 * Updates lesson metadata fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    await requireAdmin();
    const { courseId, lessonId } = await params;
    const body = await request.json();

    const lessonRef = adminDb
      .collection('courses')
      .doc(courseId)
      .collection('lessons')
      .doc(lessonId);

    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const allowedFields = [
      'title', 'description', 'type', 'order', 'status',
      'muxAssetId', 'muxPlaybackId', 'durationSeconds',
      'storagePath', 'completionPoints'
    ];

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    await lessonRef.update(updates);
    return NextResponse.json({ ...lessonDoc.data(), ...updates });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * DELETE /api/v1/admin/courses/[courseId]/lessons/[lessonId]
 * Deletes a lesson and decrements the course totalLessons count.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    await requireAdmin();
    const { courseId, lessonId } = await params;

    const lessonRef = adminDb
      .collection('courses')
      .doc(courseId)
      .collection('lessons')
      .doc(lessonId);

    const lessonDoc = await lessonRef.get();
    if (!lessonDoc.exists) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    await lessonRef.delete();

    // Decrement course lesson count
    const courseRef = adminDb.collection('courses').doc(courseId);
    await adminDb.runTransaction(async (tx) => {
      const courseDoc = await tx.get(courseRef);
      if (courseDoc.exists) {
        const current = courseDoc.data()?.totalLessons ?? 1;
        tx.update(courseRef, {
          totalLessons: Math.max(0, current - 1),
          updatedAt: new Date(),
        });
      }
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
