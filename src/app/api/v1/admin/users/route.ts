import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * GET /api/v1/admin/users
 * Lists all user profiles with pagination.
 * Query params: ?limit=20&page=1&search=email&subscription=active|expired|none|all
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10);
    const subscription = searchParams.get('subscription') ?? 'all';

    let query: FirebaseFirestore.Query = adminDb.collection('profiles')
      .orderBy('createdAt', 'desc')
      .limit(limitParam);

    if (subscription !== 'all') {
      query = adminDb.collection('profiles')
        .where('subscription', '==', subscription)
        .orderBy('createdAt', 'desc')
        .limit(limitParam);
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        role: data.role,
        subscription: data.subscription,
        subscriptionPlan: data.subscriptionPlan,
        subscriptionExpiresAt: data.subscriptionExpiresAt,
        totalPoints: data.totalPoints,
        suspended: data.suspended,
        createdAt: data.createdAt,
      };
    });

    return NextResponse.json({ users, total: users.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
