# Alpha Academy — Product & Architecture
Version: 2.0
Status: Client-ready, build-ready
Last updated: 2026

---

## 1. Product Overview

Alpha Academy is a subscription-based online learning platform built for an independent EdTech startup targeting students of all ages in Ghana. The platform allows students to discover, enroll in, and consume structured course content — videos, PDFs, and quizzes — through a secure, mobile-friendly web experience.

The client operates as a single-admin platform. All content is created, uploaded, and published by one administrator. There are no instructor accounts or revenue-sharing workflows in the first build.

### Business model
Students pay a monthly or annual subscription to access all published content on the platform. There is no per-course pricing in the first build. Subscription management, payment collection, and access enforcement are core to the platform's commercial operation.

### Target market
- Primary geography: Ghana
- Student demographic: mixed ages (school-age, university, working professionals)
- Payment methods: Mobile Money (MTN MoMo, Vodafone Cash, AirtelTigo Money), Visa/Mastercard, and bank transfer
- Language: English (first build)
- Connectivity consideration: students may be on mobile networks with inconsistent bandwidth; the platform must handle slow connections gracefully

---

## 2. Scope — First Build

### In scope
- Student registration via email/password, Google OAuth, and phone number with OTP
- Student subscription purchase and management (monthly and annual plans)
- Student dashboard with enrolled courses and progress
- Subject and course catalog with search and filtering
- Course enrollment gated behind active subscription
- Video lessons with resume position and progress tracking
- PDF lesson viewing and download controls
- Quizzes with scored attempts, pass/fail thresholds, and attempt history
- Course completion certificates (generated on 100% lesson and quiz completion)
- Leaderboards showing top students by points or completion rate
- Discussion threads per course or lesson (student comments, admin replies)
- Student notifications via email and SMS (enrollment, quiz results, new content, subscription reminders)
- Admin content management: subjects, courses, lessons, quizzes, publishing
- Admin media uploads: video, PDF, quiz creation
- Admin user management: view, suspend, and adjust student accounts
- Admin subscription and payment oversight dashboard
- Secure media delivery via signed URLs (video and PDF)
- Health monitoring, backups, and rollback capability

### Out of scope — first build
- Multiple instructor accounts or revenue sharing
- Native mobile apps (iOS/Android)
- Offline downloads
- Live or scheduled classes
- Multi-school or multi-tenant architecture
- AI-generated content or recommendations
- Advanced analytics beyond basic completion and subscription metrics
- External LMS integration (Google Classroom, Moodle)

### Deferred but planned
- Super admin role for high-risk operations
- Instructor portal (Phase 2)
- Advanced certificate customisation
- Corporate/bulk subscription plans
- Mobile app (Phase 3)

---

## 3. Actors

| Actor | Description |
|---|---|
| Public visitor | Views marketing and public preview pages. Cannot access course content. |
| Student (free trial) | Registered but not subscribed. Can browse catalog, cannot access lessons. |
| Student (subscribed) | Active subscription. Full access to all published content. |
| Student (expired) | Subscription lapsed. Access suspended until renewal. |
| Admin | Single operator. Manages all content, users, and platform settings. |
| System | Automated processes: subscription checks, backup jobs, notification dispatch, certificate generation. |

---

## 4. External Services

| Service | Purpose |
|---|---|
| Vercel | Hosts Next.js frontend and API route handlers |
| Firebase Auth | Handles identity: email/password, Google OAuth, phone OTP |
| Firebase Admin SDK | Server-side session verification and privileged operations |
| Cloud Firestore | Primary application database |
| Cloud Storage | Stores course videos, PDFs, certificates, and public assets |
| Upstash Redis | Cache and rate limiting |
| Paystack | Payment processing for Ghana: Mobile Money, cards, bank transfer |
| Twilio or Termii | SMS notifications and phone OTP delivery (Ghana numbers) |
| Resend or SendGrid | Transactional email |
| Mux or Cloudflare Stream | Video transcoding, adaptive streaming (HLS), and CDN delivery |
| Sentry | Error monitoring and performance tracking |
| Better Stack or Uptime Robot | Uptime monitoring |
| GitHub Actions | CI/CD pipeline |

