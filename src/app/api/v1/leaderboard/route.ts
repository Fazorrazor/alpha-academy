// src/app/api/v1/leaderboard/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { safeRedisCall } from '@/lib/redis';
import { handleRouteError } from '@/lib/errors';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user session
    await requireSession();

    // 2. Check Redis cache first to avoid Firestore reads
    const cachedData = await safeRedisCall<string | null>(async (redis) => {
      return await redis.get('leaderboard:top50:v1');
    }, null);

    if (cachedData) {
      try {
        const top50 = JSON.parse(cachedData);
        return NextResponse.json({
          status: 'success',
          leaderboard: top50,
          cached: true,
        });
      } catch (err) {
        console.error('Failed to parse cached leaderboard JSON:', err);
      }
    }

    // 3. Cache miss: Query top 50 from Firestore
    const snapshot = await adminDb
      .collection('leaderboard')
      .orderBy('totalPoints', 'desc')
      .limit(50)
      .get();

    const top50 = snapshot.docs.map((doc, index) => {
      const data = doc.data();
      return {
        uid: doc.id,
        displayName: data.displayName || 'Anonymous Student',
        photoURL: data.photoURL || null,
        totalPoints: data.totalPoints || 0,
        coursesCompleted: data.coursesCompleted || 0,
        rank: index + 1,
        updatedAt: data.updatedAt,
      };
    });

    // 4. Save result in Redis cache with 5-minute TTL (300 seconds)
    await safeRedisCall(async (redis) => {
      await redis.setex('leaderboard:top50:v1', 300, JSON.stringify(top50));
    }, null);

    return NextResponse.json({
      status: 'success',
      leaderboard: top50,
      cached: false,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
