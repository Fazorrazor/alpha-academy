import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { handleRouteError } from '@/lib/errors';

/**
 * POST /api/v1/admin/users/[uid]/suspend
 * Body: { suspended: boolean }
 * Toggles suspension state for a student account.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { uid } = await params;

    // Prevent self-suspension
    if (admin.uid === uid) {
      return NextResponse.json(
        { error: 'You cannot suspend your own account' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { suspended } = body;

    if (typeof suspended !== 'boolean') {
      return NextResponse.json(
        { error: 'suspended field must be a boolean' },
        { status: 400 }
      );
    }

    const profileRef = adminDb.collection('profiles').doc(uid);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = profileDoc.data();

    // Prevent suspending other admins
    if (profile?.role === 'admin') {
      return NextResponse.json(
        { error: 'Admin accounts cannot be suspended' },
        { status: 403 }
      );
    }

    await profileRef.update({
      suspended,
      updatedAt: new Date(),
    });

    return NextResponse.json({ uid, suspended });
  } catch (error) {
    return handleRouteError(error);
  }
}
