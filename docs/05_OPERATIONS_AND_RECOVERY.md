# Alpha Academy — Operations & Recovery
Version: 2.0
Status: Build-ready

---

## 1. Non-Functional Requirements

### Availability targets
| Surface | Target |
|---|---|
| Public catalog and marketing pages | 99.5% |
| Student authenticated learning flows | 99.5% |
| Payment and subscription flows | 99.5% |
| Admin content management | 99.0% |
| Health endpoint | Checked every 60 seconds |

### Latency targets (p95)
| Operation | Target |
|---|---|
| Cached catalog load | < 300ms |
| Login exchange | < 800ms |
| Session verification | < 500ms |
| Signed URL generation (video) | < 800ms |
| Signed URL generation (PDF) | < 600ms |
| Progress save | < 500ms |
| Quiz submission | < 1000ms |
| Admin publish | < 1500ms |
| Paystack webhook processing | < 2000ms |

### Recovery targets
| Scenario | RTO | RPO |
|---|---|---|
| Vercel deployment rollback | 15 minutes | Zero (stateless) |
| Firestore data restore | 4 hours | 24 hours (nightly backup) |
| Course asset restore | 4 hours | 24 hours |
| Redis failure | Immediate (graceful degradation) | N/A (cache only) |

### Capacity assumptions (launch)
| Metric | Value |
|---|---|
| Registered students | 5,000 |
| Monthly active students | 2,000 |
| Peak concurrent students | 500 |
| Subscribed students | 1,000 (at launch target) |
| Courses | 50–100 |
| Lessons | 500–2,000 |
| Quizzes | 100–400 |
| Average video size | 100–500MB |
| Progress writes | Every 30 seconds per active learner |
| Peak Paystack webhooks | ~50/hour |

---

## 2. Observability

### Health endpoint
```
GET /api/v1/health
```

Returns:
```json
{
  "status": "healthy",
  "services": {
    "firestore": "ok",
    "redis": "ok"
  },
  "timestamp": "2026-01-01T00:00:00Z"
}
```

Firestore check: lightweight document read (system ping document).
Redis check: PING command via safeRedisCall.
Never perform expensive queries in the health endpoint.
If Firestore is down: return status "degraded" with 200 (not 500 — uptime monitors should page on Firestore down, not on health endpoint 500).
If Redis is down: return status "degraded" — this is acceptable because Redis is non-critical.

### Logging policy

Log in every API response:
- Request ID (generated per request)
- Endpoint path
- HTTP method
- HTTP status code
- Response duration (ms)
- Error code (if applicable)
- Admin action type (if applicable)

Never log:
- Passwords or password hashes
- Session cookies
- Firebase ID tokens
- Firebase Admin private key
- Paystack secret key
- Paystack webhook raw payload beyond event type and reference
- Full signed URLs (video or PDF)
- Quiz correct answers
- Personal data beyond uid (no email, phone in logs)

### Metrics to track

| Metric | Tool |
|---|---|
| Request count per endpoint | Vercel Analytics / Sentry |
| Error rate (4xx, 5xx) | Sentry |
| p50/p95/p99 latency | Sentry Performance |
| Login failures per hour | Sentry + Firestore counter |
| Signed URL failures | Sentry |
| Progress write failures | Sentry |
| Redis rate limit blocks | Sentry (log when rate limit fires) |
| Firestore read/write volume | GCP Cloud Monitoring |
| Storage egress (GB/day) | GCP Cloud Monitoring |
| Cache hit ratio | Custom metric from safeRedisCall |
| Paystack webhook success/failure rate | Sentry + subscriptionEvents collection |
| Active subscription count | Admin dashboard (Firestore query) |
| Daily new registrations | Admin dashboard |
| Certificate generation failures | Sentry |

---

## 3. Alerts

Configure all alerts before production launch.

