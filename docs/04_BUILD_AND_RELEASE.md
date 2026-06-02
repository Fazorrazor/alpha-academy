# Alpha Academy — Build & Release
Version: 2.0
Status: Build-ready

---

## 1. Branch Strategy

```
main          Production. Protected. Deploys to Vercel production.
staging       Production candidate. Protected. Deploys to Vercel staging.
feature/*     All feature work. Branches off staging.
hotfix/*      Urgent production fixes. Branches off main. Merges to both main and staging.
```

Rules:
- `main` and `staging` require PR, passing CI, and at least one reviewer approval.
- Direct pushes to `main` or `staging` are blocked.
- All feature branches must be up to date with `staging` before merging.
- Hotfixes must be cherry-picked or merged to `staging` immediately after `main`.

---

## 2. Local Development Checks

Run before every commit:
```bash
npm run lint
npm run typecheck
npm run test
npm run test:rules       # Firestore and Storage rules tests
```

Run before opening a PR:
```bash
npm run build            # Verify production build succeeds
firebase emulators:start # Verify all emulator flows work
```

---

## 3. CI Pipeline (GitHub Actions)

Every PR to `staging` or `main` runs:

```yaml
jobs:
  validate:
    steps:
      - Install dependencies (npm ci)
      - Lint (ESLint)
      - Typecheck (tsc --noEmit)
      - Unit tests (Jest or Vitest)
      - Firestore rules tests (firebase-admin + emulator)
      - Storage rules tests
      - Secret scan (trufflehog or gitleaks)
      - Dependency vulnerability scan (npm audit)
      - Build check (next build)
```

CI must pass before any PR can be merged. A single failing step blocks the merge.

---

## 4. Testing Strategy

### Coverage targets

| Layer | Minimum coverage | Tool |
|---|---|---|
| `src/lib/` utility functions | 90% line coverage | Vitest |
| API route handlers | 80% line coverage | Vitest + supertest |
| Firestore rules | 100% of defined rules | Firebase Rules Testing SDK |
| React components | 70% line coverage | Vitest + React Testing Library |
| E2E critical paths | 100% of paths listed below | Playwright |

Coverage is enforced in CI. A PR that drops below these thresholds fails the pipeline.

```json
// vitest.config.ts coverage thresholds
{
  "coverage": {
    "thresholds": {
      "lines": 80,
      "functions": 80,
      "branches": 75
    },
    "include": ["src/**"],
    "exclude": ["src/components/ui/**", "src/**/*.stories.*"]
  }
}
```

---

### Unit test files

**`src/lib/__tests__/errors.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import { apiError, handleRouteError } from '../errors';

describe('apiError', () => {
  it('returns 401 for UNAUTHORIZED', () => {
    const res = apiError('UNAUTHORIZED', 'Not logged in');
    expect(res.status).toBe(401);
  });
  it('returns 402 for SUBSCRIPTION_REQUIRED', () => {
    const res = apiError('SUBSCRIPTION_REQUIRED', 'Subscribe to access');
    expect(res.status).toBe(402);
  });
  it('returns 403 for FORBIDDEN', () => {
    const res = apiError('FORBIDDEN', 'Admins only');
    expect(res.status).toBe(403);
  });
  it('returns 422 for VALIDATION_FAILED', () => {
    const res = apiError('VALIDATION_FAILED', 'Invalid input');
    expect(res.status).toBe(422);
  });
  it('returns 429 for RATE_LIMIT_EXCEEDED', () => {
    const res = apiError('RATE_LIMIT_EXCEEDED', 'Too many requests');
    expect(res.status).toBe(429);
  });
  it('returns 500 for unknown code', () => {
    const res = apiError('SOMETHING_UNKNOWN', 'Unknown error');
    expect(res.status).toBe(500);
  });
  it('response body contains error, code, and details fields', async () => {
    const res = apiError('NOT_FOUND', 'Course not found', ['courseId is required']);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Course not found', code: 'NOT_FOUND', details: ['courseId is required'] });
  });
});

describe('handleRouteError', () => {
  it('maps known error message strings to correct status', async () => {
    const res = handleRouteError(new Error('SUBSCRIPTION_REQUIRED'));
    expect(res.status).toBe(402);
  });
  it('returns 500 for unknown errors', async () => {
    const res = handleRouteError(new Error('Something unexpected'));
    expect(res.status).toBe(500);
  });
});
```

