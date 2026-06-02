// src/app/api/v1/certificates/__tests__/certificates.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as listHandler } from '../route';
import { GET as detailHandler } from '../[courseId]/route';
import { GET as verifyHandler } from '../verify/[certId]/route';

// Hoist mock references
const { mockSessionUserState, mockGetDocs, mockGetDoc } = vi.hoisted(() => {
  return {
    mockSessionUserState: { user: null as Record<string, unknown> | null },
    mockGetDocs: vi.fn(),
    mockGetDoc: vi.fn(),
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
  },
  adminStorage: {
    bucket: vi.fn().mockImplementation(() => ({
      name: 'mock-bucket',
    })),
  },
}));

describe('Certificates API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUserState.user = null;
  });

  describe('GET /api/v1/certificates', () => {
    it('should return unauthorized if session is missing', async () => {
      const req = new Request('http://localhost/api/v1/certificates');
      const res = await listHandler(req);
      expect(res.status).toBe(401);
    });

    it('should return list of certificates for active user', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'cert_1',
            data: () => ({
              uid: 'user_123',
              courseTitle: 'Introduction to Next.js',
              issuedAt: { seconds: 1622505600 },
            }),
          },
        ],
      });

      const req = new Request('http://localhost/api/v1/certificates');
      const res = await listHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.certificates.length).toBe(1);
    });
  });

  describe('GET /api/v1/certificates/[courseId]', () => {
    it('should return certificate if it exists', async () => {
      mockSessionUserState.user = { uid: 'user_123' };
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({
          uid: 'user_123',
          courseTitle: 'Introduction to Next.js',
        }),
      });

      const req = new Request('http://localhost/api/v1/certificates/course_nextjs');
      const res = await detailHandler(req, { params: Promise.resolve({ courseId: 'course_nextjs' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.certificate.courseTitle).toBe('Introduction to Next.js');
    });
  });

  describe('GET /api/v1/certificates/verify/[certId]', () => {
    it('should return public verification data without authentication', async () => {
      mockGetDoc.mockResolvedValue({
        exists: true,
        data: () => ({
          id: 'user_123_course_nextjs',
          uid: 'user_123', // Private field
          studentName: 'Kofi Mensah',
          courseTitle: 'Introduction to Next.js',
          issuedAt: { seconds: 1622505600 },
          downloadUrl: 'https://storage.googleapis.com/...',
        }),
      });

      const req = new Request('http://localhost/api/v1/certificates/verify/user_123_course_nextjs');
      const res = await verifyHandler(req, { params: Promise.resolve({ certId: 'user_123_course_nextjs' }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('success');
      expect(data.verification.studentName).toBe('Kofi Mensah');
      expect(data.verification.uid).toBeUndefined(); // Make sure uid is not exposed publicly
    });
  });
});
