# T025 buyer account E2E baseline

The Playwright browser suite is in `tests/e2e/buyer-account.spec.ts` and runs with `pnpm test:e2e`. It starts the storefront on `http://127.0.0.1:3100` and uses API fixtures to keep UI state checks deterministic.

Baseline on 2026-10-23:

- Playwright 1.64.1 with Chromium launched successfully; Next.js storefront dev server started successfully.
- Five tests cover loading/submission lock, duplicate-email error, empty addresses, the registration/login/profile/address/password/avatar/logout journey, and unauthorized profile access.
- All five currently fail because the corresponding account screens and unauthorized route guard have not been implemented: registration form labels are absent, the address empty state is absent, and `/account` does not redirect to login.
- The suite is available as a local command but is not added to CI while its target pages are not present. T037 implements the screens; T039 is the planned full identity verification gate.
