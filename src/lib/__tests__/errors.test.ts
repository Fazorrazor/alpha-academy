import { describe, it, expect } from 'vitest';
import { apiError, handleRouteError } from '../errors';

describe('errors library', () => {
  it('should format apiError correctly', async () => {
    const res = apiError('UNAUTHORIZED', 'Missing token');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Missing token',
      code: 'UNAUTHORIZED',
      details: [],
    });
  });

  it('should fall back to internal error status code for unknown codes', async () => {
    const res = apiError('SOME_UNKNOWN_CODE', 'Something went wrong');
    expect(res.status).toBe(500);
  });

  it('should handle known route error names correctly', async () => {
    const err = new Error('FORBIDDEN');
    const res = handleRouteError(err);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });

  it('should handle generic route errors as internal error', async () => {
    const err = new Error('Database connection failed');
    const res = handleRouteError(err);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
