// src/app/api/v1/certificates/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user session
    const profile = await requireSession();
    
    // 2. Fetch certificates for student
    const certsSnap = await adminDb
      .collection('certificates')
      .where('uid', '==', profile.uid)
      .get();
      
    const certificates = certsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // 3. Sort in-memory to prevent requiring composite indexes in Firestore
    certificates.sort((a: any, b: any) => {
      const aSec = a.issuedAt?.seconds || 0;
      const bSec = b.issuedAt?.seconds || 0;
      return bSec - aSec;
    });
    
    return NextResponse.json({
      status: 'success',
      certificates,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
