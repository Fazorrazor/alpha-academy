# Alpha Academy — Security & Data
Version: 2.0
Status: Build-ready

---

## 1. Security Model

Assume the browser is always untrusted. The system must remain secure even if a user:
- Edits frontend JavaScript or React state
- Calls API routes directly with curl or Postman
- Knows the public Firebase configuration
- Has a valid session cookie but an expired subscription
- Has a valid session cookie but is suspended
- Intercepts a signed URL and shares it with another person

Every security decision is enforced on the server. Firestore rules and Storage rules are a defensive backup layer, not the primary mechanism.

---

## 2. Authorization Matrix

| Capability | Public | Student (no sub) | Student (active sub) | Admin |
|---|---|---|---|---|
| View marketing pages | Yes | Yes | Yes | Yes |
| View course catalog (titles/descriptions) | Yes | Yes | Yes | Yes |
| View unpublished content | No | No | No | Yes |
| Register / login | Yes | — | — | — |
| Start subscription checkout | No | Yes | No | — |
| Access lesson content | No | No | Yes | Yes |
| Request signed URL (video/PDF) | No | No | Yes | Yes |
| Submit quiz attempt | No | No | Yes | Yes |
| View own quiz results | No | Yes | Yes | Yes |
| View leaderboard | No | Yes | Yes | Yes |
| View certificates | No | Yes | Yes | Yes |
| Read discussion threads | No | Yes | Yes | Yes |
| Post discussion thread/reply | No | No | Yes | Yes |
| Save lesson progress | No | No | Yes | Yes |
| View own profile | No | Yes | Yes | Yes |
| Edit own profile | No | Yes | Yes | Yes |
| Cancel own subscription | No | No | Yes | — |
| Create/edit/delete subjects | No | No | No | Yes |
| Create/edit/delete courses | No | No | No | Yes |
| Create/edit/delete lessons | No | No | No | Yes |
| Create/edit/delete quizzes | No | No | No | Yes |
| Upload media assets | No | No | No | Yes |
| Publish/unpublish content | No | No | No | Yes |
| Pin/lock discussion threads | No | No | No | Yes |
| View all users | No | No | No | Yes |
| Suspend/unsuspend users | No | No | No | Yes |
| Promote/demote roles | No | No | No | Yes |
| View audit logs | No | No | No | Yes |
| View subscription events | No | No | No | Yes |

---

## 3. Threat Model and Controls

