// src/app/api/v1/leaderboard/__tests__/leaderboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as listHandler } from '../route';
import { GET as meHandler } from '../me/route';

// Hoist mock references
const { mockSessionUserState, mockGetDocs, mockGetDoc, mockRedisGet, mockRedisSetex } = vi.hoisted(() => {
  return {
    mockSessionUserState: { user: null as Record<string, unknown> | null },
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisSetex: vi.fn(),
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
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGetDocs,
      doc: vi.fn().mockImplementation((docId: string) => ({
        get: mockGetDoc,
      })),
      where: vi.fn().mockReturnThis(),
      count: vi.fn().mockImplementation(() => ({
        get: vi.fn().mockResolvedValue({
          data: () => ({ count: 5 }),
        }),
      })),
    })),
  },
}));

vi.mock('@/lib/redis', () => ({
  safeRedisCall: vi.fn().mockImplementation(async (fn) => {
    const mockRedis = {
      get: mockRedisGet,
      setex: mockRedisSetex,
    };
    return await fn(mockRedis);
  }),
}));

describe('Leaderboard API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
    mockRedisGet.mockResolvedValue(null);
  });

  describe('GET /api/v1/leaderboard', () => {
    it('should return unauthorized if session is missing', async () => {
      const req = new Request('http://localhost/api/v1/leaderboard');
      const res = await listHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return top 50 students from Firestore on cache miss', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'user_1',
            data: () => ({
              displayName: 'Alice',
              totalPoints: 100,
              coursesCompleted: 1,
            }),
          },
        ],
      });

      const req = new Request('http://localhost/api/v1/leaderboard');
      const res = await listHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.leaderboard.length).toBe(1);
      expect(data.leaderboard[0].displayName).toBe('Alice');
      expect(mockRedisSetex).toHaveBeenCalled();
    });

    it('should return cached data if present in Redis', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      const cachedList = [
        {
          uid: 'user_cache',
          displayName: 'Bob (Cached)',
          totalPoints: 200,
          coursesCompleted: 2,
          rank: 1,
        },
      ];
      mockRedisGet.mockResolvedValue(JSON.stringify(cachedList));

      const req = new Request('http://localhost/api/v1/leaderboard');
      const res = await listHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.leaderboard[0].displayName).toBe('Bob (Cached)');
      expect(mockGetDocs).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/leaderboard/me', () => {
    it('should return personal stats and rank using count query', async () => {
      mockSessionUserState.user = { uid: 'user_123', displayName: 'Charlie' };
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({
          displayName: 'Charlie',
          totalPoints: 80,
          coursesCompleted: 0,
        }),
      });

      const req = new Request('http://localhost/api/v1/leaderboard/me');
      const res = await meHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.me.totalPoints).toBe(80);
      expect(data.me.rank).toBe(6); // 5 users ahead + 1
    });

    it('should return rank 0 if student has no leaderboard entry yet', async () => {
      mockSessionUserState.user = { uid: 'user_123', displayName: 'Charlie' };
      mockGetDoc.mockResolvedValue({
        exists: false,
      });

      const req = new Request('http://localhost/api/v1/leaderboard/me');
      const res = await meHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.me.rank).toBe(0);
      expect(data.me.totalPoints).toBe(0);
    });
  });
});
