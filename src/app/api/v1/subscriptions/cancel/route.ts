// src/app/api/v1/subscriptions/cancel/route.ts
import { NextResponse } from 'next/server';
import { firestore } from 'firebase-admin';
import { requireSession } from '@/lib/firebase/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { cancelPaystackSubscription } from '@/lib/paystack';
import { apiError, handleRouteError } from '@/lib/errors';
import type { UserProfile } from '@/lib/types';

export async function POST() {
  try {
    // 1. Authenticate user session
    const sessionProfile = await requireSession();

    // 2. Fetch full profile data from Firestore
    const profileRef = adminDb.collection('profiles').doc(sessionProfile.uid);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      return apiError('NOT_FOUND', 'User profile not found');
    }

    const profile = profileSnap.data() as UserProfile;

    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    const isMock = !secretKey || secretKey.startsWith('sk_test_mock') || process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true';

    // 3. Ensure they have a subscription code to cancel (unless in mock/emulator mode)
    if (!profile.paystackSubscriptionCode && !isMock) {
      return apiError('BAD_REQUEST', 'No active recurring subscription found to cancel');
    }

    // 4. Cancel recurring subscription on Paystack
    const subscriptionCode = profile.paystackSubscriptionCode || 'SUB_MOCK_123';
    const emailToken = 'mock_email_token';
    await cancelPaystackSubscription(subscriptionCode, emailToken);

    // 5. Update status in Firestore to 'cancelled'
    await profileRef.update({
      subscription: 'cancelled',
      updatedAt: firestore.Timestamp.now(),
    });

    return NextResponse.json({
      status: 'success',
      message: 'Subscription renewal has been cancelled successfully.',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
