Run all local quality checks for Alpha Academy.

Steps:
1. npm run lint
2. npm run typecheck
3. npm run test
4. npm run test:rules (Firestore rules tests against emulator)
5. npm run build (verify production build succeeds)
6. Report any failures with the exact error and file location
7. Do not proceed with any other task until all checks pass
