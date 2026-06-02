# Alpha Academy — Technical Blueprint
Version: 2.0
Status: Build-ready

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend framework | Next.js 14+ App Router |
| Hosting | Vercel |
| Language | TypeScript (strict mode, no implicit any) |
| Auth | Firebase Auth (email/password, Google OAuth, phone OTP) |
| Server auth | Firebase Admin SDK |
| Database | Cloud Firestore |
| File storage | Cloud Storage (PDFs, certificates, public assets) |
| Video hosting | Mux or Cloudflare Stream |
| Cache + rate limiting | Upstash Redis |
| Payments | Paystack |
| Email | Resend (primary) or SendGrid |
| SMS + OTP | Termii (Ghana-focused) or Twilio |
| Error monitoring | Sentry |
| Uptime monitoring | Better Stack |
| CI/CD | GitHub Actions |
| CSS | Tailwind CSS |
| Component library | shadcn/ui |

---

## 2. Implementation Principles

1. Stateless API — no server memory, no local filesystem, no persistent background tasks in serverless functions.
2. Server-side authority — every security, subscription, and role decision happens on the server. Never trust the client.
3. Least privilege — each service account and API key has the minimum permissions required.
4. Defense in depth — middleware, API handlers, Firestore rules, Storage rules, and audit logs all enforce independently.
5. Subscription as a gate — no lesson, quiz, or certificate is accessible without an active, server-verified subscription.
6. Graceful degradation — Redis failure must never block a user from accessing content. Fail open on cache; fail closed on auth.
7. Webhook-driven access — Paystack webhooks are the authoritative source of subscription state changes.
8. Deterministic document IDs — enrollments use `{uid}_{courseId}`, progress uses `{uid}_{lessonId}`, quiz attempts use `{uid}_{quizId}_{timestamp}`.
9. Firestore transactions for all writes that check-then-write — enrollment, subscription creation, quota checks.
10. Short-lived signed URLs — all private media URLs expire in 15 minutes maximum.

---

## 3. Environment Variables

### Public (client-safe, NEXT_PUBLIC_ prefix)
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

### Private (server-only, never exposed to client)
```env
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

PAYSTACK_SECRET_KEY=
PAYSTACK_WEBHOOK_SECRET=

RESEND_API_KEY=
TERMII_API_KEY=
TERMII_SENDER_ID=

MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_SIGNING_KEY_ID=
MUX_SIGNING_PRIVATE_KEY=

CERTIFICATE_STORAGE_BUCKET=
NODE_ENV=
```

All environment variables must be validated at application startup, not at call sites. Any missing required variable must throw a startup error that prevents the application from serving traffic.

---

## 4. Project File Structure

