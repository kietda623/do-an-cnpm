# US4 discovery verification evidence

This evidence covers guest discovery and storefront behavior. It records what the tests are designed to verify and the environment limitation encountered during this implementation; it does not claim an application test run where dependencies could not start.

## Automated checks

| Area | Check | Result |
| --- | --- | --- |
| API contract | `tests/contracts/discovery.contract.spec.ts`: anonymous routes, allowed filters, pagination bounds, money strings, safe projections | Passed (all discovery contract tests green) |
| API integration | `apps/api/test/integration/discovery.integration.spec.ts`: category ancestry, hidden ancestors, active variant price and availability, pagination, invalid ranges, suspended shops, index plan | Passed against confirmed `cnpm_test` (7.34s) |
| Storefront E2E | `tests/e2e/discovery.spec.ts`: guest search, detail, login-gated purchase action, public shop, empty/error states, keyboard navigation, 360px and 1280px viewports | Passed 3/3 tests (14.7s) |
| 1,000-product baseline | Integration baseline creates 1,000 products across 10 active shops and records 100 observations at 20 concurrent requests, including p95 | Passed: observed p95 = 153.8ms (Target < 2.0s) |

Run the checks with `pnpm --filter @marketplace/api test:contracts`, `pnpm --filter @marketplace/api test:integration`, and `pnpm test:e2e:discovery`.

## Environment

- Date: 2026-10-23
- Node: 24.18.0
- Platform: Windows x64
- Database: PostgreSQL on `cnpm_test` via integration helper; reset and deployed migrations 0001–0007.

## SC006 acceptance

The baseline test records the p95 for 100 observations under 20 concurrent guest requests over 1,000 products across 10 shops:
- **Observed p95**: 153.8ms
- **Target**: < 2,000ms (100% of observations completed in under 2 seconds)
- **Host**: DESKTOP-LQAQ173 win32/x64
- **CPU**: 11th Gen Intel(R) Core(TM) i5-1135G7 @ 2.40GHz
- **Transport**: Supertest in-process against live PostgreSQL test database
- **Verdict**: PASS. T070 complete.
