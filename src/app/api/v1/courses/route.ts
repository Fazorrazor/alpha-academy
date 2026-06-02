import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';
import { safeRedisCall } from '@/lib/redis';
import { CACHE_KEYS, CACHE_TTL } from '@/lib/cache-keys';

/**
 * GET /api/v1/courses
 * Optional query: ?subjectId=xxx
 *
 * - Admins see all statuses.
 * - Students see only published courses.
 * - Results cached per subjectId filter for 1 hour.
 */
export async function GET(request: Request) {
  try {
    const profile = await requireSession();
    const isAdmin = profile.role === 'admin';

    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subjectId') ?? undefined;

    const cacheKey = CACHE_KEYS.courses(subjectId);

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

    let query: FirebaseFirestore.Query = adminDb.collection('courses').orderBy('order', 'asc');

    if (!isAdmin) {
      query = query.where('status', '==', 'published');
    }
    if (subjectId) {
      query = query.where('subjectId', '==', subjectId);
    }

    const snapshot = await query.get();
    const courses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      };
    });

    const payload = { courses };

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