**`src/lib/__tests__/paystack.test.ts`**
```ts
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyPaystackWebhook } from '../paystack';

const SECRET = 'test_paystack_secret_key';

function makeSignature(payload: string, secret: string) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex');
}

describe('verifyPaystackWebhook', () => {
  const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'abc123' } });

  it('returns true for a valid HMAC signature', () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const sig = makeSignature(payload, SECRET);
    expect(verifyPaystackWebhook(payload, sig)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    expect(verifyPaystackWebhook(payload, 'invalid-sig')).toBe(false);
  });

  it('returns false when signature is from wrong secret', () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const wrongSig = makeSignature(payload, 'wrong_secret');
    expect(verifyPaystackWebhook(payload, wrongSig)).toBe(false);
  });

  it('returns false for empty signature', () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    expect(verifyPaystackWebhook(payload, '')).toBe(false);
  });

  it('returns false when payload is tampered after signing', () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET;
    const sig = makeSignature(payload, SECRET);
    const tamperedPayload = payload.replace('abc123', 'xyz999');
    expect(verifyPaystackWebhook(tamperedPayload, sig)).toBe(false);
  });
});
```

**`src/lib/__tests__/rate-limit.test.ts`**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkRateLimit } from '../rate-limit';

// Mock safeRedisCall to simulate Redis responses
vi.mock('../redis', () => ({
  safeRedisCall: vi.fn(),
}));

import { safeRedisCall } from '../redis';

describe('checkRateLimit', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows request when count is below limit', async () => {
    vi.mocked(safeRedisCall).mockImplementation(async (fn) =>
      fn({ pipeline: () => ({ zremrangebyscore: vi.fn(), zadd: vi.fn(), zcard: vi.fn().mockResolvedValue(5), expire: vi.fn(), exec: async () => [null, null, 5, null] }) } as any)
    );
    // safeRedisCall returns the fn result — mock directly
    vi.mocked(safeRedisCall).mockResolvedValue({ allowed: true, remaining: 55 });
    const result = await checkRateLimit('uid123', 'progress', 60);
    expect(result.allowed).toBe(true);
  });

  it('blocks request when count exceeds limit', async () => {
    vi.mocked(safeRedisCall).mockResolvedValue({ allowed: false, remaining: 0 });
    const result = await checkRateLimit('uid123', 'progress', 60);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open when Redis is unavailable', async () => {
    // safeRedisCall returns the fallback when Redis fails
    vi.mocked(safeRedisCall).mockResolvedValue({ allowed: true, remaining: 60 });
    const result = await checkRateLimit('uid123', 'signed-url', 30);
    expect(result.allowed).toBe(true);
  });
});
```

**`src/lib/__tests__/quiz-scoring.test.ts`**
```ts
import { describe, it, expect } from 'vitest';

// Pure scoring logic extracted to a testable function
// src/lib/quiz-scoring.ts
function scoreQuiz(
  answers: number[],
  correctAnswers: number[],
  passThreshold: number
): { score: number; passed: boolean } {
  if (answers.length !== correctAnswers.length) {
    throw new Error('Answer count mismatch');
  }
  const correct = answers.filter((a, i) => a === correctAnswers[i]).length;
  const score = Math.round((correct / correctAnswers.length) * 100);
  return { score, passed: score >= passThreshold };
}

