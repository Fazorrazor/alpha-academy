import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * GET /api/v1/admin/quizzes/[quizId]
 * Returns full quiz metadata (admin-only, includes all fields).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await requireAdmin();
    const { quizId } = await params;

    const doc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json(doc.data());
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/v1/admin/quizzes/[quizId]
 * Updates quiz metadata fields.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await requireAdmin();
    const { quizId } = await params;
    const body = await request.json();

    const doc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const allowedFields = [
      'title', 'description', 'status', 'passThresholdPercent',
      'maxAttempts', 'timeLimitMinutes', 'completionPoints'
    ];

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    await adminDb.collection('quizzes').doc(quizId).update(updates);
    return NextResponse.json({ ...doc.data(), ...updates });
  } catch (error) {
    return handleRouteError(error);
  }
}
