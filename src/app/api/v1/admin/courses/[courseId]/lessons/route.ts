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
    const { title, description, type, order, status, muxAssetId, muxPlaybackId, durationSeconds, storagePath, completionPoints } = body;

    if (!title || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newLessonRef = adminDb.collection('courses').doc(courseId).collection('lessons').doc();
    const timestamp = new Date();

    const newLessonData = {
      id: newLessonRef.id,
      courseId,
      title,
      description: description || '',
      type,
      order: typeof order === 'number' ? order : 0,
      status: status || 'draft',
      muxAssetId: muxAssetId || null,
      muxPlaybackId: muxPlaybackId || null,
      durationSeconds: durationSeconds || null,
      storagePath: storagePath || null,
      completionPoints: typeof completionPoints === 'number' ? completionPoints : 10,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await newLessonRef.set(newLessonData);

    // Update the course's totalLessons count and estimatedDurationMinutes if necessary
    const courseRef = adminDb.collection('courses').doc(courseId);
    await adminDb.runTransaction(async (transaction: any) => {
      const courseDoc = await transaction.get(courseRef);
      if (courseDoc.exists) {
        const data = courseDoc.data();
        const currentCount = data?.totalLessons || 0;
        transaction.update(courseRef, { 
          totalLessons: currentCount + 1,
          updatedAt: timestamp
        });
      }
    });

    return NextResponse.json(newLessonData, { status: 201 });
  } catch (error: any) {
    console.error('Error creating lesson:', error);
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
