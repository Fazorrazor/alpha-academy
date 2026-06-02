import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const admin = await requireAdmin();

    const { courseId } = await params;

    // Fetch course
    const courseDoc = await adminDb.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Fetch lessons subcollection
    const lessonsSnapshot = await adminDb
      .collection('courses')
      .doc(courseId)
      .collection('lessons')
      .orderBy('order', 'asc')
      .get();
      
    const lessons = lessonsSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Fetch quizzes associated with this course
    const quizzesSnapshot = await adminDb
      .collection('quizzes')
      .where('courseId', '==', courseId)
      .get();
      
    const quizzes = quizzesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      course: { id: courseDoc.id, ...courseDoc.data() },
      lessons,
      quizzes
    });
  } catch (error: any) {
    console.error('Error fetching course curriculum:', error);
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
