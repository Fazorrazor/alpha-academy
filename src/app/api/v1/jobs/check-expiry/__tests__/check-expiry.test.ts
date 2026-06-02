
// src/app/api/v1/jobs/check-expiry/__tests__/check-expiry.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as checkExpiryHandler } from '../route';

// Hoist mocks
const { mockGetDocs, mockBatchCommit, mockUpdate } = vi.hoisted(() => {
  return {
    mockGetDocs: vi.fn(),
    mockBatchCommit: vi.fn(),
    mockUpdate: vi.fn(),
  };
});

vi.mock('@/lib/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn().mockImplementation((colName: string) => ({
      where: vi.fn().mockReturnThis(),
      get: mockGetDocs,
      doc: vi.fn().mockImplementation(() => ({
        update: mockUpdate,
      })),
      add: vi.fn(),
    })),
    batch: vi.fn().mockImplementation(() => ({
      update: vi.fn(),
      set: vi.fn(),
      commit: mockBatchCommit,
    })),
  },
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: 'email_id' }),
}));

vi.mock('@/lib/sms', () => ({
  sendSMS: vi.fn().mockResolvedValue({ id: 'sms_id' }),
}));

describe('check-expiry job endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject requests without a correct Authorization header', async () => {
    const req = new Request('http://localhost/api/v1/jobs/check-expiry', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid_secret' },
    });
    const res = await checkExpiryHandler(req);
    expect(res.status).toBe(401);
  });

  it('should process expired subscriptions and trigger reminders', async () => {
    // 1. Mock first call (expired profiles query): returns 1 expired profile
    // 2. Mock second call (7-day reminder query): returns 1 profile due in 6 days
    // 3. Mock third call (1-day reminder query): returns 0 profiles
    mockGetDocs
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'user_expired_1',
            ref: { id: 'user_expired_1' },
            data: () => ({
              displayName: 'Expired Student',
              email: 'expired@gmail.com',
              phoneNumber: '+233240000000',
              subscription: 'active',
              subscriptionExpiresAt: { toMillis: () => Date.now() - 1000 },
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'user_7day_1',
            ref: { id: 'user_7day_1', update: mockUpdate },
            data: () => ({
              displayName: 'Renews Soon Student',
              email: 'soon7@gmail.com',
              subscription: 'active',
              remindersSent: [],
              subscriptionExpiresAt: { toMillis: () => Date.now() + 6 * 24 * 60 * 60 * 1000 },
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [],
      });

    const req = new Request('http://localhost/api/v1/jobs/check-expiry', {
      method: 'POST',
      headers: { Authorization: 'Bearer test_cron_secret' },
    });

    const res = await checkExpiryHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('success');
    expect(data.expiredCount).toBe(1);
    expect(data.sevenDayCount).toBe(1);
    expect(data.oneDayCount).toBe(0);

    expect(mockBatchCommit).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
  });
});
