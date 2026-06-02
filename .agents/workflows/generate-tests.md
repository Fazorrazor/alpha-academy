Generate tests for the current file or feature.

Steps:
1. Identify whether this is a lib function, API route, or React component
2. For lib functions: create unit tests in src/lib/__tests__/
3. For API routes: create integration tests in tests/api/
4. For Firestore rule changes: add cases to tests/firestore.rules.test.ts
5. For Paystack webhook changes: add cases to tests/api/subscriptions.webhook.test.ts
6. Cover: happy path, error paths, edge cases, and security boundaries
7. Run the tests and confirm they pass before finishing
