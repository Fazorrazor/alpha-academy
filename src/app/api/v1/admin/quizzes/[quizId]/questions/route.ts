import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * GET /api/v1/admin/quizzes/[quizId]/questions
 * Returns all questions for a quiz (including correctOptionIndex for admin view).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await requireAdmin();
    const { quizId } = await params;

    const snapshot = await adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('questions')
      .orderBy('order', 'asc')
      .get();

    const questions = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json({ questions });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/v1/admin/quizzes/[quizId]/questions
 *
 * Body:
 *   question: string
 *   options: string[]        (2–6 choices)
 *   correctOptionIndex: number
 *   explanation?: string
 *   order?: number
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ quizId: string }> }
) {
  try {
    await requireAdmin();
    const { quizId } = await params;

    const body = await request.json();
    const { question, options, correctOptionIndex, explanation, order } = body;

    if (!question || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'question and at least 2 options are required' },
        { status: 400 }
      );
    }

    if (
      typeof correctOptionIndex !== 'number' ||
      correctOptionIndex < 0 ||
      correctOptionIndex >= options.length
    ) {
      return NextResponse.json(
        { error: 'correctOptionIndex must be a valid index within options array' },
        { status: 400 }
      );
    }

    // Verify the quiz exists
    const quizDoc = await adminDb.collection('quizzes').doc(quizId).get();
    if (!quizDoc.exists) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const questionsRef = adminDb
      .collection('quizzes')
      .doc(quizId)
      .collection('questions');

    // Auto-assign order if not provided (append at end)
    let resolvedOrder = order;
    if (typeof resolvedOrder !== 'number') {
      const countSnap = await questionsRef.count().get();
      resolvedOrder = countSnap.data().count;
    }

    const newRef = questionsRef.doc();
    const timestamp = new Date();

    const newQuestion = {
      id: newRef.id,
      quizId,
      question: question.trim(),
      options: options.map((o: string) => o.trim()),
      correctOptionIndex,
      explanation: explanation?.trim() || null,
      order: resolvedOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await newRef.set(newQuestion);

    return NextResponse.json(newQuestion, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
