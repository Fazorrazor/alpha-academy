// src/app/api/v1/progress/__tests__/progress.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as progressHandler } from '../route';

// Hoist mock references
const {
  mockSessionUserState,
  mockProgressSnap,
  mockProfileSnap,
  mockTransactionRun,
} = vi.hoisted(() => {
  const sessionUserState: { user: Record<string, unknown> | null } = { user: null };
  const progressSnap = { exists: false, data: () => ({} as Record<string, unknown>) };
  const profileSnap = { exists: false, data: () => ({} as Record<string, unknown>) };

  const transactionRun = vi.fn().mockImplementation(async (callback) => {
    const mockTx = {
      get: vi.fn().mockImplementation((ref) => {
        if (ref._path && ref._path.includes('progress/')) {
          return Promise.resolve(progressSnap);
        }
        if (ref._path && ref._path.includes('profiles/')) {
          return Promise.resolve(profileSnap);
        }
        return Promise.resolve({ exists: false });
      }),
      set: vi.fn(),
      update: vi.fn(),
    };
    return await callback(mockTx);
  });

  return {
    mockSessionUserState: sessionUserState,
    mockProgressSnap: progressSnap,
    mockProfileSnap: profileSnap,
    mockTransactionRun: transactionRun,
  };
});

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock('@/lib/certificates', () => ({
  checkAndTriggerCourseCompletion: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/firebase/auth-helper', () => {
  return {
    requireSession: vi.fn().mockImplementation(() => {
      if (!mockSessionUserState.user) {
        throw new Error('UNAUTHORIZED');
      }
      return Promise.resolve(mockSessionUserState.user);
    }),
  };
});

vi.mock('@/lib/firebase/admin', () => {
  return {
    adminDb: {
      collection: vi.fn().mockImplementation((colName: string) => {
        return {
          doc: vi.fn().mockImplementation((docId: string) => {
            return {
              _path: `${colName}/${docId}`,
            };
          }),
        };
      }),
      runTransaction: mockTransactionRun,
    },
  };
});

describe('Progress API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
    mockProgressSnap.exists = false;
    mockProgressSnap.data = () => ({});
    mockProfileSnap.exists = false;
    mockProfileSnap.data = () => ({});
  });

  it('should fail with UNAUTHORIZED if session is invalid', async () => {
    mockSessionUserState.user = null;
    const req = new Request('http://localhost/api/v1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: 'l1', courseId: 'c1' }),
    });

    const res = await progressHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should fail with BAD_REQUEST if body is missing required fields', async () => {
    mockSessionUserState.user = { uid: 'user_123' };
    const req = new Request('http://localhost/api/v1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId: 'l1' }), // courseId missing
    });

    const res = await progressHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('BAD_REQUEST');
  });

  it('should successfully record progress without awarding points if not complete', async () => {
    mockSessionUserState.user = { uid: 'user_123' };
    mockProfileSnap.exists = true;
    mockProfileSnap.data = () => ({ uid: 'user_123', totalPoints: 50 });
    mockProgressSnap.exists = true;
    mockProgressSnap.data = () => ({ completed: false });

    const req = new Request('http://localhost/api/v1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'l1',
        courseId: 'c1',
        completed: false,
        lastPositionSeconds: 45,
        watchedPercent: 30,
      }),
    });

    const res = await progressHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.pointsAwarded).toBe(0);
  });

  it('should successfully record completion and award points on newly completed lesson', async () => {
    mockSessionUserState.user = { uid: 'user_123' };
    mockProfileSnap.exists = true;
    mockProfileSnap.data = () => ({ uid: 'user_123', totalPoints: 50, displayName: 'Kofi' });
    mockProgressSnap.exists = false; // Never completed before

    const req = new Request('http://localhost/api/v1/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId: 'l1',
        courseId: 'c1',
        completed: true,
        lastPositionSeconds: 180,
        watchedPercent: 95,
      }),
    });

    const res = await progressHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.pointsAwarded).toBe(10);
  });
});
