# Alpha Academy — Antigravity Overrides

## Artifact review
Always ask for review before:
- Writing or modifying firestore.rules or storage.rules
- Modifying src/lib/firebase/auth-helper.ts
- Adding or changing any /api/v1/admin/* route
- Running any firebase deploy command
- Running any git push to staging or main

## Never auto-run these terminal commands
- firebase deploy
- git push origin main
- git push origin staging
- npm run build (in production context)
- Any gcloud command

## Parallel agent guidance
When I assign you a task that maps to a build phase in
docs/06_IMPLEMENTATION_GUIDE.md, work only within that phase.
Do not modify files owned by another agent's task without flagging it.

## Emulator Integration Rules
- When `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` is active:
  - Both client and server-side configurations must point to the local emulator suite.
  - Do not verify ID tokens or session cookies against production hosts.
  - Server-side emulator environment variables (`FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_STORAGE_EMULATOR_HOST`) must be initialized dynamically before any Admin SDK actions.

## UX Empathy & User Flow Checklist (The Gold Standard)
Before committing any user-facing feature or flow, you must run it through this mental checklist:

### 1. Context-Aware State & Labels
- **Dynamic CTAs:** Action buttons must reflect the student's actual state.
  - If a course is not started: "Start Course" or "Enroll to Start".
  - If a course has recorded progress (at least one lesson completed or watch position saved): "Resume Course" or "Resume Study".
  - If a subscription is expired: "Renew to Unlock".
- **Visual Continuity:** Ensure loading and transition screens preserve the color scheme, structure, and spacing of the landing screen to avoid visual jarring.

### 2. Precedence & Smart Sorting
- **Chronological Relevance:** Any list containing active items (courses, notifications, discussions) must prioritize user interaction.
  - Active courses must be sorted by `lastAccessedAt` (descending) so the student can resume their exact spot instantly.
  - Notifications must be sorted by `createdAt` (descending) with clear read/unread status.
  - Quizzes and assignments must flag pending actions first.

### 3. Frictionless Progress & Autoplay Paths
- **Auto-Advance:** After completing a lesson (video fully watched or PDF scrolled to the end), prompt the user with a distinct, one-click transition to the next lesson or the course quiz.
- **Save State Persistence:** Always auto-save video positions (timestamps) and scroll depths to Firestore/Local Storage so resuming is seamless and doesn't require finding the spot.
- **Pay-to-Learn Bridge:** The Paystack redirect webhook must transition the student directly back to their destination course page, fully unlocked, with a success notification.

### 4. Low-Bandwidth & Network Resilience (Ghana Context)
- **Graceful Degradation:** Use robust cache fallbacks (Firestore offline persistence + Upstash Redis). If a connection fails, never crash the app. Show a user-friendly error with a "Retry" button.
- **Asset Optimization:** Ensure videos and PDF documents are streamed/lazy-loaded to conserve data bandwidth.

### 5. Rewarding Feedback Loops
- **Gamification Rewards:** Completing lessons, answering quizzes, or maintaining streaks must be celebrated with micro-animations (e.g. confetti, XP point gains, streak flame indicators).
- **Certificate Pride:** Upon passing the final quiz of a course, immediately trigger the PDFKit generation with an instant download button.

### 6. No Dead Ends
- **Actionable Empty States:** Every empty state (no enrollments, no certificates, no notifications) must guide the user with a CTA (e.g. "Browse Courses", "Start Learning").
- **Clear 404/500 Recovery:** Never show raw server errors. Provide a clear explanation of what went wrong and a button to return to safety (e.g., "Back to Dashboard").