### Why Paystack
Paystack is the dominant payment processor in Ghana with native support for MTN MoMo, Vodafone Cash, AirtelTigo Money, Visa, Mastercard, and GH bank transfers. It handles subscription billing natively and provides webhooks for payment events.

### Why Mux or Cloudflare Stream
Direct Cloud Storage video delivery is unsuitable for production at any scale. Videos need transcoding to multiple quality levels (360p, 480p, 720p) and adaptive bitrate streaming (HLS) for students on variable mobile connections in Ghana. Mux and Cloudflare Stream both handle upload, transcoding, and CDN delivery with signed playback URLs.

---

## 5. High-Level Architecture

```
Browser / Mobile browser
  └── Next.js App on Vercel
        ├── Middleware: session cookie check → redirect unauthenticated users
        ├── Public pages: marketing, catalog preview, login, register
        └── Protected pages: dashboard, courses, lessons, quizzes, profile
              └── API Route Handlers (/api/v1/*)
                    ├── Firebase Admin SDK: session and role verification
                    ├── Cloud Firestore: application data
                    ├── Cloud Storage: signed URL generation for PDFs
                    ├── Mux / Cloudflare Stream: signed playback URLs for video
                    ├── Upstash Redis: cache and rate limiting
                    ├── Paystack: subscription and payment operations
                    ├── Resend / SendGrid: transactional email
                    └── Twilio / Termii: SMS and OTP

Background / Scheduled
  ├── Subscription expiry checker (daily Cloud Scheduler job)
  ├── Firestore nightly backup (Cloud Scheduler + Cloud Functions)
  ├── Certificate generator (triggered on course completion event)
  └── Leaderboard recalculator (triggered on quiz/progress write)
```

---

## 6. Core User Flows

### Registration and login
```
Student visits /register
→ Chooses: email/password, Google, or phone OTP
→ Phone OTP: Firebase phone auth → SMS via Twilio/Termii → verify code
→ Profile created in Firestore (role: student, subscription: none)
→ Redirected to subscription selection page
→ Selects plan → Paystack checkout → webhook confirms payment
→ Subscription record created → student gains full access
```

### Subscription gate
```
Student attempts to access any lesson
→ Server checks subscription status in Firestore
→ If active: proceed
→ If expired or missing: redirect to /subscribe with renewal prompt
→ Subscription check is always server-side; never trusted from client
```

### Video lesson access
```
Student opens lesson page
→ Client calls GET /api/v1/signed-url?courseId=X&lessonId=Y
→ Server verifies: active session + active subscription (or admin)
→ Server generates signed Mux playback URL (15-minute expiry)
→ Client initialises video player with signed URL
→ Player reports progress every 30 seconds via POST /api/v1/progress
→ On lesson completion: progress marked complete, points awarded, leaderboard updated
```

### Quiz attempt
```
Student opens quiz
→ Server returns questions (answers never sent to client)
→ Student submits answers → POST /api/v1/quizzes/{quizId}/attempts
→ Server evaluates answers, calculates score, checks pass threshold
→ Attempt record written to Firestore
→ If pass + all lessons complete: certificate generation triggered
→ Points awarded, leaderboard updated
```

### Certificate generation
```
System detects course completion event
→ Checks all lessons watched and quiz passed (if quiz exists)
→ Generates PDF certificate with student name, course name, date
→ Uploads to Cloud Storage /certificates/{uid}/{courseId}.pdf
→ Firestore record created with download URL
→ Email notification sent to student
```

### Subscription renewal and expiry
```
Paystack webhook: charge.success → extend subscription expiry date
Paystack webhook: subscription.disable → mark subscription expired
Daily Cloud Scheduler job:
  → Queries students with expiry date < now
  → Marks status as expired
  → Sends renewal reminder email/SMS
  → Blocks lesson access on next request
```

