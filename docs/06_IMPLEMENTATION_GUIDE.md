# Alpha Academy — Implementation Guide
Version: 2.0
Status: Build-ready — living document, updated per phase

---

## How to use this document

This is the build journal for Alpha Academy. Each phase has a goal, a prerequisite checklist, an ordered task list, and a done definition. Work through phases in order. Do not start a phase until the previous phase's done definition is fully satisfied.

---

## Phase 0 — Project Setup and Environment

**Goal**: A running Next.js project connected to all external services in development mode, with emulators, environment variables, and CI in place.

**Prerequisites**: None.

### Tasks

1. **Initialise Next.js project**
   ```bash
   npx create-next-app@latest alpha-academy \
     --typescript --tailwind --eslint --app --src-dir
   cd alpha-academy
   ```

2. **Install dependencies**
   ```bash
   npm install firebase firebase-admin @upstash/redis
   npm install @mux/mux-node
   npm install resend
   npm install -D firebase-tools vitest @vitejs/plugin-react
   npx shadcn-ui@latest init
   ```

3. **Create Firebase projects**
   - Create `alpha-academy-dev`, `alpha-academy-staging`, `alpha-academy-prod` in Firebase Console.
   - For each: enable Firebase Auth (email/password, Google, phone), Firestore (production mode), Cloud Storage.
   - Generate Admin SDK service account JSON for each project.
   - Store credentials securely outside the repository.

4. **Configure environment variables**
   - Copy `.env.example` to `.env.local`.
   - Fill in all dev Firebase credentials and Upstash dev database credentials.
   - Verify all required variables are present.
   - Confirm `.gitignore` covers `.env*`, `*.pem`, `*.key`, `*serviceAccount*.json`.

5. **Initialise Firebase emulators**
   ```bash
   firebase init emulators
   # Enable: Auth (9099), Firestore (8080), Storage (9199), UI (4000)
   ```

6. **Create `src/lib/firebase/admin.ts`** — see 02_TECHNICAL_BLUEPRINT.md Section 6.
7. **Create `src/lib/firebase/client.ts`** — Firebase client SDK init with emulator support.
8. **Create `src/lib/firebase/auth-helper.ts`** — see 02_TECHNICAL_BLUEPRINT.md Section 7.
9. **Create `src/lib/redis.ts`** — see 02_TECHNICAL_BLUEPRINT.md Section 9.
10. **Create `src/lib/errors.ts`** — see 02_TECHNICAL_BLUEPRINT.md Section 8.
11. **Create `src/lib/types.ts`** — see 02_TECHNICAL_BLUEPRINT.md Section 5.
12. **Create `src/middleware.ts`** — cookie presence check, redirect unauthenticated traffic.
13. **Create `/api/v1/health` route** — Firestore ping + Redis PING, return JSON status.
14. **Set up GitHub Actions CI** — see 04_BUILD_AND_RELEASE.md Section 3.
15. **Set up Vercel projects** — dev, staging, production with separate env vars per environment.

**Done when**:
- [ ] `npm run dev` starts without errors
- [ ] Firebase emulators start on correct ports
- [ ] `/api/v1/health` returns `{"status":"healthy"}` against emulator
- [ ] CI pipeline passes on a test PR
- [ ] `.env.local` is gitignored and not in git history

---

## Phase 1 — Authentication and Subscription Foundation

**Goal**: Students can register (email, Google, phone OTP), log in, purchase a subscription via Paystack, and have their access correctly gated. Admins can log in.

**Prerequisites**: Phase 0 done.

### Tasks

**Auth endpoints**
1. `POST /api/v1/auth/login` — verify Firebase ID token with Admin SDK, create HTTP-only session cookie (14-day expiry), write profile to Firestore if first login.
2. `POST /api/v1/auth/logout` — clear session cookie.
3. `GET /api/v1/auth/verify` — return uid, email, role, subscription status.