```
alpha-academy/
├── src/
│   ├── app/
│   │   ├── (public)/               # Marketing, login, register, pricing
│   │   ├── (auth)/                 # Protected: dashboard, catalog, courses
│   │   │   ├── dashboard/
│   │   │   ├── catalog/
│   │   │   ├── courses/[courseId]/
│   │   │   │   ├── lessons/[lessonId]/
│   │   │   │   └── quizzes/[quizId]/
│   │   │   ├── certificates/
│   │   │   ├── leaderboard/
│   │   │   └── profile/
│   │   ├── admin/                  # Admin-only routes
│   │   │   ├── subjects/
│   │   │   ├── courses/
│   │   │   ├── lessons/
│   │   │   ├── quizzes/
│   │   │   ├── users/
│   │   │   └── subscriptions/
│   │   └── api/
│   │       └── v1/
│   │           ├── auth/
│   │           │   ├── login/
│   │           │   ├── logout/
│   │           │   └── verify/
│   │           ├── subjects/
│   │           ├── courses/
│   │           │   └── [courseId]/
│   │           │       └── lessons/
│   │           ├── enrollments/
│   │           ├── progress/
│   │           ├── signed-url/
│   │           ├── quizzes/
│   │           │   └── [quizId]/
│   │           │       └── attempts/
│   │           ├── certificates/
│   │           ├── leaderboard/
│   │           ├── discussions/
│   │           ├── notifications/
│   │           ├── subscriptions/
│   │           │   └── webhook/
│   │           ├── admin/
│   │           │   ├── publish/
│   │           │   ├── promote-role/
│   │           │   └── upload-asset/
│   │           └── health/
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts           # Firebase client SDK init
│   │   │   ├── admin.ts            # Firebase Admin SDK init
│   │   │   └── auth-helper.ts      # requireSession, requireAdmin, requireSubscription
│   │   ├── redis.ts                # Upstash Redis client + safeRedisCall
│   │   ├── paystack.ts             # Paystack client + webhook verification
│   │   ├── video.ts                # Mux/Cloudflare Stream signed URL helpers
│   │   ├── storage.ts              # Cloud Storage signed URL helpers
│   │   ├── email.ts                # Resend email dispatch helpers
│   │   ├── sms.ts                  # Termii SMS dispatch helpers
│   │   ├── certificates.ts         # Certificate PDF generation
│   │   ├── leaderboard.ts          # Leaderboard calculation helpers
│   │   ├── audit.ts                # writeAuditLog, writeSystemEvent
│   │   ├── errors.ts               # Standard API error factory
│   │   ├── rate-limit.ts           # Redis rate limiter wrapper
│   │   └── types.ts                # All TypeScript data types
│   ├── components/
│   │   ├── ui/                     # shadcn/ui base components
│   │   ├── layout/                 # Header, footer, sidebar, nav
│   │   ├── auth/                   # Login, register, OTP forms
│   │   ├── catalog/                # Subject cards, course cards, search
│   │   ├── lesson/                 # Video player, PDF viewer, progress bar
│   │   ├── quiz/                   # Quiz renderer, answer selector, results
│   │   ├── certificate/            # Certificate viewer and download
│   │   ├── leaderboard/            # Leaderboard table and student rank
│   │   ├── discussion/             # Thread list, comment form, replies
│   │   ├── subscription/           # Plan selector, Paystack checkout
│   │   ├── notifications/          # Notification bell, notification list
│   │   └── admin/                  # Admin-specific UI components
│   ├── hooks/                      # Custom React hooks
│   └── middleware.ts               # Route protection middleware
├── firestore.rules
├── storage.rules
├── firestore.indexes.json
├── firebase.json
└── .env.example
```

---

## 5. TypeScript Data Schema

```ts
// src/lib/types.ts

export type UserRole = 'student' | 'admin';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'trial' | 'none';
export type SubscriptionPlan = 'monthly' | 'annual';
export type PublishStatus = 'draft' | 'published' | 'archived';
export type ContentType = 'video' | 'pdf';
export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface UserProfile {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string;
  photoURL: string | null;
  role: UserRole;
  subscription: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionExpiresAt: Timestamp | null;
  paystackCustomerCode: string | null;
  paystackSubscriptionCode: string | null;
  totalPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  suspended: boolean;
}

export interface Subject {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublishStatus;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string; // admin uid
}

export interface Course {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: PublishStatus;
  order: number;
  totalLessons: number;
  estimatedDurationMinutes: number;
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  description: string;
  type: ContentType;
  order: number;
  status: PublishStatus;
  // Video
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  durationSeconds: number | null;
  // PDF
  storagePath: string | null;
  // Points
  completionPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Quiz {
  id: string;
  courseId: string;
  lessonId: string | null; // null = course-level quiz
  title: string;
  description: string;
  status: PublishStatus;
  passThresholdPercent: number; // e.g. 70
  maxAttempts: number; // 0 = unlimited
  timeLimitMinutes: number | null;
  completionPoints: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctOptionIndex: number; // never sent to client
  explanation: string | null;
  order: number;
}

export interface QuizAttempt {
  id: string; // {uid}_{quizId}_{timestamp}
  uid: string;
  quizId: string;
  courseId: string;
  answers: number[]; // selected option indices
  score: number; // percentage
  passed: boolean;
  pointsAwarded: number;
  startedAt: Timestamp;
  completedAt: Timestamp;
}

export interface Enrollment {
  id: string; // {uid}_{courseId}
  uid: string;
  courseId: string;
  enrolledAt: Timestamp;
  completedAt: Timestamp | null;
  certificateUrl: string | null;
}

export interface Progress {
  id: string; // {uid}_{lessonId}
  uid: string;
  lessonId: string;
  courseId: string;
  completed: boolean;
  lastPositionSeconds: number;
  watchedPercent: number;
  pointsAwarded: number;
  completedAt: Timestamp | null;
  updatedAt: Timestamp;
}

export interface Certificate {
  id: string; // {uid}_{courseId}
  uid: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  issuedAt: Timestamp;
  storagePath: string;
  downloadUrl: string;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  totalPoints: number;
  coursesCompleted: number;
  rank: number;
  updatedAt: Timestamp;
}

export interface DiscussionThread {
  id: string;
  courseId: string;
  lessonId: string | null; // null = course-level thread
  title: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DiscussionReply {
  id: string;
  threadId: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: string;
  uid: string;
  type: 'enrollment' | 'quiz_result' | 'certificate_ready' | 'new_content' | 'subscription_expiring' | 'subscription_expired' | 'payment_success' | 'payment_failed';
  title: string;
  body: string;
  read: boolean;
  channels: NotificationChannel[];
  createdAt: Timestamp;
}

export interface SubscriptionEvent {
  id: string;
  uid: string;
  paystackReference: string;
  event: string; // Paystack event type
  plan: SubscriptionPlan;
  amount: number; // in pesewas (GHS kobo equivalent)
  currency: string;
  status: 'success' | 'failed' | 'cancelled';
  createdAt: Timestamp;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Timestamp;
}

export interface SystemEvent {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Timestamp;
}
```

