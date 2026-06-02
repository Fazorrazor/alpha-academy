// src/lib/firebase/auth-helper.ts
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from './admin';
import type { UserProfile } from '../types';

export async function requireSession(): Promise<UserProfile> {
  const sessionCookie = (await cookies()).get('session')?.value;
  if (!sessionCookie) throw new Error('UNAUTHORIZED');

  const claims = await adminAuth.verifySessionCookie(sessionCookie, true);

  const profileDoc = await adminDb.collection('profiles').doc(claims.uid).get();
  if (!profileDoc.exists) throw new Error('PROFILE_NOT_FOUND');

  const profile = profileDoc.data() as UserProfile;
  if (profile.suspended) throw new Error('ACCOUNT_SUSPENDED');

  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireSession();
  if (profile.role !== 'admin') throw new Error('FORBIDDEN');
  return profile;
}

export async function requireActiveSubscription(): Promise<UserProfile> {
  const profile = await requireSession();
  if (profile.role === 'admin') return profile; // Admins bypass subscription check
  if (profile.subscription !== 'active') throw new Error('SUBSCRIPTION_REQUIRED');
  return profile;
}