| Threat | Control |
|---|---|
| Student accesses lesson without active subscription | requireActiveSubscription() on all lesson, signed-url, quiz, and progress endpoints |
| Expired subscription continues accessing content | Subscription expiry checked on every protected API call from Firestore, never from cache |
| Student accesses another student's progress or quiz results | Firestore rules enforce uid ownership; API routes filter by session uid |
| Student escalates their own role via Firestore client | Firestore rules block any write to profiles.role from non-admin |
| Admin route abuse by student | All /api/v1/admin/* routes call requireAdmin() before any operation |
| Direct Cloud Storage video/PDF access without subscription | Storage rules deny all direct reads from /course-content/**; only signed URLs work |
| Signed URL shared between users | 15-minute expiry limits damage; Mux signed JWTs are not reusable after expiry |
| Mux signed URL generated without subscription check | signed-url route always calls requireActiveSubscription() before generating Mux JWT |
| API spam / abuse | Redis rate limiting on all write-heavy and media-access endpoints |
| Paystack webhook spoofed | HMAC-SHA512 signature verified against PAYSTACK_WEBHOOK_SECRET on every webhook request |
| Duplicate Paystack webhook events | Webhook handler checks subscriptionEvents collection for existing paystackReference before processing |
| Session cookie theft | HTTP-only, Secure, SameSite=Strict cookies; revocation supported via Firebase Admin |
| Secret leakage via git | .gitignore covers all .env files, .pem, .key, serviceAccount JSON |
| Secret leakage via CI | GitHub Actions secrets only; no secrets in workflow logs |
| Stale catalog cache after publish | publish/unpublish endpoint deletes affected Redis cache keys immediately |
| Firestore data corruption | Transactions on enrollment, subscription creation; structured writes with type validation |
| Suspended account continues accessing platform | requireSession() checks suspended field on every request |
| Quiz answers exposed to client | correctOptionIndex field stripped from all quiz question API responses |
| Certificate generated before course is complete | Certificate generation checks all lesson progress and quiz pass status before generating |
| Admin promotes beyond their own level | promote-role restricted to student↔admin changes; super admin role deferred to Phase 2 |
| Brute force login | Firebase Auth enforces lockout; login endpoint rate limited to 10/min |
| Phone OTP abuse | Firebase phone auth with rate limiting; Termii has per-number throttling |

---

## 4. Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    function isAdmin() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role == 'admin';
    }

    function isPublished(data) {
      return data.status == 'published';
    }

    function hasActiveSubscription() {
      return isSignedIn() &&
        get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.subscription == 'active';
    }

    // Profiles
    match /profiles/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid) &&
        request.resource.data.role == 'student' &&
        request.resource.data.subscription == 'none';
      allow update: if (isOwner(uid) &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['role', 'subscription', 'subscriptionPlan', 'subscriptionExpiresAt',
                     'paystackCustomerCode', 'paystackSubscriptionCode', 'totalPoints', 'suspended']))
        || isAdmin();
      allow delete: if false; // soft deletes only via admin
    }

    // Subjects
    match /subjects/{subjectId} {
      allow read: if isPublished(resource.data) || isAdmin();
      allow write: if isAdmin();
    }

    // Courses
    match /courses/{courseId} {
      allow read: if isPublished(resource.data) || isAdmin();
      allow write: if isAdmin();

      // Lessons (subcollection)
      match /lessons/{lessonId} {
        allow read: if isAdmin() ||
          (isPublished(resource.data) && hasActiveSubscription());
        allow write: if isAdmin();
      }
    }

    // Quizzes
    match /quizzes/{quizId} {
      allow read: if isAdmin() ||
        (isPublished(resource.data) && hasActiveSubscription());
      allow write: if isAdmin();

      // Quiz questions - never expose correctOptionIndex to client
      match /questions/{questionId} {
        allow read: if isAdmin();  // client reads via API which strips the answer
        allow write: if isAdmin();
      }
    }

    // Enrollments
    match /enrollments/{enrollmentId} {
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
      allow create: if hasActiveSubscription() &&
        request.resource.data.uid == request.auth.uid;
      allow update: if isAdmin();
      allow delete: if false;
    }

    // Progress
    match /progress/{progressId} {
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
      allow create, update: if hasActiveSubscription() &&
        request.resource.data.uid == request.auth.uid;
      allow delete: if false;
    }

    // Quiz attempts
    match /quizAttempts/{attemptId} {
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
      allow create: if hasActiveSubscription() &&
        request.resource.data.uid == request.auth.uid;
      allow update, delete: if false;
    }

    // Certificates
    match /certificates/{certId} {
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
      allow write: if false; // written only by server
    }

    // Leaderboard
    match /leaderboard/{uid} {
      allow read: if isSignedIn();
      allow write: if false; // written only by server
    }

    // Discussions
    match /discussions/{threadId} {
      allow read: if isSignedIn();
      allow create: if hasActiveSubscription() &&
        request.resource.data.authorUid == request.auth.uid &&
        !request.resource.data.isPinned &&
        !request.resource.data.isLocked;
      allow update: if isAdmin() ||
        (isOwner(resource.data.authorUid) &&
          !request.resource.data.diff(resource.data).affectedKeys()
            .hasAny(['isPinned', 'isLocked', 'replyCount']));
      allow delete: if isAdmin();

      match /replies/{replyId} {
        allow read: if isSignedIn();
        allow create: if hasActiveSubscription() &&
          request.resource.data.authorUid == request.auth.uid &&
          !get(/databases/$(database)/documents/discussions/$(threadId)).data.isLocked;
        allow update: if isAdmin() ||
          isOwner(resource.data.authorUid);
        allow delete: if isAdmin();
      }
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read: if isSignedIn() && resource.data.uid == request.auth.uid;
      allow update: if isSignedIn() &&
        resource.data.uid == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read']);
      allow create, delete: if false; // server-only
    }

    // Subscription events
    match /subscriptionEvents/{eventId} {
      allow read: if isAdmin() ||
        (isSignedIn() && resource.data.uid == request.auth.uid);
      allow write: if false; // server-only via webhook handler
    }

    // Audit logs
    match /auditLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false; // server-only
    }

    // System events
    match /systemEvents/{eventId} {
      allow read: if isAdmin();
      allow write: if false; // server-only
    }
  }
}
```

---

## 5. Cloud Storage Security Rules

```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Public assets: thumbnails, marketing images
    match /public/{allPaths=**} {
      allow read: if true;
      allow write: if false; // admin uploads via signed upload URL from server
    }

    // Course content: videos and PDFs
    // Direct reads are ALWAYS denied — signed URLs only
    match /course-content/{allPaths=**} {
      allow read: if false;
      allow write: if false;
    }

    // Certificates
    // Students can read their own certificates only
    match /certificates/{uid}/{allPaths=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false; // server-only
    }

    // Block everything else by default
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 6. Audit Log Requirements

Every audit log entry must include: actorUid, actorEmail, action, targetType, targetId, metadata, ipAddress, and timestamp.

Actions that must be logged:

| Action | targetType | Metadata |
|---|---|---|
| role.promoted | user | fromRole, toRole |
| role.demoted | user | fromRole, toRole |
| user.suspended | user | reason |
| user.unsuspended | user | — |
| course.published | course | title |
| course.unpublished | course | title |
| lesson.published | lesson | courseId, title |
| lesson.unpublished | lesson | courseId, title |
| subject.published | subject | title |
| subject.unpublished | subject | title |
| quiz.published | quiz | courseId, title |
| asset.uploaded | lesson/quiz | assetType, storagePath |
| asset.deleted | lesson/quiz | assetType, storagePath |
| secret.rotated | system | secretType (never the value) |
| backup.restored | system | backupTimestamp |
| rules.deployed | system | environment |
| subscription.overridden | user | oldStatus, newStatus, reason |

Never log: passwords, session cookies, ID tokens, private keys, full signed URLs, Paystack secret key, quiz correct answers.

---

## 7. Data Retention Policy

| Data type | Retention |
|---|---|
| User profiles | While account exists; soft-delete on account closure |
| Enrollments | While account exists |
| Progress records | While account exists |
| Quiz attempts | While account exists |
| Certificates | Indefinite (student's permanent record) |
| Subscription events | Indefinite (financial record) |
| Audit logs | Minimum 2 years |
| System events | 90 days |
| Notification records | 90 days |
| Discussion threads | While account exists; admin can delete |
| Firestore backups | 30 days rolling |
| System logs (Vercel/Sentry) | 30 days |

---

## 8. GDPR and Data Privacy (Ghana Data Protection Act)

Ghana's Data Protection Act 2012 (Act 843) applies. Key obligations:

- Students must be informed what data is collected and why at registration.
- Students can request a copy of their data (data export endpoint needed in Phase 2).
- Students can request deletion of their account and personal data.
- Data must not be shared with third parties beyond what is required for platform operation (Paystack, Mux, Resend, Termii).
- A privacy policy page must exist and be linked from registration.
- Cookie consent banner is required if analytics cookies are used.

Account deletion process (Phase 2 requirement):
1. Student requests deletion via profile page.
2. Server anonymises profile: name → "Deleted User", email → null, phone → null.
3. Progress and enrollment records are deleted.
4. Discussion posts are anonymised, not deleted.
5. Subscription events and audit logs are retained for legal/financial compliance.
6. Firebase Auth account is deleted.
7. Deletion is logged in audit logs.

---

## 9. Subscription Enforcement Architecture

Subscription status is the second gate after session verification. It is checked:
- On every lesson access request
- On every signed URL request
- On every quiz attempt submission
- On every progress write
- On every discussion post creation

Subscription status is read from Firestore on every check. It is never cached in Redis for access decisions because:
- A Paystack webhook can expire a subscription at any moment
- The cost of one Firestore read is acceptable and correct
- Caching subscription status creates a window where an expired student retains access

Paystack webhook handler must be idempotent:
```
On charge.success:
  1. Verify HMAC signature
  2. Check subscriptionEvents for existing paystackReference
  3. If duplicate: return 200 immediately, do nothing
  4. If new: update profiles/{uid} subscription fields in transaction
  5. Write subscriptionEvents record
  6. Send confirmation email and SMS
  7. Write audit log

On subscription.disable or charge.failed:
  1. Verify HMAC signature
  2. Check for duplicate
  3. Update profiles/{uid} subscription to 'expired'
  4. Write subscriptionEvents record
  5. Send renewal reminder
  6. Write audit log
```

---

## 10. Privacy Policy

*This is the production Privacy Policy for Alpha Academy. It must be published at `/privacy` before launch and linked from the registration page and footer. Replace [DATE] with the launch date and [CONTACT EMAIL] with the client's support email.*

---

**Alpha Academy — Privacy Policy**

Last updated: [DATE]

**1. Who we are**

Alpha Academy is an online learning platform operated by [Client Business Name] ("we", "us", "our"), registered in Ghana. We can be contacted at [CONTACT EMAIL].

**2. What data we collect and why**

When you register and use Alpha Academy, we collect:

- Your name, email address, and phone number — to create your account and contact you about your subscription and learning activity.
- Your Google account information (if you register with Google) — name and email provided by Google OAuth.
- Payment information — processed by Paystack on our behalf. We do not store your card details or Mobile Money PIN. Paystack's privacy policy applies to payment processing.
- Your learning activity — lessons watched, progress position, quiz attempts and scores, certificates earned — to track your progress and generate your certificates.
- Device and usage data — IP address, browser type, pages visited, and session duration — for security monitoring and platform improvement.

**3. How we use your data**

We use your data to:
- Provide access to courses and lessons you have subscribed to.
- Process subscription payments through Paystack.
- Send you transactional communications: subscription confirmations, payment receipts, renewal reminders, certificate notifications, and quiz results.
- Generate and issue course completion certificates.
- Maintain your leaderboard ranking and progress records.
- Detect and prevent fraud and unauthorised access.
- Comply with our legal obligations under the Ghana Data Protection Act 2012 (Act 843).

We do not sell your data to third parties. We do not use your data for advertising.

**4. Who we share your data with**

We share your data only with the service providers required to operate the platform:

- Paystack — payment processing (Ghana). [https://paystack.com/privacy](https://paystack.com/privacy)
- Google Firebase — authentication and database hosting.
- Mux — video hosting and delivery.
- Resend — transactional email delivery.
- Termii — SMS delivery and phone verification.
- Sentry — error monitoring (anonymised where possible).
- Vercel — platform hosting.

All providers are contractually required to protect your data and may only use it to provide services to us.

**5. How long we keep your data**

- Your account and learning records: while your account is active.
- Subscription payment records: indefinitely (required for financial compliance).
- Audit logs: minimum 2 years.
- System logs: 90 days.
- If you delete your account: your personal details are anonymised within 30 days. Learning records are deleted. Payment records are retained for legal compliance.

**6. Your rights**

Under the Ghana Data Protection Act 2012, you have the right to:
- Access a copy of the personal data we hold about you.
- Correct inaccurate data.
- Request deletion of your account and personal data.
- Object to how we process your data.

To exercise any of these rights, contact us at [CONTACT EMAIL]. We will respond within 30 days.

**7. Cookies**

We use only essential cookies required to keep you logged in (an HTTP-only session cookie). We do not use advertising or tracking cookies. If we add analytics in the future, we will update this policy and request your consent.

**8. Security**

We use industry-standard security measures including encrypted connections (HTTPS), HTTP-only session cookies, server-side authorisation checks, and access controls. No system is completely secure — if you believe your account has been compromised, contact us immediately at [CONTACT EMAIL].

**9. Children**

Alpha Academy is available to students of all ages. If a student is under 18, a parent or guardian must agree to this policy on their behalf during registration. We do not knowingly collect data from children under 13 without parental consent.

**10. Changes to this policy**

If we make material changes to this policy, we will notify you by email at least 14 days before the changes take effect. Continued use of the platform after that date means you accept the updated policy.

**11. Contact**

For any privacy questions or requests: [CONTACT EMAIL]

---

## 11. Terms of Service

*This is the production Terms of Service for Alpha Academy. Publish at `/terms` before launch and link from registration and footer. Replace placeholders before publishing.*

---

**Alpha Academy — Terms of Service**

Last updated: [DATE]

**1. Acceptance**

By registering for Alpha Academy, you agree to these Terms of Service. If you do not agree, do not use the platform. If you are under 18, a parent or guardian must accept on your behalf.

**2. The service**

Alpha Academy provides access to online courses, video lessons, PDF materials, and assessments ("Content") through a subscription. Access to Content requires an active paid subscription.

**3. Your account**

You are responsible for keeping your login credentials secure. You must not share your account with others. Each subscription is for one person. We reserve the right to suspend accounts found sharing access.

**4. Subscriptions and payments**

Subscriptions are billed monthly or annually in Ghana Cedis (GHS) through Paystack. Your subscription renews automatically until you cancel. You can cancel at any time from your profile page. Cancellation takes effect at the end of the current billing period — you retain access until then.

We do not offer refunds for partial subscription periods unless required by Ghanaian consumer law. If a payment fails, your access will be suspended until payment is successfully processed.

**5. Content and intellectual property**

All course Content on Alpha Academy is owned by us or our content providers. You may access Content for your personal, non-commercial learning only. You may not:
- Download, copy, reproduce, or share course videos or materials.
- Record screen or audio of Content.
- Sell or redistribute any Content.
- Use Content to build a competing product.

**6. Certificates**

Certificates are issued when you complete all required lessons and pass the course assessment. Certificates represent completion of our course requirements and do not constitute a professional qualification unless explicitly stated in the course description.

**7. Acceptable use**

You must not:
- Use the platform to harass, abuse, or harm other users.
- Post spam or illegal content in discussion forums.
- Attempt to bypass subscription checks or security controls.
- Use automated tools to access the platform.
- Impersonate another person.

We reserve the right to suspend or permanently ban accounts that violate these rules.

**8. Availability**

We aim for 99.5% availability but do not guarantee uninterrupted service. We are not liable for losses caused by planned or unplanned downtime, third-party service outages, or force majeure events.

**9. Limitation of liability**

To the extent permitted by Ghanaian law, our total liability to you for any claim arising from your use of Alpha Academy is limited to the amount you paid for your current subscription period.

**10. Governing law**

These Terms are governed by the laws of Ghana. Any disputes will be resolved in the courts of Ghana.

**11. Changes**

We may update these Terms. Material changes will be notified by email at least 14 days in advance. Continued use after that date constitutes acceptance.

**12. Contact**

[CONTACT EMAIL]

---

## 12. Cookie Consent Implementation

Alpha Academy uses only one cookie: the HTTP-only session cookie set by the server on login. This cookie is strictly necessary for the platform to function — no consent banner is required for strictly necessary cookies under most privacy frameworks.

However, the following rules apply:

**What is required at launch**
- A cookie notice (not a consent banner) in the site footer or on first visit explaining that the platform uses one session cookie for login purposes.
- The Privacy Policy must clearly describe the session cookie (see Section 7 of the Privacy Policy above).
- No analytics, advertising, or tracking cookies may be added without updating the Privacy Policy and adding a proper consent banner.

**If analytics are added later (e.g. Google Analytics, PostHog)**
- A consent banner must be shown on first visit.
- Analytics cookies must not be set until consent is given.
- Consent must be stored and respected across sessions.
- The Privacy Policy must be updated before analytics are enabled.

**Cookie notice implementation (launch)**

```tsx
// src/components/layout/CookieNotice.tsx
// Show once on first visit, dismiss and store in localStorage
// Plain text, no accept/reject buttons needed (strictly necessary only)

export function CookieNotice() {
  const [visible, setVisible] = useState(() =>
    typeof window !== 'undefined' &&
    !localStorage.getItem('cookie-notice-dismissed')
  );

  if (!visible) return null;

  return (
    <div role="region" aria-label="Cookie notice"
      className="fixed bottom-0 left-0 right-0 bg-neutral-900 text-white px-4 py-3
                 flex items-center justify-between gap-4 text-sm z-50">
      <p>
        Alpha Academy uses a single session cookie to keep you logged in.
        {' '}<a href="/privacy" className="underline">Privacy Policy</a>
      </p>
      <button
        onClick={() => {
          localStorage.setItem('cookie-notice-dismissed', '1');
          setVisible(false);
        }}
        className="shrink-0 px-3 py-1 border border-white/30 rounded hover:bg-white/10">
        OK
      </button>
    </div>
  );
}
```
