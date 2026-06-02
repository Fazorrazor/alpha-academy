Deploy Alpha Academy to staging.

Steps (in exact order — do not skip):
1. Run /run-checks and confirm all pass
2. Ask human to confirm staging deploy is intended
3. Deploy Firestore indexes: firebase deploy --only firestore:indexes
4. Wait for confirmation that indexes are ACTIVE before continuing
5. Deploy Firestore rules: firebase deploy --only firestore:rules
6. Deploy Storage rules: firebase deploy --only storage
7. Trigger Vercel staging deploy via git push origin staging
8. Run smoke tests: health endpoint, auth verify, subjects catalog
9. Report results to human for approval before any production steps