---

## 6. Firebase Admin Initialisation

```ts
// src/lib/firebase/admin.ts
import * as admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
  const privateKey = rawKey.replace(/\\n/g, '\n').replace(/\n/g, '\n');

  if (
    !process.env.FIREBASE_ADMIN_PROJECT_ID ||
    !process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    !privateKey
  ) {
    throw new Error('Missing Firebase Admin environment variables. Check FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminApp = initAdmin();
export const adminAuth = admin.auth(adminApp);
export const adminDb = admin.firestore(adminApp);
export const adminStorage = admin.storage(adminApp);
```

---

## 7. Auth Helpers

```ts
// src/lib/firebase/auth-helper.ts
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from './admin';
import type { UserProfile } from '../types';

export async function requireSession(): Promise<UserProfile> {
  const sessionCookie = cookies().get('session')?.value;
  if (!sessionCookie) throw new Error('UNAUTHORIZED');

  const claims = await adminAuth.verifySessionCookie(sessionCookie, true);

  const profileDoc = await adminDb.collection('profiles').doc(claims.uid).get();
  if (!profileDoc.exists) throw new Error('PROFILE_NOT_FOUND');

  const profile = profileDoc.data() as UserProfile;
  if (profile.suspended) throw new Error('ACCOUNT_SUSPENDED');

  return profile;
}

export async function requireAdmin(): Promise<UserProfile> {
  const profile = await requireSession();
  if (profile.role !== 'admin') throw new Error('FORBIDDEN');
  return profile;
}

export async function requireActiveSubscription(): Promise<UserProfile> {
  const profile = await requireSession();
  if (profile.role === 'admin') return profile; // admins bypass subscription check
  if (profile.subscription !== 'active') throw new Error('SUBSCRIPTION_REQUIRED');
  return profile;
}
```

---

## 8. Standard API Error Factory

```ts
// src/lib/errors.ts
import { NextResponse } from 'next/server';

const STATUS_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 422,
  NOT_FOUND: 404,
  RATE_LIMIT_EXCEEDED: 429,
  CONFLICT: 409,
  SUBSCRIPTION_REQUIRED: 402,
  ACCOUNT_SUSPENDED: 403,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: string,
  message: string,
  details: unknown[] = []
): NextResponse {
  return NextResponse.json(
    { error: message, code, details },
    { status: STATUS_MAP[code] ?? 500 }
  );
}

export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof Error) {
    const code = err.message;
    if (STATUS_MAP[code]) return apiError(code, code);
  }
  console.error('Unhandled route error:', err);
  return apiError('INTERNAL_ERROR', 'An unexpected error occurred.');
}
```

---

## 9. Redis Client

```ts
// src/lib/redis.ts
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redis;
}

export async function safeRedisCall<T>(
  fn: (client: Redis) => Promise<T>,
  fallback: T
): Promise<T> {
  const client = getRedis();
  if (!client) return fallback;
  try {
    return await fn(client);
  } catch (err) {
    console.warn('Redis call failed, using fallback:', err);
    return fallback;
  }
}
```

---

## 10. Rate Limiter

