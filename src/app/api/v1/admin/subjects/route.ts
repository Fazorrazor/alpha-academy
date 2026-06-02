import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    // Fetch all subjects, including drafts, ordered by their specified order
    const snapshot = await adminDb.collection('subjects').orderBy('order', 'asc').get();
    
    // Map data and safely convert Firestore Timestamps to ISO strings for client consumption
    const subjects = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      };
    });

    return NextResponse.json({ subjects }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching admin subjects:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireAdmin();

    const body = await req.json();
    const { title, description, order, status } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const subjectRef = adminDb.collection('subjects').doc();
    const newSubject = {
      title,
      description,
      thumbnailUrl: null,
      status: status || 'draft',
      order: typeof order === 'number' ? order : 0,
      createdBy: profile.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const batch = adminDb.batch();
    batch.set(subjectRef, newSubject);

    // Write to audit log per Implementation Guide Phase 2 requirements
    const auditRef = adminDb.collection('auditLogs').doc();
    batch.set(auditRef, {
      actorUid: profile.uid,
      actorEmail: profile.email || null,
      action: 'create_subject',
      targetType: 'subject',
      targetId: subjectRef.id,
      metadata: { title, status },
      ipAddress: req.headers.get('x-forwarded-for') || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ 
      id: subjectRef.id, 
      ...newSubject, 
      // Return synthetic date strings so the client doesn't choke on FieldValue
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating subject:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
