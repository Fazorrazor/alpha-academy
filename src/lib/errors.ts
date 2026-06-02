// src/lib/errors.ts
import { NextResponse } from 'next/server';

const STATUS_MAP: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  CONFLICT: 409,
  SUBSCRIPTION_REQUIRED: 402,
  ACCOUNT_SUSPENDED: 403,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: string,
  message: string,
  details: unknown[] = []
): NextResponse {
  return NextResponse.json(
    { error: message, code, details },
    { status: STATUS_MAP[code] ?? 500 }
  );
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof Error) {
    const code = err.message;
    if (STATUS_MAP[code]) return apiError(code, code);
  }
  console.error('Unhandled route error:', err);
  return apiError('INTERNAL_ERROR', 'An unexpected error occurred.');
}