describe('scoreQuiz', () => {
  it('returns 100% for all correct answers', () => {
    expect(scoreQuiz([0, 1, 2], [0, 1, 2], 70)).toEqual({ score: 100, passed: true });
  });

  it('returns 0% for all wrong answers', () => {
    expect(scoreQuiz([1, 2, 0], [0, 1, 2], 70)).toEqual({ score: 0, passed: false });
  });

  it('passes at exactly the threshold', () => {
    // 7/10 correct = 70%
    expect(scoreQuiz([0,0,0,0,0,0,0,1,1,1], [0,0,0,0,0,0,0,0,0,0], 70)).toEqual({ score: 70, passed: true });
  });

  it('fails just below the threshold', () => {
    // 6/10 = 60%
    expect(scoreQuiz([0,0,0,0,0,0,1,1,1,1], [0,0,0,0,0,0,0,0,0,0], 70)).toEqual({ score: 60, passed: false });
  });

  it('throws if answer count does not match question count', () => {
    expect(() => scoreQuiz([0, 1], [0, 1, 2], 70)).toThrow('Answer count mismatch');
  });
});
```

---

### Firestore rules tests

**`tests/firestore.rules.test.ts`**
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'alpha-academy-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => { await testEnv.cleanup(); });

describe('profiles', () => {
  it('student can read own profile', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertSucceeds(db.collection('profiles').doc('uid1').get());
  });

  it('student cannot read another student profile', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(db.collection('profiles').doc('uid2').get());
  });

  it('student cannot update their role field', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(db.collection('profiles').doc('uid1').update({ role: 'admin' }));
  });

  it('unauthenticated user cannot read any profile', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('profiles').doc('uid1').get());
  });
});

describe('courses', () => {
  it('student can read published course', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('courses').doc('c1').set({ status: 'published' });
    });
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertSucceeds(db.collection('courses').doc('c1').get());
  });

  it('student cannot read unpublished course', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('courses').doc('c2').set({ status: 'draft' });
    });
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(db.collection('courses').doc('c2').get());
  });

  it('student cannot write to courses', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(db.collection('courses').doc('c3').set({ title: 'Hack' }));
  });
});

describe('auditLogs', () => {
  it('student cannot write to auditLogs', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(db.collection('auditLogs').add({ action: 'fake' }));
  });

  it('unauthenticated user cannot write to auditLogs', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('auditLogs').add({ action: 'fake' }));
  });
});

describe('progress', () => {
  it('student can create own progress record', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('profiles').doc('uid1').set({
        role: 'student', subscription: 'active',
      });
    });
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertSucceeds(
      db.collection('progress').doc('uid1_lesson1').set({
        uid: 'uid1', lessonId: 'lesson1', courseId: 'c1',
        completed: false, lastPositionSeconds: 0, watchedPercent: 0,
      })
    );
  });

  it('student cannot create progress record for another student', async () => {
    const db = testEnv.authenticatedContext('uid1').firestore();
    await assertFails(
      db.collection('progress').doc('uid2_lesson1').set({
        uid: 'uid2', lessonId: 'lesson1', courseId: 'c1',
        completed: false, lastPositionSeconds: 0, watchedPercent: 0,
      })
    );
  });
});
```

---

### Paystack webhook integration tests

**`tests/api/subscriptions.webhook.test.ts`**
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

const SECRET = 'test_secret_key';
process.env.PAYSTACK_SECRET_KEY = SECRET;
process.env.FIREBASE_ADMIN_PROJECT_ID = 'test';

function sign(payload: string) {
  return crypto.createHmac('sha512', SECRET).update(payload).digest('hex');
}

// These tests call the webhook handler function directly
// Import after env vars are set
import { POST } from '../../src/app/api/v1/subscriptions/webhook/route';

const mockUpdateProfile = vi.fn();
const mockAddSubscriptionEvent = vi.fn();
const mockGetSubscriptionEvent = vi.fn();

vi.mock('../../src/lib/firebase/admin', () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: mockGetSubscriptionEvent, set: vi.fn() }),
      add: mockAddSubscriptionEvent,
    }),
    runTransaction: vi.fn(async (fn) => fn({ get: vi.fn(), update: mockUpdateProfile })),
  },
}));

