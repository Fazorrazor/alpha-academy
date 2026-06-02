import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as initializeHandler } from '../initialize/route';
import { POST as cancelHandler } from '../cancel/route';
import { POST as webhookHandler } from '../webhook/route';
import { POST as verifyHandler } from '../verify/route';

// Hoist mock references to run before vi.mock calls
const {
  mockInitializePaystackSubscription,
  mockCancelPaystackSubscription,
  mockSignature,
  mockDocUpdate,
  mockDocGet,
  mockEventDocGet,
  mockProfilesQueryGet,
  mockBatch,
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockCookiesMap,
  mockSessionUserState,
  mockDocGetState,
  mockEventDocGetState,
} = vi.hoisted(() => {
  const cookiesMap = new Map<string, string>();
  const sessionUserState: { user: Record<string, unknown> | null } = { user: null };
  const signature = { valid: true };
  const docGetState = { exists: false, data: {} as Record<string, unknown> };
  const eventDocGetState = { exists: false };
  const docUpdate = vi.fn().mockResolvedValue(undefined);

  const batchSet = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);

  const docGet = vi.fn().mockImplementation(() => Promise.resolve({
    exists: docGetState.exists,
    data: () => docGetState.data,
  }));

  const eventDocGet = vi.fn().mockImplementation(() => Promise.resolve({
    exists: eventDocGetState.exists,
  }));

  const profilesQueryGet = vi.fn().mockImplementation(() => Promise.resolve({
    empty: !docGetState.exists,
    docs: docGetState.exists
      ? [
          {
            id: 'user_123',
            ref: {
              update: docUpdate,
            },
          },
        ]
      : [],
  }));

  const batch = vi.fn().mockReturnValue({
    set: batchSet,
    update: batchUpdate,
    commit: batchCommit,
  });

  return {
    mockInitializePaystackSubscription: vi.fn().mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/mock-auth-url',
      reference: 'mock_ref_123',
      access_code: 'mock_access_code',
    }),
    mockCancelPaystackSubscription: vi.fn().mockResolvedValue(true),
    mockSignature: signature,
    mockDocUpdate: docUpdate,
    mockDocGetState: docGetState,
    mockDocGet: docGet,
    mockEventDocGetState: eventDocGetState,
    mockEventDocGet: eventDocGet,
    mockProfilesQueryGet: profilesQueryGet,
    mockBatchSet: batchSet,
    mockBatchUpdate: batchUpdate,
    mockBatchCommit: batchCommit,
    mockBatch: batch,
    mockCookiesMap: cookiesMap,
    mockSessionUserState: sessionUserState,
  };
});

// Configure hoisted mocks
vi.mock('next/headers', () => {
  return {
    cookies: () => {
      return Promise.resolve({
        get: (name: string) => {
          const val = mockCookiesMap.get(name);
          return val ? { value: val } : undefined;
        },
        set: (name: string, value: string) => {
          mockCookiesMap.set(name, value);
        },
        delete: (name: string) => {
          mockCookiesMap.delete(name);
        },
      });
    },
  };
});

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

vi.mock('@/lib/paystack', () => {
  return {
    verifyPaystackSignature: vi.fn().mockImplementation(() => mockSignature.valid),
    initializePaystackSubscription: mockInitializePaystackSubscription,
    cancelPaystackSubscription: mockCancelPaystackSubscription,
  };
});

vi.mock('@/lib/firebase/admin', () => {
  return {
    adminDb: {
      collection: vi.fn().mockImplementation((colName: string) => {
        if (colName === 'subscriptionEvents') {
          return {
            doc: vi.fn().mockReturnValue({
              get: mockEventDocGet,
            }),
          };
        }
        return {
          doc: vi.fn().mockReturnValue({
            get: mockDocGet,
            update: mockDocUpdate,
          }),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: mockProfilesQueryGet,
            }),
          }),
        };
      }),
      batch: mockBatch,
    },
  };
});

