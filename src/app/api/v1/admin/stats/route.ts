import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/firebase/auth-helper';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    // Run aggregate count queries in parallel
    const [
      studentsSnap,
      subscriptionsSnap,
      coursesSnap,
      subjectsSnap
    ] = await Promise.all([
      adminDb.collection('profiles').where('role', '==', 'student').count().get(),
      adminDb.collection('profiles').where('subscription', '==', 'active').count().get(),
      adminDb.collection('courses').where('status', '==', 'published').count().get(),
      adminDb.collection('subjects').count().get()
    ]);

    const stats = {
      totalStudents: studentsSnap.data().count,
      activeSubscriptions: subscriptionsSnap.data().count,
      publishedCourses: coursesSnap.data().count,
      learningSubjects: subjectsSnap.data().count,
    };

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