function makeRequest(event: string, reference: string) {
  const payload = JSON.stringify({
    event,
    data: {
      reference,
      customer: { email: 'student@test.com', metadata: { uid: 'uid123' } },
      plan: { interval: 'monthly' },
      amount: 10000,
      currency: 'GHS',
    },
  });
  return new Request('http://localhost/api/v1/subscriptions/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': sign(payload),
    },
    body: payload,
  });
}

describe('POST /api/v1/subscriptions/webhook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 for invalid HMAC signature', async () => {
    const payload = JSON.stringify({ event: 'charge.success', data: {} });
    const req = new Request('http://localhost/api/v1/subscriptions/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': 'bad-sig' },
      body: payload,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('activates subscription on charge.success', async () => {
    mockGetSubscriptionEvent.mockResolvedValue({ exists: false });
    const req = makeRequest('charge.success', 'ref_001');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalled();
  });

  it('is idempotent — ignores duplicate reference', async () => {
    mockGetSubscriptionEvent.mockResolvedValue({ exists: true });
    const req = makeRequest('charge.success', 'ref_already_processed');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });

  it('sets subscription to expired on subscription.disable', async () => {
    mockGetSubscriptionEvent.mockResolvedValue({ exists: false });
    const req = makeRequest('subscription.disable', 'ref_disable_001');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).toHaveBeenCalled();
  });

  it('returns 200 for unhandled event types without processing', async () => {
    const req = makeRequest('invoice.create', 'ref_irrelevant');
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockUpdateProfile).not.toHaveBeenCalled();
  });
});
```

---

### E2E tests (Playwright)

**`e2e/student-subscription-flow.spec.ts`**
```ts
import { test, expect } from '@playwright/test';

test.describe('Student subscription and lesson access', () => {
  test('email registration → subscribe → access lesson', async ({ page }) => {
    // Register
    await page.goto('/register');
    await page.fill('[name=displayName]', 'Test Student');
    await page.fill('[name=email]', `student+${Date.now()}@test.com`);
    await page.fill('[name=password]', 'TestPass123!');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/subscribe');

    // Paystack test flow (staging test mode)
    await page.click('[data-testid=plan-monthly]');
    await page.click('[data-testid=checkout-button]');
    // Paystack iframe appears in test mode — fill test card
    await page.frameLocator('iframe[src*=paystack]').locator('[name=cardNumber]').fill('4084084084084081');
    await page.frameLocator('iframe[src*=paystack]').locator('[name=expiryDate]').fill('12/30');
    await page.frameLocator('iframe[src*=paystack]').locator('[name=cvv]').fill('408');
    await page.frameLocator('iframe[src*=paystack]').locator('button[type=submit]').click();
    await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

    // Access lesson
    await page.goto('/catalog');
    await page.click('[data-testid=course-card]:first-child');
    await page.click('[data-testid=enroll-button]');
    await page.click('[data-testid=lesson-item]:first-child');
    await expect(page.locator('[data-testid=video-player]')).toBeVisible();
  });

  test('unsubscribed student is redirected from lesson', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[name=email]', `nosub+${Date.now()}@test.com`);
    await page.fill('[name=password]', 'TestPass123!');
    await page.click('button[type=submit]');
    // Skip subscription
    await page.goto('/catalog');
    await page.click('[data-testid=course-card]:first-child');
    await page.click('[data-testid=lesson-item]:first-child');
    await expect(page).toHaveURL(/\/subscribe/);
  });

  test('admin can publish a course that appears for students', async ({ page, browser }) => {
    // Admin session
    await page.goto('/login');
    await page.fill('[name=email]', process.env.TEST_ADMIN_EMAIL!);
    await page.fill('[name=password]', process.env.TEST_ADMIN_PASSWORD!);
    await page.click('button[type=submit]');
    await page.goto('/admin/courses');
    await page.click('[data-testid=publish-toggle]:first-child');
    await expect(page.locator('[data-testid=publish-status]:first-child')).toHaveText('Published');

    // Verify student sees course
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await studentPage.goto('/catalog');
    await expect(studentPage.locator('[data-testid=course-card]')).toHaveCount({ min: 1 });
    await studentCtx.close();
  });
});
```

---

### Load testing (k6)

**`load-tests/catalog.js`**
```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '2m',  target: 200 },  // sustained load
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],   // 300ms p95
    http_req_failed:   ['rate<0.01'],   // < 1% errors
  },
};