**Firestore profile creation**
4. On first login, create `profiles/{uid}` with role: student, subscription: none, totalPoints: 0, suspended: false.
5. On Google login: populate displayName and photoURL from Google claims.
6. On phone login: populate phoneNumber from Firebase claims.

**Subscription endpoints**
7. `POST /api/v1/subscriptions/initialize` — create Paystack subscription checkout (monthly or annual plan). Return authorization_url for redirect.
8. `POST /api/v1/subscriptions/webhook` — receive and verify Paystack webhooks (HMAC-SHA512). Handle:
   - `charge.success`: set subscription active, set expiry date, write subscriptionEvents, send confirmation email + SMS.
   - `subscription.disable`: set subscription expired, write subscriptionEvents, send expiry notification.
   - `invoice.payment_failed`: send payment failed notification.
9. `GET /api/v1/subscriptions/status` — return current subscription status and expiry date.
10. `POST /api/v1/subscriptions/cancel` — cancel Paystack subscription via API.

**Paystack setup**
11. Create `src/lib/paystack.ts` — HMAC verifier, API request helper.
12. Register webhook URL in Paystack Dashboard for all required events.
13. Create monthly and annual subscription plans in Paystack Dashboard. Store plan codes in env vars.

**Email and SMS**
14. Create `src/lib/email.ts` — Resend client, template helpers for welcome, confirmation, expiry.
15. Create `src/lib/sms.ts` — Termii client, helpers for confirmation and expiry SMS (Ghana format).

**Frontend**
16. `/register` page — email/password form, Google OAuth button, phone OTP form. Post to Firebase client SDK, exchange for session cookie.
17. `/login` page — same methods.
18. `/subscribe` page — plan selector (monthly/annual), prices in GHS, Paystack checkout button.
19. Session context provider — wraps app, reads from `/api/v1/auth/verify`, provides user state.

**Security**
20. Deploy Firestore rules from 03_SECURITY_AND_DATA.md Section 4.
21. Deploy Storage rules from 03_SECURITY_AND_DATA.md Section 5.
22. Write Firestore rules tests for profile creation and role protection.

**Done when**:
- [ ] Register with email, Google, and phone all create correct Firestore profile
- [ ] Login creates HTTP-only session cookie
- [ ] Logout clears cookie and session context
- [ ] Paystack monthly plan checkout completes (test card)
- [ ] Webhook activates subscription in Firestore
- [ ] Student without subscription sees /subscribe redirect when accessing lessons
- [ ] Student with active subscription passes requireActiveSubscription()
- [ ] Confirmation email and SMS sent on payment success
- [ ] All auth rules tests pass

---

## Phase 2 — Content Catalog and Admin Management

**Goal**: Admin can create and publish subjects, courses, lessons, and quizzes. Students can browse the catalog.

**Prerequisites**: Phase 1 done.

### Tasks

**Admin content API**
1. `POST /api/v1/admin/publish` — publish/unpublish subject, course, lesson, or quiz. Invalidate Redis cache. Write audit log.
2. `POST /api/v1/admin/upload-asset` — generate signed upload URL for video (Mux) or PDF (Cloud Storage). Admin uploads directly.
3. Mux upload webhook handler — receive `video.asset.ready` webhook, update lesson with muxPlaybackId.

**Catalog API**
4. `GET /api/v1/subjects` — return published subjects (all for admin). Cache 1 hour in Redis.
5. `GET /api/v1/courses` — return published courses with optional ?subjectId filter. Cache 1 hour.
6. `GET /api/v1/courses/:courseId` — return course detail.
7. `GET /api/v1/courses/:courseId/lessons` — return lessons for active subscriber or admin. Cache 1 hour.

**Mux/Video setup**
8. Create Mux account, generate API credentials (Token ID and Secret).
9. Create `src/lib/video.ts` — Mux client, signed playback URL generator (JWT, 15-minute expiry).
10. Register Mux webhook URL for `video.asset.ready` events.

