// src/app/api/v1/health/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { safeRedisCall } from '@/lib/redis';

export async function GET() {
  try {
    // 1. Ping Firestore (verify read operations)
    await adminDb.collection('_health').limit(1).get();

    // 2. Ping Redis (verify cache/rate limiter connection)
    const redisPing = await safeRedisCall(async (redis) => {
      return await redis.ping();
    }, 'PONG');

    return NextResponse.json({
      status: 'healthy',
      services: {
        firestore: 'connected',
        redis: redisPing === 'PONG' ? 'connected' : 'degraded',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
