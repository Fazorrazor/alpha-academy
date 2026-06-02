import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * DELETE /api/v1/admin/quizzes/[quizId]/questions/[questionId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ quizId: string; questionId: string }> }
) {
  try {
    await requireAdmin();
    const { quizId, questionId } = await params;

    const ref = adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('questions')
      .doc(questionId);

    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    await ref.delete();
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