```ts
// src/lib/rate-limit.ts
import { safeRedisCall } from './redis';

export async function checkRateLimit(
  uid: string,
  endpoint: string,
  limitPerMinute: number
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate:user:${uid}:${endpoint}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 60;

  return safeRedisCall(async (redis) => {
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, windowStart);
    pipe.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    pipe.zcard(key);
    pipe.expire(key, 120);
    const results = await pipe.exec();
    const count = results[2] as number;
    return {
      allowed: count <= limitPerMinute,
      remaining: Math.max(0, limitPerMinute - count),
    };
  }, { allowed: true, remaining: limitPerMinute });
}
```

---

## 11. Paystack Integration

```ts
// src/lib/paystack.ts
import crypto from 'crypto';

export function verifyPaystackWebhook(
  payload: string,
  signature: string
): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(payload)
    .digest('hex');
  return hash === signature;
}

export async function paystackRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Paystack error: ${err.message}`);
  }
  return res.json();
}
```

---

## 12. Full API Endpoint Reference

### Authentication

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | /api/v1/auth/login | Public | 10/min | Exchange Firebase ID token for HTTP-only session cookie |
| POST | /api/v1/auth/logout | Public | — | Clear session cookie |
| GET | /api/v1/auth/verify | Session | — | Return uid, email, role, subscription status |

### Catalog

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/subjects | Session | — | List subjects (all for admin, published for students) |
| GET | /api/v1/courses | Session | — | List courses, optional ?subjectId= filter |
| GET | /api/v1/courses/:courseId | Session | — | Single course detail |
| GET | /api/v1/courses/:courseId/lessons | Active sub | — | List lessons for enrolled/admin |

### Student

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | /api/v1/enrollments | Active sub | 10/min | Enroll in course (transaction) |
| GET | /api/v1/enrollments | Session | — | List student's enrollments |
| POST | /api/v1/progress | Active sub | 60/min | Save lesson progress |
| GET | /api/v1/signed-url | Active sub | 30/min | Get 15-min signed URL for video or PDF |

### Quizzes

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/quizzes/:quizId | Active sub | — | Get quiz questions (no answers) |
| POST | /api/v1/quizzes/:quizId/attempts | Active sub | 5/min | Submit quiz attempt |
| GET | /api/v1/quizzes/:quizId/attempts | Session | — | Get student's attempt history |

### Certificates

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/certificates | Session | — | List student's certificates |
| GET | /api/v1/certificates/:courseId | Session | — | Get certificate for a course |

### Leaderboard

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/leaderboard | Session | — | Get top 50 students by points |
| GET | /api/v1/leaderboard/me | Session | — | Get current student's rank |

### Discussions

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/discussions | Active sub | — | List threads for a course/lesson |
| POST | /api/v1/discussions | Active sub | 5/min | Create a new thread |
| GET | /api/v1/discussions/:threadId/replies | Active sub | — | List replies |
| POST | /api/v1/discussions/:threadId/replies | Active sub | 10/min | Post a reply |

### Subscriptions

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | /api/v1/subscriptions/initialize | Session | 5/min | Create Paystack subscription checkout |
| GET | /api/v1/subscriptions/status | Session | — | Get current subscription status |
| POST | /api/v1/subscriptions/cancel | Session | 3/min | Cancel active subscription |
| POST | /api/v1/subscriptions/webhook | Public (HMAC verified) | — | Paystack webhook receiver |

### Admin

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| POST | /api/v1/admin/publish | Admin | — | Publish/unpublish subject, course, or lesson |
| POST | /api/v1/admin/promote-role | Admin | — | Change user role |
| POST | /api/v1/admin/upload-asset | Admin | — | Generate signed upload URL for video/PDF |
| GET | /api/v1/admin/users | Admin | — | List users with filters |
| POST | /api/v1/admin/users/:uid/suspend | Admin | — | Suspend or unsuspend student |

### System

| Method | Endpoint | Auth | Rate limit | Description |
|---|---|---|---|---|
| GET | /api/v1/health | Public | — | Firestore + Redis connectivity check |

---

## 13. Firestore Collections and Document Structure

```
profiles/{uid}
  uid, email, phoneNumber, displayName, photoURL, role,
  subscription, subscriptionPlan, subscriptionExpiresAt,
  paystackCustomerCode, paystackSubscriptionCode,
  totalPoints, suspended, createdAt, updatedAt

