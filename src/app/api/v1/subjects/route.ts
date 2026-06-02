import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';
import { safeRedisCall } from '@/lib/redis';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache-keys';

/**
 * GET /api/v1/subjects
 *
 * - Admins see all subjects (any status).
 * - Students see only published subjects.
 * - Results cached in Redis for 1 hour (invalidated on publish/unpublish).
 */
export async function GET() {
  try {
    const profile = await requireSession();
    const isAdmin = profile.role === 'admin';
    const cacheKey = CACHE_KEYS.subjects();

    // Students get cached data; admins always get fresh data (they need to see drafts)
    if (!isAdmin) {
      const cached = await safeRedisCall(
        (client) => client.get<string>(cacheKey),
        null
      );
      if (cached) {
        return NextResponse.json(
          typeof cached === 'string' ? JSON.parse(cached) : cached,
          { headers: { 'X-Cache': 'HIT' } }
        );
      }
    }

    const query = isAdmin
      ? adminDb.collection('subjects').orderBy('order', 'asc')
      : adminDb.collection('subjects').where('status', '==', 'published').orderBy('order', 'asc');

    const snapshot = await query.get();
    const subjects = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    const payload = { subjects };

    // Cache for students only
    if (!isAdmin) {
      await safeRedisCall(
        (client) => client.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL.CATALOG }),
        null
      );
    }

    return NextResponse.json(payload, { headers: { 'X-Cache': 'MISS' } });
  } catch (error) {
    return handleRouteError(error);
  }
}