**Quiz management**
11. Admin quiz creation: `POST /api/v1/admin/quizzes` — create quiz linked to course or lesson.
12. Admin question management: `POST /api/v1/admin/quizzes/:quizId/questions` — create questions with correct answer index. Store in Firestore subcollection.

**Admin frontend**
13. `/admin` dashboard — summary stats (students, subscriptions, courses).
14. `/admin/subjects` — list, create, edit, publish/unpublish subjects.
15. `/admin/courses` — list, create, edit, publish/unpublish courses.
16. `/admin/courses/:courseId/lessons` — list, create, edit, reorder lessons. Video upload via Mux signed URL. PDF upload via Cloud Storage signed URL.
17. `/admin/courses/:courseId/quizzes` — create and edit quizzes with question builder.
18. `/admin/users` — list students, view subscription status, suspend/unsuspend.

**Student catalog frontend**
19. `/catalog` page — subject grid, course cards with title, description, thumbnail.
20. Course search/filter by subject and keyword (client-side for first build; Algolia/Typesense for Phase 3 if needed).
21. Course detail page — lesson list (locked icon for non-subscribers), enroll button.

**Deployment**
22. Deploy Firestore indexes from 02_TECHNICAL_BLUEPRINT.md Section 14.

**Done when**:
- [ ] Admin can create, edit, and publish a subject, course, and lesson end-to-end
- [ ] Video uploads to Mux and playbackId saved to Firestore after webhook
- [ ] PDF uploads to Cloud Storage correct path
- [ ] Published content appears in student catalog
- [ ] Unpublished content is invisible to students
- [ ] Catalog pages cache correctly and invalidate on publish
- [ ] Admin quiz creation saves questions with correct answer to Firestore
- [ ] Correct answer is NOT returned by any student-facing API

---

## Phase 3 — Lesson Access, Progress, and Quizzes

**Goal**: Active subscribers can watch videos and read PDFs. Progress is tracked. Quizzes can be taken and scored.

**Prerequisites**: Phase 2 done.

### Tasks

**Enrollment**
1. `POST /api/v1/enrollments` — Firestore transaction: check active subscription, check course published, check not already enrolled, create enrollment document `{uid}_{courseId}`.
2. `GET /api/v1/enrollments` — return student's enrollments.

**Signed URL**
3. `GET /api/v1/signed-url?courseId=X&lessonId=Y&type=video|pdf` — verify active subscription, generate Mux signed playback JWT for video or Cloud Storage signed URL for PDF. Rate limit: 30/min.
4. `src/lib/video.ts` — Mux signed JWT generation with 15-minute expiry.
5. `src/lib/storage.ts` — Cloud Storage signed URL generation with 15-minute expiry.

**Progress**
6. `POST /api/v1/progress` — validate payload, check rate limit (60/min), upsert progress document `{uid}_{lessonId}`. Award points on first completion. Trigger leaderboard update.
7. Progress schema: completed, lastPositionSeconds, watchedPercent, pointsAwarded, completedAt.

**Quizzes**
8. `GET /api/v1/quizzes/:quizId` — return quiz with questions. Strip correctOptionIndex from response. Check subscription.
9. `POST /api/v1/quizzes/:quizId/attempts` — validate answers, score against correct answers from Firestore (never from client), check maxAttempts, write attempt document, award points if passed. Rate limit: 5/min.
10. `GET /api/v1/quizzes/:quizId/attempts` — return student's attempt history (score, passed, completedAt).

**Certificate trigger**
11. On quiz pass (or on final lesson complete if no quiz): check all lessons completed + quiz passed (if exists). If complete: trigger certificate generation.
12. `src/lib/certificates.ts` — generate PDF certificate with student name, course title, completion date. Upload to `gs://certificates/{uid}/{courseId}.pdf`. Write certificate document. Send notification.

