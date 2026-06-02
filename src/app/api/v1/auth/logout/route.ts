// src/app/api/v1/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/errors';

export async function POST() {
  try {
    const response = NextResponse.json({ status: 'success' });
    
    // Clear the session cookie
    response.cookies.set('session', '', {
      maxAge: 0,
      path: '/',
    });
    
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
