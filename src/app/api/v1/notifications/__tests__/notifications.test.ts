// src/app/api/v1/notifications/__tests__/notifications.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getHandler, PATCH as patchHandler } from '../route';

const { mockSessionUserState, mockGetDocs, mockGetDoc, mockBatchCommit } = vi.hoisted(() => {
  return {
    mockSessionUserState: { user: null as Record<string, unknown> | null },
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockBatchCommit: vi.fn(),
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
      })),
    })),
    batch: vi.fn().mockImplementation(() => ({
      update: vi.fn(),
      commit: mockBatchCommit,
    })),
  },
}));

describe('Notifications API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
  });

  describe('GET /api/v1/notifications', () => {
    it('should fail with UNAUTHORIZED if session is missing', async () => {
      const req = new Request('http://localhost/api/v1/notifications');
      const res = await getHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return student notifications sorted by date descending', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'n_1',
            data: () => ({
              title: 'Old Notification',
              uid: 'user_123',
              createdAt: { seconds: 1000 },
            }),
          },
          {
            id: 'n_2',
            data: () => ({
              title: 'New Notification',
              uid: 'user_123',
              createdAt: { seconds: 2000 },
            }),
          },
        ],
      });

      const req = new Request('http://localhost/api/v1/notifications');
      const res = await getHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.notifications.length).toBe(2);
      expect(data.notifications[0].id).toBe('n_2'); // Newest first
    });
  });

  describe('PATCH /api/v1/notifications', () => {
    it('should mark notifications as read in a batch update', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'user_123',
          read: false,
        }),
      });

      const req = new Request('http://localhost/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ['n_1'] }),
      });

      const res = await patchHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should return error if payload is invalid', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      const req = new Request('http://localhost/api/v1/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await patchHandler(req);
      expect(res.status).toBe(400);
    });
  });
});