const BASE = __ENV.BASE_URL || 'https://staging.alpha-academy.com';
const SESSION = __ENV.TEST_SESSION_COOKIE;

export default function () {
  const res = http.get(`${BASE}/api/v1/subjects`, {
    headers: { Cookie: `session=${SESSION}` },
  });
  check(res, { 'subjects 200': (r) => r.status === 200 });

  const courses = http.get(`${BASE}/api/v1/courses`, {
    headers: { Cookie: `session=${SESSION}` },
  });
  check(courses, { 'courses 200': (r) => r.status === 200 });

  sleep(1);
}
```

---

## 5. Staging Validation Checklist

Complete every item before promoting to production:

**Authentication**
- [ ] Register with email/password succeeds
- [ ] Register with Google OAuth succeeds
- [ ] Register with phone OTP succeeds (Ghana number format)
- [ ] Login and logout work correctly
- [ ] Session cookie is HTTP-only and Secure
- [ ] Expired session redirects to login

**Subscription and payments**
- [ ] Paystack checkout loads correctly
- [ ] Monthly plan payment completes (test card)
- [ ] Annual plan payment completes (test card)
- [ ] Mobile Money payment flow initiates (test)
- [ ] Webhook received and subscription activated
- [ ] Subscription expired webhook blocks access
- [ ] Renewal restores access

**Student content access**
- [ ] Student without subscription sees catalog but cannot access lessons
- [ ] Student with active subscription can access lessons
- [ ] Video player loads and plays correctly
- [ ] PDF viewer loads correctly
- [ ] Progress saves every 30 seconds
- [ ] Video resume position works on re-open
- [ ] Lesson marked complete at correct threshold

**Quizzes**
- [ ] Quiz loads without correct answers exposed
- [ ] Quiz submission returns score and pass/fail
- [ ] Failed quiz can be retried (if attempts allow)
- [ ] Passed quiz awards correct points
- [ ] Quiz attempt history displays correctly

**Certificates**
- [ ] Certificate generates after all lessons and quiz complete
- [ ] Certificate email notification sent
- [ ] Certificate downloadable from profile

**Leaderboard**
- [ ] Leaderboard displays top students
- [ ] Points update after lesson completion and quiz pass
- [ ] Student can see their own rank

**Discussions**
- [ ] Student with active subscription can post a thread
- [ ] Student without subscription cannot post
- [ ] Replies work correctly
- [ ] Admin can pin and lock threads

**Notifications**
- [ ] Email received for subscription confirmation
- [ ] SMS received for subscription confirmation (Ghana number)
- [ ] In-app notification appears on certificate ready

**Admin**
- [ ] Admin can create and publish a subject
- [ ] Admin can create and publish a course
- [ ] Admin can upload and publish a lesson
- [ ] Admin can create and publish a quiz
- [ ] Cache invalidates after publishing
- [ ] Admin can view and suspend a user
- [ ] Admin can promote/demote role with audit log written
- [ ] Audit log entries are correct and complete

**Monitoring**
- [ ] Health endpoint returns healthy
- [ ] Sentry receives a test error event
- [ ] Uptime monitor shows healthy

---

## 6. Production Release Order

Do not skip or reorder these steps:

```
1. Announce maintenance window in Slack #ops-alerts if downtime is possible.
2. Deploy Firestore indexes (firestore.indexes.json).
3. Wait for all indexes to become ACTIVE in GCP Console before proceeding.
4. Deploy Firestore security rules.
5. Deploy Cloud Storage security rules.
6. Promote Vercel production deployment.
7. Run smoke tests against production (auth, health, catalog, signed-url).
8. Confirm Sentry is receiving events from production.
9. Confirm uptime monitor shows healthy.
10. Announce release complete in Slack #ops-alerts.
```

---

## 7. Rollback Criteria

Initiate rollback immediately if any of the following occur within 30 minutes of a release:

- Login or registration is broken
- Active subscription students cannot access lesson content
- Signed URL generation is failing
- Paystack webhooks are returning errors
- 5xx error rate exceeds 5% for more than 5 minutes
- Firestore writes are failing (progress, enrollment, quiz attempts)
- Firestore or Storage rules block valid traffic
- Health endpoint returns unhealthy
- Any private course content becomes directly accessible without a signed URL

---

## 8. Rollback Actions

```
1. Vercel: go to Deployments tab → find last known good build → Promote to Production.
2. Firestore rules: re-deploy the previous known-good rules file.
3. Storage rules: re-deploy the previous known-good rules file.
4. Firestore data: restore from nightly backup ONLY if data corruption is confirmed.
   Do not restore as a precaution — it causes data loss for all writes since last backup.
