import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as loginHandler } from '../login/route';
import { POST as logoutHandler } from '../logout/route';
import { GET as verifyHandler } from '../verify/route';

// Mock cookies storage
const mockCookies = new Map<string, string>();

vi.mock('next/headers', () => {
  return {
    cookies: () => {
      return Promise.resolve({
        get: (name: string) => {
          const val = mockCookies.get(name);
          return val ? { value: val } : undefined;
        },
        set: (name: string, value: string) => {
          mockCookies.set(name, value);
        },
        delete: (name: string) => {
          mockCookies.delete(name);
        },
      });
    },
  };
});

// Mock Firebase Admin SDK
const mockDocSet = vi.fn().mockResolvedValue(undefined);
let mockDocExists = false;
let mockProfileData: Record<string, unknown> = {};

const mockDocGet = vi.fn().mockImplementation(() => {
  return Promise.resolve({
    exists: mockDocExists,
    data: () => mockProfileData,
  });
});

const mockDocRef = {
  get: mockDocGet,
  set: mockDocSet,
};

vi.mock('@/lib/firebase/admin', () => {
  return {
    adminAuth: {
      verifyIdToken: vi.fn().mockImplementation((token: string) => {
        if (token === 'valid-token') {
          return Promise.resolve({
            uid: 'user_123',
            email: 'student@alpha.edu.gh',
            name: 'Kofi Mensah',
            picture: 'https://avatar.url',
          });
        }
        if (token === 'phone-token') {
          return Promise.resolve({
            uid: 'user_456',
            phone_number: '+233241234567',
          });
        }
        throw new Error('Invalid ID token');
      }),
      createSessionCookie: vi.fn().mockResolvedValue('mock-session-cookie-val'),
      verifySessionCookie: vi.fn().mockImplementation((cookie: string) => {
        if (cookie === 'mock-session-cookie-val') {
          return Promise.resolve({ uid: 'user_123' });
        }
        throw new Error('Invalid session cookie');
      }),
    },
    adminDb: {
      collection: vi.fn().mockImplementation(() => {
        return {
          doc: vi.fn().mockReturnValue(mockDocRef),
        };
      }),
    },
  };
});

describe('Authentication API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.clear();
    mockDocExists = false;
    mockProfileData = {};
  });

  describe('POST /api/v1/auth/login', () => {
    it('should fail with BAD_REQUEST if idToken is missing', async () => {
      const req = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe('BAD_REQUEST');
    });

    it('should create session cookie and new profile on first login', async () => {
      mockDocExists = false; // user profile does not exist yet
      const req = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid-token' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);

      // Verify cookies headers
      const setCookieHeader = res.headers.get('set-cookie');
      expect(setCookieHeader).toContain('session=mock-session-cookie-val');
      expect(setCookieHeader).toContain('HttpOnly');

      // Verify Firestore profile auto-creation was triggered
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user_123',
          email: 'student@alpha.edu.gh',
          displayName: 'Kofi Mensah',
          photoURL: 'https://avatar.url',
          role: 'student',
          subscription: 'none',
        })
      );
    });

    it('should populate phoneNumber for phone token logins', async () => {
      mockDocExists = false;
      const req = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'phone-token' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      expect(mockDocSet).toHaveBeenCalledWith(
        expect.objectContaining({
          uid: 'user_456',
          phoneNumber: '+233241234567',
          role: 'student',
          subscription: 'none',
        })
      );
    });

    it('should block logins for suspended accounts', async () => {
      mockDocExists = true;
      mockProfileData = {
        uid: 'user_123',
        email: 'student@alpha.edu.gh',
        role: 'student',
        subscription: 'none',
        suspended: true,
      };

      const req = new Request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: 'valid-token' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe('ACCOUNT_SUSPENDED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should clear the session cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const setCookieHeader = res.headers.get('set-cookie');
      expect(setCookieHeader).toContain('session=;');
    });
  });

  describe('GET /api/v1/auth/verify', () => {
    it('should return UNAUTHORIZED if session cookie is missing', async () => {
      const res = await verifyHandler();
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.code).toBe('UNAUTHORIZED');
    });

    it('should return user profile if session cookie is valid', async () => {
      // Set valid session cookie
      mockCookies.set('session', 'mock-session-cookie-val');
      mockDocExists = true;
      mockProfileData = {
        uid: 'user_123',
        email: 'student@alpha.edu.gh',
        displayName: 'Kofi Mensah',
        role: 'student',
        subscription: 'none',
      };

      const res = await verifyHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.uid).toBe('user_123');
      expect(data.profile.email).toBe('student@alpha.edu.gh');
      expect(data.profile.role).toBe('student');
    });
  });
});
