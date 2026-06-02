import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const admin = await requireAdmin();

    const { courseId } = await params;
    const body = await request.json();

    if (!body.title || !body.description || typeof body.passThresholdPercent !== 'number') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newQuizRef = adminDb.collection('quizzes').doc();
    const timestamp = new Date();

    const newQuizData = {
      id: newQuizRef.id,
      courseId,
      lessonId: null, // Course-level quiz by default
      title: body.title,
      description: body.description,
      status: body.status || 'draft',
      passThresholdPercent: body.passThresholdPercent,
      maxAttempts: typeof body.maxAttempts === 'number' ? body.maxAttempts : 0,
      timeLimitMinutes: typeof body.timeLimitMinutes === 'number' ? body.timeLimitMinutes : null,
      completionPoints: typeof body.completionPoints === 'number' ? body.completionPoints : 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await newQuizRef.set(newQuizData);

    return NextResponse.json(newQuizData, { status: 201 });
  } catch (error: any) {
    console.error('Error creating quiz:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'PROFILE_NOT_FOUND' || error.message === 'ACCOUNT_SUSPENDED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
