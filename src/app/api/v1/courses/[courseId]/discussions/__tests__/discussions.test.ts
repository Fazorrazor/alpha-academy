// src/app/api/v1/courses/[courseId]/discussions/__tests__/discussions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as listThreadsHandler, POST as createThreadHandler } from '../route';
import { GET as listRepliesHandler, POST as createReplyHandler } from '../../../../discussions/[threadId]/replies/route';
import { PATCH as updateThreadHandler } from '../../../../discussions/[threadId]/route';

const { mockSessionUserState, mockGetDocs, mockGetDoc, mockTransactionRun } = vi.hoisted(() => {
  return {
    mockSessionUserState: { user: null as Record<string, unknown> | null },
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockTransactionRun: vi.fn(),
  };
});

vi.mock('@/lib/firebase/auth-helper', () => ({
  requireSession: vi.fn().mockImplementation(() => {
    if (!mockSessionUserState.user) {
      throw new Error('UNAUTHORIZED');
    }
    return Promise.resolve(mockSessionUserState.user);
  }),
}));

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => ({
      where: vi.fn().mockReturnThis(),
      get: mockGetDocs,
      doc: vi.fn().mockImplementation((docId: string) => ({
        get: mockGetDoc,
        update: vi.fn(),
        collection: vi.fn().mockImplementation(() => ({
          get: mockGetDocs,
          doc: vi.fn().mockImplementation(() => ({
            set: vi.fn(),
          })),
        })),
        set: vi.fn(),
      })),
    })),
    runTransaction: mockTransactionRun,
  },
}));

describe('Discussions API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
  });

  describe('GET /api/v1/courses/[courseId]/discussions', () => {
    it('should fail with UNAUTHORIZED if session is missing', async () => {
      const req = new Request('http://localhost/api/v1/courses/course_1/discussions');
      const res = await listThreadsHandler(req, { params: Promise.resolve({ courseId: 'course_1' }) });
      expect(res.status).toBe(401);
    });

    it('should return sorted threads for a course', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 't_1',
            data: () => ({
              title: 'First Thread',
              isPinned: false,
              createdAt: { seconds: 1000 },
            }),
          },
          {
            id: 't_2',
            data: () => ({
              title: 'Pinned Thread',
              isPinned: true,
              createdAt: { seconds: 2000 },
            }),
          },
        ],
      });

      const req = new Request('http://localhost/api/v1/courses/course_1/discussions');
      const res = await listThreadsHandler(req, { params: Promise.resolve({ courseId: 'course_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.threads.length).toBe(2);
      expect(data.threads[0].id).toBe('t_2'); // Pinned thread should be first
    });
  });

  describe('POST /api/v1/courses/[courseId]/discussions', () => {
    it('should prevent non-premium users from creating threads', async () => {
      mockSessionUserState.user = { uid: 'user_123', subscription: 'none' };
      const req = new Request('http://localhost/api/v1/courses/course_1/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Topic', body: 'Help!' }),
      });
      const res = await createThreadHandler(req, { params: Promise.resolve({ courseId: 'course_1' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should successfully create thread for premium users', async () => {
      mockSessionUserState.user = { uid: 'user_123', subscription: 'active', displayName: 'Kofi', role: 'student' };
      const req = new Request('http://localhost/api/v1/courses/course_1/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Topic', body: 'This is my discussion thread body content.' }),
      });
      const res = await createThreadHandler(req, { params: Promise.resolve({ courseId: 'course_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.thread.title).toBe('New Topic');
    });
  });

  describe('GET /api/v1/discussions/[threadId]/replies', () => {
    it('should fetch replies for thread', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'r_1',
            data: () => ({
              body: 'I agree',
              createdAt: { seconds: 1500 },
            }),
          },
        ],
      });

      const req = new Request('http://localhost/api/v1/discussions/t_1/replies');
      const res = await listRepliesHandler(req, { params: Promise.resolve({ threadId: 't_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.replies.length).toBe(1);
    });
  });

  describe('POST /api/v1/discussions/[threadId]/replies', () => {
    it('should create reply in a transaction', async () => {
      mockSessionUserState.user = { uid: 'user_123', subscription: 'active', displayName: 'Kofi' };
      
      mockTransactionRun.mockImplementation(async (callback) => {
        const mockTx = {
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              authorUid: 'user_other',
              title: 'Parent Thread Topic',
              isLocked: false,
            }),
          }),
          set: vi.fn(),
          update: vi.fn(),
        };
        return await callback(mockTx);
      });

      const req = new Request('http://localhost/api/v1/discussions/t_1/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Awesome answer!' }),
      });

      const res = await createReplyHandler(req, { params: Promise.resolve({ threadId: 't_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.reply.body).toBe('Awesome answer!');
    });
  });

  describe('PATCH /api/v1/discussions/[threadId]', () => {
    it('should fail with FORBIDDEN if user is not admin', async () => {
      mockSessionUserState.user = { uid: 'user_123', role: 'student' };
      const req = new Request('http://localhost/api/v1/discussions/t_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: true }),
      });
      const res = await updateThreadHandler(req, { params: Promise.resolve({ threadId: 't_1' }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('FORBIDDEN');
    });

    it('should successfully update thread pin/lock status if user is admin', async () => {
      mockSessionUserState.user = { uid: 'admin_123', role: 'admin' };
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({
          title: 'Mock Topic',
          isPinned: false,
          isLocked: false,
        }),
      });

      const req = new Request('http://localhost/api/v1/discussions/t_1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: true, isLocked: true }),
      });
      const res = await updateThreadHandler(req, { params: Promise.resolve({ threadId: 't_1' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.thread.isPinned).toBe(true);
      expect(data.thread.isLocked).toBe(true);
    });
  });
});
