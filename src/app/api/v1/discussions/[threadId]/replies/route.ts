// src/app/api/v1/discussions/[threadId]/replies/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import { firestore } from 'firebase-admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    await requireSession();
    const { threadId } = await params;

    if (!threadId) {
      return apiError('BAD_REQUEST', 'threadId is required');
    }

    const repliesSnap = await adminDb
      .collection('discussions')
      .doc(threadId)
      .collection('replies')
      .get();

    const replies = repliesSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort chronologically (oldest first)
    replies.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return aTime - bTime;
    });

    return NextResponse.json({
      status: 'success',
      replies,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const profile = await requireSession();

    // Enforce active subscription requirement
    if (profile.subscription !== 'active') {
      return apiError('FORBIDDEN', 'Active premium subscription required to reply to discussions.');
    }

    const { threadId } = await params;
    const bodyJson = await request.json();
    const { body } = bodyJson;

    if (!body || !body.trim()) {
      return apiError('BAD_REQUEST', 'Reply body cannot be empty.');
    }

    const threadRef = adminDb.collection('discussions').doc(threadId);
    const replyRef = threadRef.collection('replies').doc();

    const result = await adminDb.runTransaction(async (transaction) => {
      const threadDoc = await transaction.get(threadRef);
      if (!threadDoc.exists) {
        throw new Error('THREAD_NOT_FOUND');
      }

      const threadData = threadDoc.data() || {};
      if (threadData.isLocked) {
        throw new Error('THREAD_LOCKED');
      }

      const replyData = {
        id: replyRef.id,
        threadId,
        body: body.trim(),
        authorUid: profile.uid,
        authorName: profile.displayName || 'Anonymous Student',
        authorRole: profile.role || 'student',
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now(),
      };

      // 1. Create the reply document
      transaction.set(replyRef, replyData);

      // 2. Increment thread reply count
      transaction.update(threadRef, {
        replyCount: firestore.FieldValue.increment(1),
        updatedAt: firestore.Timestamp.now(),
      });

      // 3. Create a notification for the thread author if they are not the replier
      if (threadData.authorUid && threadData.authorUid !== profile.uid) {
        const notifRef = adminDb.collection('notifications').doc();
        transaction.set(notifRef, {
          id: notifRef.id,
          uid: threadData.authorUid,
          type: 'new_content',
          title: 'New reply to your thread',
          body: `${profile.displayName || 'A student'} replied to: "${threadData.title}"`,
          read: false,
          channels: ['in_app'],
          createdAt: firestore.Timestamp.now(),
        });
      }

      return replyData;
    });

    return NextResponse.json({
      status: 'success',
      reply: result,
    });
  } catch (error: any) {
    if (error.message === 'THREAD_NOT_FOUND') {
      return apiError('NOT_FOUND', 'Discussion thread not found.');
    }
    if (error.message === 'THREAD_LOCKED') {
      return apiError('FORBIDDEN', 'This discussion thread has been locked by an administrator.');
    }
    return handleRouteError(error);
  }
}
