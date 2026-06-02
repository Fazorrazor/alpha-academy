// src/app/api/v1/leaderboard/me/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user session
    const profile = await requireSession();

    // 2. Fetch student's leaderboard document
    const myDocRef = adminDb.collection('leaderboard').doc(profile.uid);
    const myDoc = await myDocRef.get();

    if (!myDoc.exists) {
      // Fallback if the student has not earned any points yet
      return NextResponse.json({
        status: 'success',
        me: {
          uid: profile.uid,
          displayName: profile.displayName || 'Anonymous Student',
          photoURL: profile.photoURL || null,
          totalPoints: 0,
          coursesCompleted: 0,
          rank: 0,
        },
      });
    }

    const myData = myDoc.data() || {};
    const myPoints = myData.totalPoints || 0;

    // 3. Find rank dynamically using Firestore Count Aggregation query
    const countSnapshot = await adminDb
      .collection('leaderboard')
      .where('totalPoints', '>', myPoints)
      .count()
      .get();

    const rank = countSnapshot.data().count + 1;

    return NextResponse.json({
      status: 'success',
      me: {
        uid: profile.uid,
        displayName: myData.displayName || profile.displayName || 'Anonymous Student',
        photoURL: myData.photoURL || profile.photoURL || null,
        totalPoints: myPoints,
        coursesCompleted: myData.coursesCompleted || 0,
        rank,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
