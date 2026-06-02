// src/app/api/v1/auth/login/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { firestore } from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { apiError, handleRouteError } from '@/lib/errors';
import type { UserProfile } from '@/lib/types';

const loginSchema = z.object({
  idToken: z.string().min(1, 'ID Token is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return apiError(
        'BAD_REQUEST',
        'Invalid request payload',
        result.error.issues.map((e) => e.message)
      );
    }

    const { idToken } = result.data;

    // Verify ID token
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Create session cookie (expires in 14 days)
    const expiresIn = 14 * 24 * 60 * 60 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Check if profile exists in Firestore, if not create one
    const profileRef = adminDb.collection('profiles').doc(uid);
    const profileSnap = await profileRef.get();
    let profile: UserProfile;

    if (!profileSnap.exists) {
      profile = {
        uid,
        email: decodedToken.email || null,
        phoneNumber: decodedToken.phone_number || null,
        displayName: decodedToken.name || '',
        photoURL: decodedToken.picture || null,
        role: 'student',
        subscription: 'none',
        subscriptionPlan: null,
        subscriptionExpiresAt: null,
        paystackCustomerCode: null,
        paystackSubscriptionCode: null,
        totalPoints: 0,
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now(),
        suspended: false,
      };

      await profileRef.set(profile);
    } else {
      profile = profileSnap.data() as UserProfile;
      if (profile.suspended) {
        return apiError('ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact support.');
      }
    }

    const response = NextResponse.json({ status: 'success', profile });

    // Set HTTP-only secure session cookie
    response.cookies.set('session', sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
