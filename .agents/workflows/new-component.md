Create a new React component for Alpha Academy.

Steps:
1. Read docs/02_TECHNICAL_BLUEPRINT.md Section 20 (Design System)
2. Use Tailwind CSS only — no inline styles except where Tailwind cannot
3. Accept className, aria-label, and data-testid as base props
4. Implement all three states: loading (skeleton), error (ErrorCard), success
5. Use useAuth() from src/contexts/AuthContext for session data
6. Use SWR or TanStack Query for any data fetching
7. Ensure all interactive elements are keyboard accessible (44px touch targets)
8. Write a component test in src/components/__tests__/