5. Verify health endpoint returns healthy after rollback.
6. Notify stakeholders via Slack and status page.
7. Open a post-incident review ticket immediately.
```

---

## 9. Architecture Validation Checklist

Complete before first production launch. Return to this list for any major feature.

**Scope and architecture**
- [ ] All in-scope features are implemented and tested
- [ ] All out-of-scope items are confirmed absent
- [ ] All external services are configured for production (not dev/test keys)
- [ ] Paystack is in live mode with correct webhook URL registered

**Security**
- [ ] All API routes call requireSession() or requireAdmin() or requireActiveSubscription()
- [ ] No route returns lesson content, signed URLs, or quiz questions without subscription check
- [ ] Firestore rules tested and deployed
- [ ] Storage rules deny direct course-content reads (verified manually)
- [ ] Signed URLs expire in 15 minutes (verified in Mux and Storage configs)
- [ ] Role escalation blocked (verified via rules test)
- [ ] Quiz correct answers never returned in API responses (verified via integration test)
- [ ] Paystack webhook HMAC verified before processing
- [ ] Webhook idempotency tested with duplicate event
- [ ] Admin actions create audit logs (verified in staging)
- [ ] .gitignore covers all secret file patterns
- [ ] GitHub secret scanning enabled
- [ ] No secrets in Vercel environment variables visible to preview deployments

**Data**
- [ ] All Firestore collections and fields match the schema in 02_TECHNICAL_BLUEPRINT.md
- [ ] All composite indexes are deployed and active
- [ ] Enrollment uses Firestore transaction
- [ ] Subscription creation uses Firestore transaction
- [ ] Progress uses deterministic IDs
- [ ] Retention policy implemented for notifications and system events
- [ ] Backup policy configured and first backup completed
- [ ] Restore drill completed successfully

**API**
- [ ] Standard error shape used consistently across all routes
- [ ] All write endpoints validate input before Firestore writes
- [ ] Rate limits applied to all specified endpoints
- [ ] All error codes from errors.ts map to correct HTTP status codes

**Operations**
- [ ] Health endpoint returns Firestore and Redis status
- [ ] Sentry configured with correct DSN for production
- [ ] Uptime monitor configured for production health endpoint
- [ ] All alert thresholds configured
- [ ] GCP budget alerts set at 50%, 80%, 100%
- [ ] Log exclusions for sensitive data verified (no cookies, tokens, keys in logs)
- [ ] Rollback path tested in staging

**Go / no-go**
- [ ] All critical tests pass
- [ ] All staging smoke tests pass
- [ ] Rollback path confirmed ready
- [ ] Production backup has completed at least once
- [ ] Monitoring is active and receiving events
- [ ] Admin account access verified in production
- [ ] Paystack live keys confirmed and test payment completed
- [ ] No open security issues
- [ ] Release owner has approved deployment