subjects/{subjectId}
  id, title, description, thumbnailUrl, status, order, createdAt, updatedAt, createdBy

courses/{courseId}
  id, subjectId, title, description, thumbnailUrl, status, order,
  totalLessons, estimatedDurationMinutes, tags, createdAt, updatedAt, createdBy

courses/{courseId}/lessons/{lessonId}
  id, courseId, title, description, type, order, status,
  muxAssetId, muxPlaybackId, durationSeconds,
  storagePath, completionPoints, createdAt, updatedAt

quizzes/{quizId}
  id, courseId, lessonId, title, description, status,
  passThresholdPercent, maxAttempts, timeLimitMinutes,
  completionPoints, createdAt, updatedAt

quizzes/{quizId}/questions/{questionId}
  id, quizId, question, options, correctOptionIndex, explanation, order
  NOTE: correctOptionIndex must NEVER be returned to client API responses

enrollments/{uid}_{courseId}
  id, uid, courseId, enrolledAt, completedAt, certificateUrl

progress/{uid}_{lessonId}
  id, uid, lessonId, courseId, completed, lastPositionSeconds,
  watchedPercent, pointsAwarded, completedAt, updatedAt

quizAttempts/{uid}_{quizId}_{timestamp}
  id, uid, quizId, courseId, answers, score, passed,
  pointsAwarded, startedAt, completedAt

certificates/{uid}_{courseId}
  id, uid, courseId, courseTitle, studentName, issuedAt,
  storagePath, downloadUrl

leaderboard/{uid}
  uid, displayName, photoURL, totalPoints, coursesCompleted, rank, updatedAt

discussions/{threadId}
  id, courseId, lessonId, title, body, authorUid, authorName,
  authorRole, replyCount, isPinned, isLocked, createdAt, updatedAt

discussions/{threadId}/replies/{replyId}
  id, threadId, body, authorUid, authorName, authorRole, createdAt, updatedAt

notifications/{notificationId}
  id, uid, type, title, body, read, channels, createdAt

subscriptionEvents/{eventId}
  id, uid, paystackReference, event, plan, amount, currency, status, createdAt

auditLogs/{autoId}
  id, actorUid, actorEmail, action, targetType, targetId,
  metadata, ipAddress, createdAt

systemEvents/{autoId}
  id, type, message, metadata, createdAt
