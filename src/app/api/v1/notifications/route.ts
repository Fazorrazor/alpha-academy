// src/app/api/v1/notifications/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import { firestore } from 'firebase-admin';

export async function GET(request: Request) {
  try {
    const profile = await requireSession();

    const snapshot = await adminDb
      .collection('notifications')
      .where('uid', '==', profile.uid)
      .get();

    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Sort in-memory: oldest to newest or newest to oldest (newest first is standard for notifications)
    notifications.sort((a: any, b: any) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    return NextResponse.json({
      status: 'success',
      notifications,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireSession();
    const bodyJson = await request.json();
    const { notificationIds } = bodyJson;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return apiError('BAD_REQUEST', 'notificationIds array is required.');
    }

    const batch = adminDb.batch();
    
    // Validate ownership before adding to batch
    for (const id of notificationIds) {
      const notifRef = adminDb.collection('notifications').doc(id);
      const docSnap = await notifRef.get();
      
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data?.uid === profile.uid) {
          batch.update(notifRef, {
            read: true,
            updatedAt: firestore.Timestamp.now(),
          });
        }
      }
    }

    await batch.commit();

    return NextResponse.json({
      status: 'success',
      message: `${notificationIds.length} notifications marked as read.`,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