| Alert | Threshold | Channel | Severity |
|---|---|---|---|
| Health check failure | 2 consecutive failures | PagerDuty + Slack #ops-alerts + SMS | SEV-1 |
| 5xx error rate | > 5% for 5 minutes | PagerDuty + Slack | SEV-1 |
| p95 latency | > 800ms for 10 minutes | Slack #ops-alerts | SEV-2 |
| Paystack webhook failures | > 3 consecutive failures | Slack #ops-alerts | SEV-2 |
| Firestore read/write volume | > 150% of forecast | Email + Slack | SEV-3 |
| Storage egress | > 200% of forecast | Email + Slack | SEV-3 |
| Backup job failure | Any failure | Email + Slack | SEV-2 |
| GCP billing | 50% / 80% / 100% of budget | Billing email + Slack | SEV-3 / SEV-2 / SEV-1 |
| Certificate generation failures | > 5 in 1 hour | Slack #ops-alerts | SEV-3 |

---

## 4. Incident Severities

| Severity | Definition | Response time |
|---|---|---|
| SEV-1 | Security breach, data exposure, authentication down, entire platform unreachable, payment processing broken | Immediate (< 15 minutes) |
| SEV-2 | Active subscribers cannot access lessons or video, subscription webhook failing, certificate generation broken, backup failure | < 1 hour |
| SEV-3 | Admin content management degraded, leaderboard broken, discussion posts failing, quiz results not saving | < 4 hours |
| SEV-4 | Minor UI issues, typos, transient log anomalies, non-critical notification failures | Next business day |

---

## 5. Incident Response Process

1. **Acknowledge**: On-call engineer acknowledges PagerDuty alert within 15 minutes for SEV-1, 30 minutes for SEV-2.

2. **Triage**: Identify whether the issue is:
   - A bad deployment (check Vercel deployment timestamp vs incident start)
   - An external service outage (check Vercel, Firebase, Paystack, Mux status pages)
   - A data issue (check Firestore)
   - A rules issue (check Firestore/Storage rules deployment log)

3. **Mitigate first**: Restore service before investigating root cause.
   - If bad deployment: rollback immediately (see Section 7).
   - If external outage: communicate to students, wait for provider resolution.
   - If data issue: switch to maintenance page, assess restore need.

4. **Communicate**:
   - Update Slack #ops-alerts every 30 minutes for SEV-1/SEV-2.
   - Update status page if available.
   - If payment processing is affected: notify client immediately.

5. **Resolve**: Apply fix, verify with smoke tests, confirm health endpoint healthy.

6. **Post-incident review (PIR)**:
   - Required for all SEV-1 and SEV-2 incidents.
   - PIR meeting within 3 business days.
   - Produce: incident timeline, root cause, contributing factors, preventive actions.
   - Add preventive tasks to the backlog with priority.

---

## 6. Disaster Scenarios and Playbooks

### Vercel outage
1. Check https://vercel-status.com
2. Do not redeploy — it will not fix a provider outage and may cause additional issues.
3. Communicate estimated downtime to client.
4. Existing sessions may continue if Firebase is available; new page loads will fail.
5. When Vercel recovers, verify health endpoint before announcing recovery.

### Firebase Auth outage
1. New logins and registrations will fail.
2. Existing HTTP-only session cookies remain valid for already-authenticated students.
3. OTP-based registrations will fail (Termii/Firebase dependency).
4. Communicate to students: existing sessions are working, new logins temporarily unavailable.
5. Do not attempt workarounds — wait for Firebase recovery.

### Firestore outage
1. All reads and writes will fail.
2. Redis-cached catalog pages may continue serving (read-only catalog).
3. Subscription verification will fail — students will be blocked.
4. Do not attempt writes during outage.
5. Switch to maintenance page if outage exceeds 30 minutes.
6. After recovery: verify data integrity before reopening.