```

---

## 14. Composite Firestore Indexes Required

```json
[
  { "collection": "courses", "fields": ["subjectId", "status", "order"] },
  { "collection": "courses/{id}/lessons", "fields": ["courseId", "status", "order"] },
  { "collection": "enrollments", "fields": ["uid", "enrolledAt"] },
  { "collection": "progress", "fields": ["uid", "courseId", "completed"] },
  { "collection": "quizAttempts", "fields": ["uid", "quizId", "completedAt"] },
  { "collection": "leaderboard", "fields": ["totalPoints", "updatedAt"] },
  { "collection": "discussions", "fields": ["courseId", "lessonId", "createdAt"] },
  { "collection": "discussions/{id}/replies", "fields": ["threadId", "createdAt"] },
  { "collection": "notifications", "fields": ["uid", "read", "createdAt"] },
  { "collection": "subscriptionEvents", "fields": ["uid", "createdAt"] }
]
```

---

## 15. Redis Cache Key Strategy

```
catalog:subjects:v1                          TTL: 1 hour
catalog:courses:published:v1                 TTL: 1 hour
catalog:courses:subject:{subjectId}:v1       TTL: 1 hour
lesson:list:{courseId}:v1                    TTL: 1 hour
leaderboard:top50:v1                         TTL: 5 minutes
rate:user:{uid}:{endpoint}                   TTL: 120 seconds (sliding window)
```

Cache invalidation triggers:
- Any publish/unpublish action → delete affected catalog keys
- Leaderboard update → delete leaderboard:top50:v1
- Never cache quiz answers, signed URLs, or subscription status

---

## 16. Video Delivery Architecture

All course videos are stored and delivered via Mux or Cloudflare Stream, not Cloud Storage directly.

Upload flow:
```
Admin requests upload URL → POST /api/v1/admin/upload-asset (type: video)
Server creates Mux upload URL
Admin uploads video directly to Mux
Mux transcodes to 360p, 480p, 720p, 1080p (adaptive HLS)
Mux webhook notifies upload complete
Server saves muxAssetId and muxPlaybackId to Firestore lesson document
```

Playback flow:
```
Student requests video → GET /api/v1/signed-url?courseId=X&lessonId=Y&type=video
Server verifies session + active subscription
Server generates Mux signed playback JWT (15-minute expiry)
Client initialises HLS video player with signed URL
Player adapts quality based on available bandwidth
```

This approach handles Ghana's variable mobile network conditions through adaptive bitrate streaming.

---

## 17. Notification System

### Email triggers (via Resend)
- Welcome email on registration
- Subscription payment confirmed
- Subscription payment failed
- Subscription expiring in 7 days and 1 day
- Subscription expired
- Course completion and certificate ready
- Quiz passed / failed
- New course published (optional digest)

### SMS triggers (via Termii)
- Phone OTP during registration
- Subscription payment confirmed (short)
- Subscription expiring in 1 day
- Subscription expired with renewal link

### In-app notification triggers
- New content published in an enrolled course
- Quiz result
- Certificate ready
- Discussion reply to your thread

All notifications are written to the `notifications/{id}` collection. Email and SMS dispatch happens server-side via API helpers, never from the client.

---

## 18. API Compatibility Rules

- Adding fields to responses: allowed without version bump.
- Removing or renaming fields: requires /api/v2/* route.
- Changing auth requirements: requires architecture review and migration plan.
- Changing error codes: requires deprecation notice and versioning.
- Frontend must never depend on undocumented response fields.
- Webhook handlers must be idempotent: Paystack may send duplicate events.

---

## 19. Tech Stack Reference (Illustrated)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER / CLIENT                         │
│                                                                 │
│  Next.js 14 App Router  ·  TypeScript  ·  Tailwind CSS          │
│  shadcn/ui components   ·  React Context (auth/session)         │
│  HLS.js (video player)  ·  React Hook Form  ·  Zod (validation) │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│                      VERCEL (hosting)                           │
│                                                                 │
│  Next.js API Route Handlers  ·  Edge Middleware                 │
│  Preview deployments per branch  ·  Instant rollback            │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────────┐
│Fire- │ │Cloud   │ │Upstash │ │Paystack│ │  Mux / Cloudflare  │
│base  │ │Firest- │ │Redis   │ │        │ │  Stream            │
│Auth  │ │ore     │ │        │ │GHS     │ │                    │
│      │ │        │ │Cache   │ │MoMo    │ │Video transcoding   │
│Email │ │Primary │ │Rate    │ │Cards   │ │Adaptive HLS        │
│Google│ │DB      │ │limits  │ │Bank    │ │Signed playback     │
│Phone │ │        │ │        │ │        │ │CDN delivery        │
│OTP   │ │        │ │        │ │Webhooks│ │                    │
└──────┘ └────────┘ └────────┘ └────────┘ └────────────────────┘
   │          │
   ▼          ▼
┌──────────────────┐   ┌──────────┐   ┌──────────┐   ┌─────────┐
│Cloud Storage     │   │Resend    │   │Termii    │   │Sentry   │
│                  │   │          │   │          │   │         │
│PDFs              │   │Email     │   │SMS +     │   │Error    │
│Certificates      │   │Transact- │   │Phone OTP │   │monitor  │
│Public assets     │   │ional     │   │Ghana     │   │Perf     │
│Signed URLs only  │   │          │   │numbers   │   │traces   │
└──────────────────┘   └──────────┘   └──────────┘   └─────────┘

BACKGROUND JOBS (Google Cloud)
┌────────────────────────────────────────────────────────────────┐
│  Cloud Scheduler → Cloud Functions                             │
│  · Nightly Firestore backup (02:00 UTC)                        │
│  · Daily subscription expiry check (03:00 UTC)                 │
│  · Renewal reminder dispatch (7-day and 1-day)                 │
│                                                                │
│  Event-triggered (Firestore onWrite)                           │
│  · Certificate generation on course completion                 │
│  · Leaderboard recalculation on points change                  │
└────────────────────────────────────────────────────────────────┘

CI/CD
┌────────────────────────────────────────────────────────────────┐
│  GitHub → GitHub Actions → Vercel                              │
│  feature/* → staging (preview) → main (production)            │
│  Every PR: lint · typecheck · unit tests · rules tests         │
│            secret scan · vuln scan · build check               │
└────────────────────────────────────────────────────────────────┘
```

