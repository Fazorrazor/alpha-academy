// src/app/api/v1/enrollments/access/route.ts
import { NextResponse } from 'next/server';
import { firestore } from 'firebase-admin';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';

export async function POST(req: Request) {
  try {
    const profile = await requireSession();
    const body = await req.json();
    const { courseId } = body;

    if (!courseId) {
      return apiError('BAD_REQUEST', 'courseId is required');
    }

    const enrollmentId = `${profile.uid}_${courseId}`;
    const enrollmentRef = adminDb.collection('enrollments').doc(enrollmentId);

    // Save/merge the access timestamp in Firestore
    await enrollmentRef.set({
      lastAccessedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      status: 'success',
      message: 'Access timestamp updated successfully.',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
