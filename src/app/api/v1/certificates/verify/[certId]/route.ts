// src/app/api/v1/certificates/verify/[certId]/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ certId: string }> }
) {
  try {
    const { certId } = await params;

    if (!certId) {
      return apiError('BAD_REQUEST', 'certId is required');
    }

    const certDoc = await adminDb.collection('certificates').doc(certId).get();

    if (!certDoc.exists) {
      return apiError('NOT_FOUND', 'Certificate credential not found.');
    }

    const data = certDoc.data();

    // Return only public certification data for verification
    return NextResponse.json({
      status: 'success',
      verification: {
        id: data?.id,
        courseTitle: data?.courseTitle,
        studentName: data?.studentName,
        issuedAt: data?.issuedAt,
        downloadUrl: data?.downloadUrl,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