### Admin publishing flow
```
Admin uploads video to Mux/Cloudflare Stream → receives asset ID
Admin creates lesson in Firestore with video asset ID
Admin creates quiz questions linked to lesson or course
Admin sets publish status → server writes to Firestore
Server invalidates Redis cache keys
Server writes audit log
Students see new content on next catalog load
```

---

## 7. Responsibility Boundaries

| Layer | Responsibility |
|---|---|
| Browser | Renders UI, manages local UI state, calls APIs, never enforces security |
| Next.js middleware | Fast cookie presence check, redirects unauthenticated page requests |
| API route handlers | All security enforcement: session, role, subscription, input validation, rate limits |
| Firestore rules | Defensive backup layer; never the primary security mechanism |
| Storage rules | Deny all direct client reads of course content |
| Paystack webhooks | Source of truth for subscription status changes |
| Redis | Performance and abuse protection only; never source of truth for access decisions |
| Cloud Scheduler | Runs background jobs that cannot run in serverless functions |

---

## 8. Architecture Decision Records

### ADR-001: Stateless API
Accepted. All state lives in Firestore, Cloud Storage, or Redis. No server memory, no local filesystem, no background tasks assumed to survive serverless function termination.

### ADR-002: Firebase Auth with HTTP-only session cookies
Accepted. Firebase handles identity for all three auth methods. The server exchanges ID tokens for HTTP-only session cookies verified with Firebase Admin SDK.

### ADR-003: Firestore as primary database
Accepted. Flexible document model suits the content hierarchy. Requires disciplined indexing, validation, and rules.

### ADR-004: Signed URLs for all private content
Accepted. Videos via Mux/Cloudflare Stream signed playback URLs. PDFs via Cloud Storage signed URLs. All expire in 15 minutes. Never delivered without subscription and session verification.

### ADR-005: Upstash Redis for cache and rate limiting
Accepted. Serverless-compatible. Graceful degradation if unavailable.

### ADR-006: Paystack for payments
Accepted. Best-in-class Ghana coverage. Handles MoMo, cards, and bank transfers natively. Subscription billing built in. Webhooks drive access control.

### ADR-007: Mux or Cloudflare Stream for video
Accepted. Direct Cloud Storage video delivery is not suitable for production. Adaptive bitrate streaming is required for Ghana's variable mobile connectivity. Decision between Mux and Cloudflare Stream to be finalised based on pricing at build time.

### ADR-008: Video delivery infrastructure
Accepted. All video assets stored in Mux/Cloudflare Stream. Cloud Storage used for PDFs, certificates, and public assets only.

### ADR-009: Server-side subscription enforcement
Accepted. Subscription status is checked server-side on every protected API call. Client-side subscription state is for UI only and is never trusted for access decisions.

### ADR-010: Paystack webhooks as subscription source of truth
Accepted. All subscription state changes (payment success, failure, cancellation, expiry) are driven by Paystack webhook events. The platform never assumes a subscription is active without a confirmed webhook event.

### ADR-011: API versioning from first build
Accepted. All routes under /api/v1/* to reduce future breaking-change risk.

### ADR-012: Single admin, no instructor portal
Accepted for first build. All content management performed by one admin account. Instructor portal deferred to Phase 2.

### ADR-013: Certificate generation as background trigger
Accepted. Certificate generation is triggered by course completion events and runs asynchronously. Students receive email notification when the certificate is ready.

### ADR-014: Leaderboard via Firestore aggregation
Accepted for first build. Leaderboard recalculated on progress and quiz completion events. If performance degrades at scale, migrate to a dedicated Redis sorted set.

### ADR-015: Payment architecture is core, not deferred
Accepted. Unlike the original blueprint, payments are a launch requirement. Paystack subscription billing, webhook handling, and entitlement enforcement are all first-build requirements.