### Why each tool was chosen

| Tool | Why this one | Why not alternatives |
|---|---|---|
| Next.js 14 App Router | Server components reduce client JS, API routes colocated, Vercel-native | Remix: less ecosystem; CRA: no SSR |
| TypeScript strict | Catches schema mismatches at build time, not runtime | JavaScript: too risky for financial/auth code |
| Tailwind CSS | Utility-first, consistent spacing, no CSS drift over time | CSS modules: verbose; Styled-components: runtime overhead |
| shadcn/ui | Accessible, unstyled base components, owned in your codebase | MUI: heavy; Chakra: opinionated theming |
| Firebase Auth | Native phone OTP for Ghana, Google OAuth built-in, Admin SDK for server sessions | Auth0: expensive at scale; Supabase Auth: less phone support in Ghana |
| Cloud Firestore | Flexible document model, real-time capable, Firebase ecosystem fit | PostgreSQL: needs separate hosting; MongoDB Atlas: extra cost layer |
| Cloud Storage | Same Google project as Firestore, signed URLs native, no egress to same-project Firestore | S3: cross-provider complexity; Supabase Storage: smaller ecosystem |
| Upstash Redis | Serverless-native REST API, no persistent connection needed in Vercel functions | Redis Cloud: requires persistent connections; Elasticache: AWS-only |
| Paystack | Ghana's leading processor, native MoMo support, subscription billing API, GHS native | Stripe: no Ghana MoMo; Flutterwave: weaker subscription billing API |
| Mux | Purpose-built video platform, HLS adaptive streaming, signed playback JWTs, upload webhooks | Cloudflare Stream: cheaper but less developer tooling; Vimeo: no signed URLs on lower plans |
| Resend | Modern email API, React Email templates, reliable delivery, generous free tier | SendGrid: complex UI; Mailgun: dated DX |
| Termii | Ghana and West Africa SMS coverage, phone OTP support, competitive pricing | Twilio: expensive for Ghana; Africa's Talking: less reliable OTP flow |
| Vercel | Next.js-native, instant rollback, preview deployments, zero config | AWS Amplify: complex; Netlify: weaker Next.js App Router support |
| Sentry | Best-in-class error grouping, performance tracing, source maps, Next.js SDK | Datadog: expensive; Rollbar: fewer Next.js integrations |
| React Hook Form + Zod | Performant uncontrolled forms, schema validation shared between client and server | Formik: slower re-renders; Yup: less TypeScript-native than Zod |
| HLS.js | Open source HLS player, works with Mux signed URLs, mobile-compatible | Video.js: heavier; native HTML5 video: no HLS on most browsers |

---

## 20. Frontend Design System

### Design tokens

All tokens are defined as Tailwind config extensions. Never hardcode colours or spacing values.

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1', // primary action colour
          600: '#4F46E5', // hover state
          700: '#4338CA', // active/pressed
          900: '#312E81', // text on light backgrounds
        },
        success: { DEFAULT: '#16A34A', light: '#DCFCE7', dark: '#14532D' },
        warning: { DEFAULT: '#D97706', light: '#FEF3C7', dark: '#78350F' },
        danger:  { DEFAULT: '#DC2626', light: '#FEE2E2', dark: '#7F1D1D' },
        neutral: {
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          400: '#9CA3AF',
          600: '#4B5563',
          800: '#1F2937',
          900: '#111827',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs:   ['12px', { lineHeight: '16px' }],
        sm:   ['14px', { lineHeight: '20px' }],
        base: ['16px', { lineHeight: '24px' }],
        lg:   ['18px', { lineHeight: '28px' }],
        xl:   ['20px', { lineHeight: '28px' }],
        '2xl':['24px', { lineHeight: '32px' }],
        '3xl':['30px', { lineHeight: '36px' }],
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        full: '9999px',
      },
      spacing: {
        // use 4px base grid: 1=4px, 2=8px, 3=12px, 4=16px, 6=24px, 8=32px
      },
    },
  },
};
```

### Typography scale

| Role | Size | Weight | Usage |
|---|---|---|---|
| Page title | 30px / 3xl | 700 | H1 on dashboard, catalog |
| Section heading | 24px / 2xl | 600 | H2 within a page |
| Card title | 18px / lg | 600 | Course card, lesson title |
| Body | 16px / base | 400 | Paragraphs, descriptions |
| Label | 14px / sm | 500 | Form labels, metadata |
| Caption | 12px / xs | 400 | Timestamps, secondary info |

### Component API standards

Every shared component must accept and forward standard props:

```ts
// Base pattern for all components
interface BaseProps {
  className?: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

// Example: Button
interface ButtonProps extends BaseProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  loading?: boolean;       // shows spinner, disables click
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  children: React.ReactNode;
}

