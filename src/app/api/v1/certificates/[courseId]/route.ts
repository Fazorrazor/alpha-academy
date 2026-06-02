// src/app/api/v1/certificates/[courseId]/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const profile = await requireSession();
    const { courseId } = await params;

    if (!courseId) {
      return apiError('BAD_REQUEST', 'courseId parameter is required');
    }

    const certId = `${profile.uid}_${courseId}`;
    const certDoc = await adminDb.collection('certificates').doc(certId).get();

    if (!certDoc.exists) {
      return apiError('NOT_FOUND', 'Certificate not found for this course.');
    }

    return NextResponse.json({
      status: 'success',
      certificate: certDoc.data(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