describe('Subscription API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesMap.clear();
    mockSessionUserState.user = null;
    mockSignature.valid = true;
    mockDocGetState.exists = false;
    mockDocGetState.data = {};
    mockEventDocGetState.exists = false;
  });

  describe('POST /api/v1/subscriptions/initialize', () => {
    it('should fail with UNAUTHORIZED if user session is invalid', async () => {
      mockSessionUserState.user = null;
      const req = new Request('http://localhost/api/v1/subscriptions/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly' }),
      });

      const res = await initializeHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return authorization url on successful init', async () => {
      mockSessionUserState.user = { uid: 'user_123', email: 'student@alpha.edu.gh' };
      const req = new Request('http://localhost/api/v1/subscriptions/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'monthly' }),
      });

      const res = await initializeHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.authorizationUrl).toBe('https://checkout.paystack.com/mock-auth-url');
      expect(data.reference).toBe('mock_ref_123');

      expect(mockInitializePaystackSubscription).toHaveBeenCalledWith(
        'student@alpha.edu.gh',
        expect.stringContaining('PLN_monthly'),
        expect.any(String),
        15000,
        expect.objectContaining({ uid: 'user_123', plan: 'monthly' })
      );
    });
  });

  describe('POST /api/v1/subscriptions/cancel', () => {
    it('should cancel subscription and update profile in firestore', async () => {
      mockSessionUserState.user = { uid: 'user_123', email: 'student@alpha.edu.gh' };
      mockDocGetState.exists = true;
      mockDocGetState.data = {
        uid: 'user_123',
        paystackSubscriptionCode: 'SUB_code_123',
      };

      const res = await cancelHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');

      expect(mockCancelPaystackSubscription).toHaveBeenCalledWith('SUB_code_123', 'mock_email_token');
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'cancelled',
          updatedAt: expect.any(Object),
        })
      );
    });
  });

  describe('POST /api/v1/subscriptions/webhook', () => {
    it('should reject requests with invalid signature', async () => {
      mockSignature.valid = false;
      const req = new Request('http://localhost/api/v1/subscriptions/webhook', {
        method: 'POST',
        headers: { 'x-paystack-signature': 'invalid' },
        body: JSON.stringify({ event: 'charge.success' }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should ignore duplicate events', async () => {
      mockSignature.valid = true;
      mockEventDocGetState.exists = true; // Event already exists in Db

      const req = new Request('http://localhost/api/v1/subscriptions/webhook', {
        method: 'POST',
        headers: { 'x-paystack-signature': 'valid-sig' },
        body: JSON.stringify({
          event: 'charge.success',
          data: { reference: 'ref_dup_123' },
        }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ignored');
    });

    it('should successfully update user profile to active and write event logs', async () => {
      mockSignature.valid = true;
      mockEventDocGetState.exists = false;
      mockDocGetState.exists = true; // User profile found for email search or metadata

      const req = new Request('http://localhost/api/v1/subscriptions/webhook', {
        method: 'POST',
        headers: { 'x-paystack-signature': 'valid-sig' },
        body: JSON.stringify({
          event: 'charge.success',
          data: {
            reference: 'ref_new_123',
            amount: 5000,
            currency: 'GHS',
            metadata: { uid: 'user_123', plan: 'annual' },
            customer: { email: 'student@alpha.edu.gh', customer_code: 'CUST_123' },
            subscription: { subscription_code: 'SUB_123' },
          },
        }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);

      // Verify batch commits
      expect(mockBatchSet).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          id: 'ref_new_123',
          uid: 'user_123',
          event: 'charge.success',
          amount: 5000,
          plan: 'annual',
        })
      );
      expect(mockBatchUpdate).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          subscription: 'active',
          subscriptionPlan: 'annual',
          paystackCustomerCode: 'CUST_123',
          paystackSubscriptionCode: 'SUB_123',
          subscriptionExpiresAt: expect.any(Object),
        })
      );
      expect(mockBatchCommit).toHaveBeenCalled();
    });

    it('should set subscription status to expired on subscription.disable event', async () => {
      mockSignature.valid = true;
      mockDocGetState.exists = true;

      const req = new Request('http://localhost/api/v1/subscriptions/webhook', {
        method: 'POST',
        headers: { 'x-paystack-signature': 'valid-sig' },
        body: JSON.stringify({
          event: 'subscription.disable',
          data: {
            subscription_code: 'SUB_123',
          },
        }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(200);
      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription: 'expired',
          updatedAt: expect.any(Object),
        })
      );
    });
  });

  describe('POST /api/v1/subscriptions/verify', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockSessionUserState.user = null;
    });

    it('should return UNAUTHORIZED if no session cookie exists', async () => {
      const req = new Request('http://localhost/api/v1/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: 'ref_123' }),
      });
      const res = await verifyHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return BAD_REQUEST if reference is missing', async () => {
      mockSessionUserState.user = { uid: 'user_123', email: 'test@example.com' };
      const req = new Request('http://localhost/api/v1/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const res = await verifyHandler(req);
      expect(res.status).toBe(400);
    });

    it('should successfully trigger mock webhook simulation in mock mode', async () => {
      mockSessionUserState.user = { uid: 'user_123', email: 'test@example.com' };
      
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const req = new Request('http://localhost/api/v1/subscriptions/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: 'ref_123', plan: 'monthly' }),
      });

      const res = await verifyHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.mockTriggered).toBe(true);

      expect(fetchSpy).toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
