// src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/privacy',
  '/terms',
];

const PUBLIC_API_PATHS = [
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/subscriptions/webhook',
  '/api/v1/health',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  // Allow static files, image optimization, and next internal files to bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  const isPublicUI = PUBLIC_PATHS.some((path) => pathname === path);
  const isPublicAPI = PUBLIC_API_PATHS.some((path) => pathname.startsWith(path));

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    if (isPublicAPI) {
      return NextResponse.next();
    }
    // Protected API route requires session cookie
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Handle UI routes
  if (!sessionCookie) {
    // Unauthenticated user trying to access a protected page
    if (!isPublicUI) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  } else {
    // Authenticated user trying to access login/register pages
    if (pathname === '/login' || pathname === '/register') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files or assets.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