// Example: Card
interface CardProps extends BaseProps {
  padding?: 'sm' | 'md' | 'lg';
  border?: boolean;
  shadow?: boolean;
  children: React.ReactNode;
}
```

### Loading state standards

Every data-fetching component must implement all three states. Never show a blank screen.

```tsx
// Standard pattern for all async components
export function CourseCard({ courseId }: { courseId: string }) {
  const { data, isLoading, error } = useCourse(courseId);

  // 1. Loading state — skeleton, never spinner for layout content
  if (isLoading) return <CourseCardSkeleton />;

  // 2. Error state — actionable message, never raw error string
  if (error) return (
    <ErrorCard
      message="Could not load this course."
      action={{ label: 'Try again', onClick: () => refetch() }}
    />
  );

  // 3. Empty state — only for lists/collections
  if (!data) return <EmptyState message="Course not found." />;

  // 4. Success state
  return <CourseCardContent course={data} />;
}
```

Loading state rules:
- Use skeleton components (matching the shape of real content) for cards, lists, and page sections.
- Use a spinner only for button loading states (form submit, checkout).
- Never show a loading spinner for full-page content — skeletons only.
- Skeleton components live in `src/components/ui/skeletons/`.

### Error state standards

```tsx
// src/components/ui/ErrorCard.tsx
// Used for inline section errors (not full page)
interface ErrorCardProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

// src/app/error.tsx
// Next.js App Router global error boundary — catches render errors
// Must include: friendly message + "Go back" button + Sentry.captureException()

// src/app/not-found.tsx
// 404 page — friendly message, link to catalog

// API error display rule:
// Never show raw error codes or stack traces to students.
// Map API error codes to friendly messages in a client-side helper:
const ERROR_MESSAGES: Record<string, string> = {
  SUBSCRIPTION_REQUIRED: 'You need an active subscription to access this content.',
  RATE_LIMIT_EXCEEDED:   'Too many requests. Please wait a moment and try again.',
  NOT_FOUND:             'This content could not be found.',
  FORBIDDEN:             'You do not have permission to do this.',
  INTERNAL_ERROR:        'Something went wrong. Please try again later.',
};
```

### State management pattern

Alpha Academy uses a layered state approach. No global state library (Redux, Zustand) is needed for the first build.

```
Layer 1 — Server state (React Query / SWR)
  Used for: all API data (courses, lessons, progress, leaderboard)
  Why: caching, background refetch, stale-while-revalidate, loading/error states built in
  Library: SWR (lighter) or TanStack Query (more control — recommended if quiz/progress invalidation is complex)

Layer 2 — Auth/session context (React Context)
  Used for: current user, role, subscription status
  Source: /api/v1/auth/verify on mount, refreshed on page focus
  Never store: ID tokens, session cookies (these are HTTP-only, invisible to JS)

Layer 3 — UI state (useState / useReducer)
  Used for: modal open/close, form steps, video player controls, quiz answer selections
  Scope: component-local only
  Never lift UI state to context unless 3+ unrelated components need it

Layer 4 — URL state (Next.js searchParams)
  Used for: catalog filters, pagination, active tab
  Why: shareable URLs, back button works correctly
```

```tsx
// src/contexts/AuthContext.tsx — session context pattern
interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isSubscribed: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

### Mobile-first responsive breakpoints

Ghana students are predominantly on mobile. Build mobile-first.

```
Default (no prefix): mobile — 320px and up
sm:  640px  — large phones / small tablets
md:  768px  — tablets
lg:  1024px — laptops
xl:  1280px — desktops
```

Rules:
- Every page layout must be fully usable at 320px width.
- Touch targets minimum 44×44px (buttons, nav links, quiz options).
- Video player must be full-width on mobile with native controls fallback.
- Navigation: hamburger menu on mobile, sidebar on lg and up.
- Tables: horizontal scroll wrapper on mobile, not truncation.
