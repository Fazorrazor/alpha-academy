// src/app/api/v1/enrollments/__tests__/enrollments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getEnrollmentsHandler, POST as enrollHandler } from '../route';

// Hoist mock references
const {
  mockSessionUserState,
  mockActiveSubState,
  mockDocGetState,
  mockEnrollmentExists,
  mockTransactionRun,
} = vi.hoisted(() => {
  const sessionUserState: { user: Record<string, unknown> | null } = { user: null };
  const activeSubState: { user: Record<string, unknown> | null } = { user: null };
  const docGetState = { exists: false, data: {} as Record<string, unknown> };
  const enrollmentExists = { exists: false };

  const transactionRun = vi.fn().mockImplementation(async (callback) => {
    const mockTx = {
      get: vi.fn().mockImplementation((ref) => {
        // If it's a course reference
        if (ref._path && ref._path.includes('courses/')) {
          return Promise.resolve({
            exists: docGetState.exists,
            data: () => docGetState.data,
          });
        }
        // If it's an enrollment reference
        return Promise.resolve({
          exists: enrollmentExists.exists,
        });
      }),
      set: vi.fn(),
      update: vi.fn(),
    };
    return await callback(mockTx);
  });

  return {
    mockSessionUserState: sessionUserState,
    mockActiveSubState: activeSubState,
    mockDocGetState: docGetState,
    mockEnrollmentExists: enrollmentExists,
    mockTransactionRun: transactionRun,
  };
});

// Configure standard header and cookies mock
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock('@/lib/firebase/auth-helper', () => {
  return {
    requireSession: vi.fn().mockImplementation(() => {
      if (!mockSessionUserState.user) {
        throw new Error('UNAUTHORIZED');
      }
      return Promise.resolve(mockSessionUserState.user);
    }),
    requireActiveSubscription: vi.fn().mockImplementation(() => {
      if (!mockActiveSubState.user) {
        throw new Error('SUBSCRIPTION_REQUIRED');
      }
      return Promise.resolve(mockActiveSubState.user);
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
              get: vi.fn().mockImplementation(() => {
                if (colName === 'enrollments') {
                  return Promise.resolve({
                    exists: mockEnrollmentExists.exists,
                  });
                }
                return Promise.resolve({
                  exists: mockDocGetState.exists,
                  data: () => mockDocGetState.data,
                });
              }),
            };
          }),
          where: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              docs: [
                {
                  id: 'enrollment_123',
                  data: () => ({ courseId: 'course_abc', enrolledAt: new Date() }),
                },
              ],
            }),
          }),
        };
      }),
      runTransaction: mockTransactionRun,
    },
  };
});

describe('Enrollments API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
    mockActiveSubState.user = null;
    mockDocGetState.exists = false;
    mockDocGetState.data = {};
    mockEnrollmentExists.exists = false;
  });

  describe('GET /api/v1/enrollments', () => {
    it('should fail with UNAUTHORIZED if user session is invalid', async () => {
      mockSessionUserState.user = null;
      const res = await getEnrollmentsHandler();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should retrieve student enrollments if session is valid', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      const res = await getEnrollmentsHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.enrollments).toHaveLength(1);
      expect(data.enrollments[0].id).toBe('enrollment_123');
    });
  });

  describe('POST /api/v1/enrollments', () => {
    it('should fail with SUBSCRIPTION_REQUIRED if user is not subscribed', async () => {
      mockActiveSubState.user = null;
      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'course_123' }),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(402);
      const data = await res.json();
      expect(data.code).toBe('SUBSCRIPTION_REQUIRED');
    });

    it('should fail with BAD_REQUEST if courseId is missing', async () => {
      mockActiveSubState.user = { uid: 'user_123', subscription: 'active' };
      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('BAD_REQUEST');
    });

    it('should fail with NOT_FOUND if the course does not exist', async () => {
      mockActiveSubState.user = { uid: 'user_123', subscription: 'active' };
      mockDocGetState.exists = false; // Course not found

      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'course_123' }),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.code).toBe('NOT_FOUND');
    });

    it('should fail with FORBIDDEN if the course is not published', async () => {
      mockActiveSubState.user = { uid: 'user_123', subscription: 'active' };
      mockDocGetState.exists = true;
      mockDocGetState.data = { status: 'draft' }; // Unpublished

      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'course_123' }),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should fail with CONFLICT if student is already enrolled', async () => {
      mockActiveSubState.user = { uid: 'user_123', subscription: 'active' };
      mockDocGetState.exists = true;
      mockDocGetState.data = { status: 'published' };
      mockEnrollmentExists.exists = true; // Already enrolled

      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'course_123' }),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.code).toBe('CONFLICT');
    });

    it('should successfully enroll student and write enrollment document', async () => {
      mockActiveSubState.user = { uid: 'user_123', subscription: 'active' };
      mockDocGetState.exists = true;
      mockDocGetState.data = { status: 'published' };
      mockEnrollmentExists.exists = false; // Not yet enrolled

      const req = new Request('http://localhost/api/v1/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'course_123' }),
      });

      const res = await enrollHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.enrollmentId).toBe('user_123_course_123');
    });
  });
});