**Leaderboard**
13. `src/lib/leaderboard.ts` — on progress/quiz completion: update `leaderboard/{uid}` totalPoints and coursesCompleted. Recalculate ranks for top 50.
14. `GET /api/v1/leaderboard` — return top 50, with cache (5-minute TTL).
15. `GET /api/v1/leaderboard/me` — return student's rank and points.

**Student frontend**
16. Lesson page — video player (HLS, uses Mux signed URL), PDF viewer, progress bar, lesson navigation.
17. Video player: resume from lastPositionSeconds, report progress every 30 seconds, mark complete at 90% watched.
18. Quiz page — question renderer, answer selector, submit button, result screen with score and pass/fail.
19. Progress dashboard — per-course completion percentage, lesson list with tick/lock states.
20. Leaderboard page — top 50 table with rank, name, points, courses completed. Current student's rank highlighted.

**Done when**:
- [ ] Enrollment creates correct Firestore document via transaction
- [ ] Video player loads signed Mux URL and plays
- [ ] Progress saves every 30 seconds without errors
- [ ] Video resumes from last position on re-open
- [ ] Quiz submission scores correctly server-side
- [ ] Correct answers never appear in API response
- [ ] Points awarded on lesson completion and quiz pass
- [ ] Certificate generated and emailed after course completion
- [ ] Leaderboard shows correct rankings
- [ ] Rate limits fire correctly under load test

---

## Phase 4 — Discussions and Notifications

**Goal**: Students can discuss content. All notification types are working.

**Prerequisites**: Phase 3 done.

### Tasks

**Discussions**
1. `GET /api/v1/discussions?courseId=X&lessonId=Y` — return threads for a course/lesson.
2. `POST /api/v1/discussions` — create thread. Check active subscription. Rate limit: 5/min.
3. `GET /api/v1/discussions/:threadId/replies` — return replies.
4. `POST /api/v1/discussions/:threadId/replies` — post reply. Check active subscription. Rate limit: 10/min.
5. Admin: pin thread, lock thread endpoints.
6. Discussion list component — thread cards, reply count, author, timestamp.
7. Thread detail page — replies, reply form.

**Notifications**
8. `src/lib/email.ts` — complete all email templates: welcome, payment confirmed, payment failed, expiring (7 days and 1 day), expired, certificate ready, quiz result.
9. `src/lib/sms.ts` — SMS templates: OTP, payment confirmed, expiring (1 day), expired with renewal link.
10. `GET /api/v1/notifications` — return unread notifications for student, paginated.
11. Notification bell component — unread count badge, dropdown list.
12. Mark notification as read on open.

**Daily subscription expiry job**
13. Cloud Scheduler job (daily 03:00 UTC):
    - Query profiles with subscriptionExpiresAt < now and subscription == 'active'.
    - Set subscription to 'expired'.
    - Send expiry notification email and SMS.
    - Write subscriptionEvents record.
    - Query profiles with subscriptionExpiresAt within 7 days.
    - Send 7-day renewal reminder.
    - Query profiles with subscriptionExpiresAt within 1 day.
    - Send 1-day renewal reminder.

**Done when**:
- [ ] Students can post and reply to threads
- [ ] Students without subscription cannot post
- [ ] Admin can pin and lock threads
- [ ] All email notifications send correctly
- [ ] SMS notifications send to Ghana numbers correctly
- [ ] In-app notifications appear and can be marked read
- [ ] Expiry job runs and sends correct notifications
- [ ] Renewal reminders sent at 7 days and 1 day

---

## Phase 5 — Production Hardening and Launch Preparation

**Goal**: Platform is ready for real users. All monitoring, alerting, backup, and compliance requirements are met.

**Prerequisites**: Phases 1–4 done and all phase done definitions satisfied.

### Tasks

