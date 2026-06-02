Create a new protected API route for Alpha Academy.

Steps:
1. Read docs/02_TECHNICAL_BLUEPRINT.md sections 8, 9, 10 for patterns
2. Create the route file at src/app/api/v1/[name]/route.ts
3. Import and call the correct auth helper (requireSession / requireAdmin / requireActiveSubscription) as the first step in the handler
4. Validate input with Zod before any Firestore operation
5. Use apiError() from src/lib/errors.ts for all error responses
6. Apply rate limiting via checkRateLimit() if this is a write endpoint
7. Write the corresponding unit test
8. Run npm run lint && npm run typecheck