### Redis outage
1. `safeRedisCall` will return fallback values automatically.
2. Catalog reads will fall back to Firestore (higher latency, higher cost).
3. Rate limiting will be disabled temporarily (fail-open).
4. Monitor for unusual API usage patterns during Redis outage.
5. Redis will reconnect automatically when restored.
6. No action required unless latency alerts fire.

### Paystack outage
1. New subscription checkouts will fail.
2. Existing active subscriptions are unaffected (status stored in Firestore).
3. Webhook delivery will resume when Paystack recovers; process delayed webhooks.
4. Communicate to prospective subscribers: payment temporarily unavailable.
5. Monitor subscriptionEvents collection for delayed webhook processing after recovery.

### Mux / Cloudflare Stream outage
1. Signed playback URL generation will fail.
2. Students with active subscriptions cannot watch videos.
3. PDF lessons and quizzes remain available.
4. Communicate to students: video temporarily unavailable, other content accessible.
5. Switch to maintenance banner on video player pages.

### Service account key leak
1. Rotate the key immediately (see Section 8).
2. Redeploy to Vercel with new key.
3. Delete the old key in GCP IAM.
4. Audit recent API calls for suspicious activity.
5. Write audit log entry for the rotation.
6. Review how the key was leaked (git history, logs, screenshots).
7. If student data may have been accessed: notify client immediately for legal assessment.

### Subscription data corruption
1. Block write traffic by switching to maintenance page.
2. Identify affected records in Firestore.
3. Assess whether the last nightly backup has clean data.
4. If backup is clean: restore (see Section 9).
5. If corruption is recent (post-backup): manually correct affected records with admin tools.
6. Write audit log for all manual corrections.
7. Re-enable traffic and verify subscriptions are correct for affected students.

---

## 7. Rollback Procedure

```
1. Go to Vercel Dashboard → alpha-academy project → Deployments tab.
2. Identify the last known-good deployment (check timestamp vs incident start).
3. Click the three dots (...) next to that deployment → Promote to Production.
4. Wait for deployment to complete (~2 minutes).
5. Run smoke tests:
   GET /api/v1/health → must return healthy
   POST /api/v1/auth/login → must succeed
   GET /api/v1/subjects → must return data
   GET /api/v1/signed-url (with valid session) → must return URL
6. If Firestore rules were also changed: re-deploy last known-good rules.
7. Confirm uptime monitor is green.
8. Announce recovery in Slack #ops-alerts.
```

---

## 8. Secret Rotation Procedure

### Firebase Admin Service Account Key

```
1. Go to GCP Console → IAM & Admin → Service Accounts → alpha-academy-prod.
2. Create a new key (JSON format).
3. Immediately store new key securely (password manager, never git).
4. Update FIREBASE_ADMIN_PRIVATE_KEY and FIREBASE_ADMIN_CLIENT_EMAIL in Vercel production.
5. Trigger a new Vercel production deployment.
6. Wait for deployment to complete.
7. Verify health endpoint returns healthy.
8. Verify a test login succeeds.
9. Delete the old key from GCP IAM.
10. Write audit log: action: secret.rotated, secretType: firebase_admin_key.
```

### Upstash Redis Token

```
1. Go to Upstash Console → alpha-academy-prod database → Reset Token.
2. Copy new token immediately.
3. Update UPSTASH_REDIS_REST_TOKEN in Vercel production.
4. Trigger Vercel deployment.
5. Verify health endpoint shows Redis as ok.
6. Write audit log: action: secret.rotated, secretType: upstash_redis_token.
```

### Paystack Secret Key

```
1. Go to Paystack Dashboard → Settings → API Keys.
2. Roll the live secret key.
3. Update PAYSTACK_SECRET_KEY in Vercel production.
4. Trigger Vercel deployment.
5. Verify a test subscription checkout initialises correctly.
6. Verify webhook HMAC validation is still working (check subscriptionEvents for any new events).
7. Write audit log: action: secret.rotated, secretType: paystack_secret_key.
```