**Security hardening**
1. Complete all security checks in 03_SECURITY_AND_DATA.md.
2. Run manual penetration test: try accessing lesson without subscription via direct API call, try accessing another student's progress, try setting own role via Firestore client, try replaying a signed URL after 15 minutes.
3. Verify quiz correct answers are never returned by any endpoint.
4. Verify Storage rules deny direct /course-content/ reads (test with gsutil and unauthenticated HTTP).
5. Configure Paystack to production (live) mode. Update all Paystack env vars to live keys.
6. Verify HMAC webhook validation with first real Paystack live event.

**Monitoring and alerting**
7. Configure Sentry with production DSN.
8. Set up all alerts from 05_OPERATIONS_AND_RECOVERY.md Section 3.
9. Configure Better Stack uptime monitor for `/api/v1/health`.
10. Configure GCP budget alerts at 50%, 80%, 100%.
11. Configure GCP Cloud Monitoring alerts for Firestore volume and Storage egress.

**Backup**
12. **[ON HOLD - REQUIRES BILLING]** Configure Cloud Scheduler + Cloud Functions for nightly Firestore backup.
13. Apply lifecycle policy to backup bucket (30-day retention).
14. Enable Object Versioning on production Storage bucket.
15. Run a full restore drill on staging. Document results.

**Performance**
16. Run k6 load test against staging. All targets from 04_BUILD_AND_RELEASE.md Section 4 must pass.
17. Verify Redis cache hit ratio is above 70% for catalog endpoints under load.
18. Test video playback on a 3G connection (Ghana mobile baseline).

**Compliance**
19. Create and publish Privacy Policy page.
20. Create and publish Terms of Service page.
21. Add cookie consent banner if analytics cookies are used.
22. Verify all notification emails include unsubscribe option for marketing messages.

**Launch readiness**
23. Complete all items in the Architecture Validation Checklist (04_BUILD_AND_RELEASE.md Section 9).
24. Complete all items in the Staging Validation Checklist (04_BUILD_AND_RELEASE.md Section 5).
25. Run full E2E test suite against staging.
26. Brief client on admin panel usage: content publishing, user management, subscription dashboard.
27. Confirm production domain and SSL configured in Vercel.
28. Confirm Mux/Cloudflare Stream webhook URL updated to production domain.
29. Confirm Paystack webhook URL updated to production domain.
30. Confirm Termii sender ID approved for Ghana (this requires advance approval — start early).

**Done when**:
- [ ] All Architecture Validation Checklist items checked
- [ ] All Staging Validation Checklist items checked
- [ ] Load test passes all targets
- [ ] Restore drill completed and documented
- [ ] Monitoring active and receiving events
- [ ] Alerts configured and tested (trigger a test alert)
- [ ] Privacy Policy and Terms of Service live
- [ ] Paystack in live mode with successful test transaction
- [ ] Client has reviewed and approved platform
- [ ] Release owner has signed off

---

## Open Decisions — Resolve Before Launch

| Decision | Options | Owner | Deadline |
|---|---|---|---|
| Video provider: Mux vs Cloudflare Stream | Mux: better DX, higher cost. Cloudflare Stream: cheaper, good quality. | Tech lead | Phase 2 start |
| Certificate design | Plain text PDF vs branded template | Client | Phase 3 start |
| Leaderboard reset period | Never / monthly / per term | Client | Phase 3 start |
| Free trial period | None / 7 days / 1 month | Client | Phase 1 start |
| GHS pricing for plans | Monthly: GHS X / Annual: GHS Y | Client | Phase 1 start |
| Termii sender ID | Must be applied for in advance (takes 1–2 weeks) | Dev/Client | Immediately |
| Discussion moderation | Admin-only or peer reporting | Client | Phase 4 start |
| Soft vs hard deletes for courses and users | Soft delete (archived status) recommended | Tech lead | Phase 2 start |
| Super admin role | Required before launch or Phase 2 | Client | Phase 1 end |
| Student data export (GDPR right of access) | Phase 2 or launch requirement | Client | Phase 1 end |
