import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const snapshot = await adminDb.collection('courses').orderBy('order', 'asc').get();
    
    const courses = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : null,
      };
    });

    return NextResponse.json({ courses }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching admin courses:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await requireAdmin();

    const body = await req.json();
    const { subjectTitle, title, description, status, order, tags, estimatedDurationMinutes } = body;

    if (!title || !description || !subjectTitle) {
      return NextResponse.json({ error: 'Parent subject, title, and description are required' }, { status: 400 });
    }

    const batch = adminDb.batch();
    
    // Find or create subject based on title
    let finalSubjectId = '';
    const subjectQuery = await adminDb.collection('subjects').where('title', '==', subjectTitle).limit(1).get();

    if (!subjectQuery.empty) {
      finalSubjectId = subjectQuery.docs[0].id;
    } else {
      // Create new subject on the fly
      const newSubjectRef = adminDb.collection('subjects').doc();
      finalSubjectId = newSubjectRef.id;
      batch.set(newSubjectRef, {
        title: subjectTitle,
        description: '', // Can be edited later by admin
        status: 'published',
        order: 0,
        createdBy: profile.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      // Audit log for on-the-fly subject creation
      const subjectAuditRef = adminDb.collection('auditLogs').doc();
      batch.set(subjectAuditRef, {
        actorUid: profile.uid,
        actorEmail: profile.email || null,
        action: 'create_subject_inline',
        targetType: 'subject',
        targetId: finalSubjectId,
        metadata: { title: subjectTitle },
        ipAddress: req.headers.get('x-forwarded-for') || null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const courseRef = adminDb.collection('courses').doc();
    const newCourse = {
      subjectId: finalSubjectId,
      title,
      description,
      thumbnailUrl: null,
      status: status || 'draft',
      order: typeof order === 'number' ? order : 0,
      totalLessons: 0,
      estimatedDurationMinutes: typeof estimatedDurationMinutes === 'number' ? estimatedDurationMinutes : 0,
      tags: Array.isArray(tags) ? tags : [],
      createdBy: profile.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    batch.set(courseRef, newCourse);

    const auditRef = adminDb.collection('auditLogs').doc();
    batch.set(auditRef, {
      actorUid: profile.uid,
      actorEmail: profile.email || null,
      action: 'create_course',
      targetType: 'course',
      targetId: courseRef.id,
      metadata: { title, subjectId: finalSubjectId, status },
      ipAddress: req.headers.get('x-forwarded-for') || null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ 
      id: courseRef.id, 
      ...newCourse, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating course:', error);
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (error.message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
