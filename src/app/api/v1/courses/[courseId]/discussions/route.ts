// src/app/api/v1/courses/[courseId]/discussions/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import { firestore } from 'firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const profile = await requireSession();
    const { courseId } = await params;
    
    // Parse query parameters
    const url = new URL(request.url);
    const lessonId = url.searchParams.get('lessonId');

    if (!courseId) {
      return apiError('BAD_REQUEST', 'courseId is required');
    }

    let query: any = adminDb.collection('discussions').where('courseId', '==', courseId);
    
    if (lessonId) {
      query = query.where('lessonId', '==', lessonId);
    }

    const snapshot = await query.get();
    const threads = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort in-memory: isPinned (descending), then createdAt (descending)
    threads.sort((a: any, b: any) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      status: 'success',
      threads,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const profile = await requireSession();
    
    // Enforce active subscription requirement
    if (profile.subscription !== 'active') {
      return apiError('FORBIDDEN', 'Active premium subscription required to participate in discussions.');
    }

    const { courseId } = await params;
    const bodyJson = await request.json();
    const { title, body, lessonId } = bodyJson;

    if (!title || !body) {
      return apiError('BAD_REQUEST', 'Title and body are required fields.');
    }

    const threadRef = adminDb.collection('discussions').doc();
    const threadData = {
      id: threadRef.id,
      courseId,
      lessonId: lessonId || null,
      title: title.trim(),
      body: body.trim(),
      authorUid: profile.uid,
      authorName: profile.displayName || 'Anonymous Student',
      authorRole: profile.role || 'student',
      replyCount: 0,
      isPinned: false,
      isLocked: false,
      createdAt: firestore.Timestamp.now(),
      updatedAt: firestore.Timestamp.now(),
    };

    await threadRef.set(threadData);

    return NextResponse.json({
      status: 'success',
      thread: threadData,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
