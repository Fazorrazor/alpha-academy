// src/app/api/v1/enrollments/route.ts
import { NextResponse } from 'next/server';
import { firestore } from 'firebase-admin';
import { requireActiveSubscription, requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';

// GET /api/v1/enrollments
// Retrieves all enrollments for the logged-in student
export async function GET() {
  try {
    const profile = await requireSession();

    const snapshot = await adminDb
      .collection('enrollments')
      .where('studentId', '==', profile.uid)
      .get();

    const enrollments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      status: 'success',
      enrollments,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

// POST /api/v1/enrollments
// Enrolls the student in a specific course
export async function POST(req: Request) {
  try {
    // 1. Verify that the student has an active subscription
    const profile = await requireActiveSubscription();

    // 2. Parse courseId from body
    const body = await req.json();
    const { courseId } = body;
    if (!courseId) {
      return apiError('BAD_REQUEST', 'courseId is required');
    }

    const enrollmentId = `${profile.uid}_${courseId}`;
    const enrollmentRef = adminDb.collection('enrollments').doc(enrollmentId);
    const courseRef = adminDb.collection('courses').doc(courseId);

    // 3. Perform a secure Firestore transaction
    await adminDb.runTransaction(async (transaction) => {
      // Check if course exists and is published
      const courseDoc = await transaction.get(courseRef);
      if (!courseDoc.exists) {
        throw new Error('COURSE_NOT_FOUND');
      }

      const courseData = courseDoc.data();
      if (courseData?.status !== 'published') {
        throw new Error('COURSE_NOT_PUBLISHED');
      }

      // Check if already enrolled
      const enrollmentDoc = await transaction.get(enrollmentRef);
      if (enrollmentDoc.exists) {
        throw new Error('ALREADY_ENROLLED');
      }

      // Create enrollment document
      transaction.set(enrollmentRef, {
        id: enrollmentId,
        uid: profile.uid,
        studentId: profile.uid, // Required for matching client-side security rules
        courseId,
        enrolledAt: firestore.Timestamp.now(),
        completedAt: null,
        certificateUrl: null,
      });
    });

    return NextResponse.json({
      status: 'success',
      message: 'Successfully enrolled in course.',
      enrollmentId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'COURSE_NOT_FOUND') {
        return apiError('NOT_FOUND', 'The requested course does not exist');
      }
      if (error.message === 'COURSE_NOT_PUBLISHED') {
        return apiError('FORBIDDEN', 'This course is currently not published');
      }
      if (error.message === 'ALREADY_ENROLLED') {
        return apiError('CONFLICT', 'You are already enrolled in this course');
      }
    }
    return handleRouteError(error);
  }
}
