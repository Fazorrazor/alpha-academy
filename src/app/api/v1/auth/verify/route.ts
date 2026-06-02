// src/app/api/v1/auth/verify/route.ts
import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/firebase/auth-helper';
import { handleRouteError } from '@/lib/errors';

export async function GET() {
  try {
    const profile = await requireSession();
    return NextResponse.json({ status: 'success', profile });
  } catch (error) {
    return handleRouteError(error);
  }
}
