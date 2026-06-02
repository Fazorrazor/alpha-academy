// src/app/api/v1/discussions/[threadId]/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import { firestore } from 'firebase-admin';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const profile = await requireSession();

    // 1. Restrict update of pin/lock states to administrator accounts
    if (profile.role !== 'admin') {
      return apiError('FORBIDDEN', 'Administrative privileges are required to moderate topics.');
    }

    const { threadId } = await params;
    if (!threadId) {
      return apiError('BAD_REQUEST', 'threadId is required.');
    }

    const bodyJson = await request.json();
    const { isPinned, isLocked } = bodyJson;

    const threadRef = adminDb.collection('discussions').doc(threadId);
    const threadDoc = await threadRef.get();

    if (!threadDoc.exists) {
      return apiError('NOT_FOUND', 'Discussion thread not found.');
    }

    const updates: Record<string, any> = {
      updatedAt: firestore.Timestamp.now(),
    };

    if (isPinned !== undefined) {
      updates.isPinned = !!isPinned;
    }
    if (isLocked !== undefined) {
      updates.isLocked = !!isLocked;
    }

    await threadRef.update(updates);

    return NextResponse.json({
      status: 'success',
      thread: {
        id: threadId,
        ...threadDoc.data(),
        ...updates,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
