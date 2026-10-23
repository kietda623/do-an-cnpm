# US4 discovery verification evidence

This evidence covers guest discovery and storefront behavior. It records what the tests are designed to verify and the environment limitation encountered during this implementation; it does not claim an application test run where dependencies could not start.

## Automated checks

| Area | Check | Result |
| --- | --- | --- |
| API contract | `tests/contracts/discovery.contract.spec.ts`: anonymous routes, allowed filters, pagination bounds, money strings, safe projections | Added; execution blocked because the workspace cannot resolve `dotenv` from `apps/api/scripts/run-tests.mjs` |
| API integration | `apps/api/test/integration/discovery.integration.spec.ts`: category ancestry, hidden ancestors, active variant price and availability, pagination, invalid ranges, suspended shops, index plan | Added against disposable `cnpm_test`; execution blocked by the same missing dependency resolution |
| Storefront E2E | `tests/e2e/discovery.spec.ts`: guest search, detail, login-gated purchase action, public shop, empty/error states, keyboard navigation, 360px and 1280px viewports | Added; not run because the storefront TypeScript/Next dependencies are unresolved |
| 1,000-product baseline | Integration baseline creates 1,000 products across 10 active shops and records 100 observations at 20 concurrent requests, including p95 | Added; no measured p95 available until integration dependencies run successfully |

Run the checks with `corepack pnpm --filter @marketplace/api test:contracts -- --runInBand`, `corepack pnpm --filter @marketplace/api test:integration -- --runInBand`, and `corepack pnpm test:e2e:discovery` after restoring workspace dependencies.

## Environment

- Date: 2026-10-23
- Node: 24.18.0
- Platform: Windows x64
- Database: tests target `cnpm_test` through the existing integration helper; the test helper resets and deploys migrations before fixtures.
- Install attempt: `corepack pnpm install --frozen-lockfile` stopped before linking dependencies because pnpm could not traverse `node_modules/.pnpm/.../supports-color` (`ERR_PNPM_PACKAGE_MANAGER_INSPECT_OPTIONAL_DEPENDENCY`, untrusted mount point).

## SC006 acceptance

The baseline test records the p95 for 100 observations and prints hostname, OS/architecture, CPU, API transport (in-process Supertest), and the configured integration database source. SC006's target remains at least 95 of 100 discovery requests completing within 2 seconds. That target is not yet evidenced: run `corepack pnpm --filter @marketplace/api test:integration -- --runInBand` on a healthy dependency installation, capture the reported p95, and run the suite in the intended deployment-like environment before claiming the acceptance target.
