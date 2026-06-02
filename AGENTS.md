# Alpha Academy — Agent Foundation

## Project context
You are building Alpha Academy: a subscription-based EdTech platform for Ghana.
Read these docs before starting any task:
- docs/01_PRODUCT_AND_ARCHITECTURE.md — scope, actors, flows
- docs/02_TECHNICAL_BLUEPRINT.md — stack, schema, API contracts
- docs/03_SECURITY_AND_DATA.md — security rules, auth patterns
- docs/06_IMPLEMENTATION_GUIDE.md — current phase and task order

## Stack (non-negotiable)
- Next.js 14 App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- Firebase Auth + Admin SDK, Cloud Firestore, Cloud Storage
- Upstash Redis, Paystack, Mux, Resend, Termii

## Security rules — never violate these
- Every protected API route must call requireSession(), requireAdmin(),
  or requireActiveSubscription() from src/lib/firebase/auth-helper.ts
- Never check subscription or role on the client side
- Never return quiz correctOptionIndex in any student-facing API response
- Never log session cookies, ID tokens, private keys, or full signed URLs
- Signed URLs must expire in 15 minutes or less
- All admin actions must call writeAuditLog() from src/lib/firebase/audit.ts

## Code patterns
- All API errors use apiError() from src/lib/errors.ts
- All Redis calls use safeRedisCall() from src/lib/redis.ts — never call Redis directly
- Enrollment writes must use Firestore transactions
- Progress document IDs must be {uid}_{lessonId}
- Enrollment document IDs must be {uid}_{courseId}

## What phase we are in
Check docs/06_IMPLEMENTATION_GUIDE.md for the current phase.
Only work on tasks in the current phase. Do not jump ahead.

## Before finishing any task
- Run: npm run lint && npm run typecheck && npm run test
- Confirm no secrets are hardcoded
- Confirm no new API route skips auth verification

## Frontend Integration Rules (Prevent Mockups)
- Never leave pages/widgets displaying hardcoded client-side mockup data (e.g., MOCK_COURSES, MOCK_PROGRESS) if the corresponding backend API endpoints or Firestore databases are already built.
- When building or modifying frontend pages, check the Technical Blueprint (docs/02_TECHNICAL_BLUEPRINT.md) and existing routes to ensure all dynamic elements are connected to the live database/API.
- Verify that interactive UI elements (such as "Resume," "Submit," or "Start") are fully interactive and execute their intended route-redirects or API requests, rather than acting as dead links or static buttons.