---

## 9. Backup and Restore

### Nightly Firestore backup

Scheduled job via Google Cloud Scheduler + Cloud Functions:
- Runs at 02:00 UTC daily.
- Exports to `gs://alpha-academy-prod-backups/{YYYY-MM-DD}/`.
- Retains 30 days (Object Lifecycle Management rule).
- Backup bucket has separate IAM — no application service account has access.
- On failure: alert fires to Slack #ops-alerts and email.

Apply lifecycle policy:
```bash
gsutil lifecycle set lifecycle-policy.json gs://alpha-academy-prod-backups
```

lifecycle-policy.json:
```json
{
  "lifecycle": {
    "rule": [{ "action": {"type": "Delete"}, "condition": {"age": 30} }]
  }
}
```

### Firestore restore procedure

```
1. Switch frontend to maintenance page (update Vercel env or routing).
2. List available backups:
   gcloud firestore operations list --project=alpha-academy-prod
3. Identify the target backup directory in gs://alpha-academy-prod-backups/.
4. Run import:
   gcloud firestore import gs://alpha-academy-prod-backups/[EXPORT_DIR]/ \
     --project=alpha-academy-prod
5. Wait for import to complete (check GCP Console → Firestore → Import/Export).
6. Verify critical collections are populated:
   - profiles: expected count
   - courses: expected count
   - enrollments: expected count
   - subscriptionEvents: expected count
7. Re-enable traffic.
8. Write audit log: action: backup.restored, backupTimestamp: [date].
9. Notify client of data loss window (data since last backup is lost).
```

### Course asset backup (Cloud Storage)

Enable Object Versioning on the production bucket:
```bash
gsutil versioning set on gs://alpha-academy-prod.appspot.com
```

This allows restoration of deleted or overwritten files. Versioning does not protect against bucket deletion — maintain a copy of original course files in admin secure storage (Google Drive, external drive) as the absolute source of truth.

### Restore drill schedule

- Before launch: complete one full restore drill on staging.
- After launch: quarterly restore drills.
- Document drill results: time taken, data verified, issues encountered.

---

## 10. Cost Controls

| Control | Implementation |
|---|---|
| Cache catalog reads | 1-hour Redis TTL on subjects and courses |
| Debounce progress writes | Client-side 30-second interval; server rate limit at 60/min |
| Short-lived signed URLs | 15-minute expiry prevents hoarding |
| Video via Mux/Cloudflare Stream | Offloads egress cost from GCP Storage |
| GCP budget alerts | 50%, 80%, 100% thresholds |
| Firestore reads review | Monthly review of read/write volume in GCP Console |
| Storage egress monitor | Alert at 200% of forecast |
| Redis cache hit ratio | Track monthly; low hit ratio means cache keys are being missed |

Monthly review checklist:
- [ ] Firestore reads and writes within budget
- [ ] Storage egress within budget
- [ ] Mux/Cloudflare Stream bandwidth within plan
- [ ] Paystack transaction volume matches expected subscriptions
- [ ] Redis memory usage below 80%
- [ ] Sentry error volume within plan
- [ ] Termii SMS credits sufficient for next month

---

## 11. Accessibility Requirements

Minimum standard for all student-facing pages:

- Keyboard navigation for all interactive elements (login, quiz, video controls, discussion)
- Visible focus states on all interactive elements
- Semantic HTML: correct heading hierarchy, landmark regions, list elements
- Form labels associated with inputs; inline error messages
- Sufficient colour contrast (WCAG AA: 4.5:1 for normal text)
- Video player: captions/subtitles support (Mux supports caption tracks)
- PDF viewer: accessible via keyboard and screen reader where possible
- Images: meaningful alt text; decorative images have empty alt
- No content conveyed by colour alone (quiz pass/fail must also use text)
- Mobile-responsive at 320px minimum width (Ghana mobile-first)
