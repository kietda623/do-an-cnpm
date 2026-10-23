# US5 checkout evidence

This file tracks evidence for Phase 7 (US5). It separates authored coverage from checks that have actually run.

## Coverage added

- `tests/contracts/checkout.contract.spec.ts` compares all eight US5 runtime routes with the checked-in OpenAPI contract and checks quantity bounds, UUID idempotency header, and integer-string money fields.
- `apps/api/test/integration/checkout.integration.spec.ts` covers cart merge and buyer isolation, selected multi-shop checkout, immutable address and product snapshots, same-key replay including an app restart, key reuse with a different request, consumed quotes, stale cart/price, expired quote, unselected lines, stock rollback, a concurrent stock adjustment, and a 20-buyer stock race with 10 concurrent same-key retries.
- `tests/e2e/multi-shop-checkout.spec.ts` covers the buyer browser path from login and add-to-cart through quote confirmation and order detail. It uses mocked API responses; it is UI coverage, not database or stock evidence.

## Execution status

GitHub Actions CI run [#39](https://github.com/kietda623/do-an-cnpm/actions/runs/39943887691) on commit `5a8a381128692f0b5ba2533e3c77bd633bbf0f78` passed lint, typecheck, generated OpenAPI verification, unit tests, build, PostgreSQL integration tests, and Prisma schema/migration parity. This includes the US5 contract and checkout integration tests against the workflow's disposable `marketplace_test` database.

The Playwright suite in `tests/e2e/multi-shop-checkout.spec.ts` is mocked browser coverage and is not part of the current CI workflow, so it has not run. Local execution also remains unavailable: the API workspace cannot resolve `dotenv`, pnpm reports `ERR_PNPM_PACKAGE_MANAGER_INSPECT_OPTIONAL_DEPENDENCY` traversing the existing `node_modules/.pnpm/rolldown...` mount, and the root `node_modules` link cannot resolve `prettier`. `git diff --check` passes. No local database was reset or migrated. T087 remains open until the browser suite is run and its evidence is recorded.

US5 must not be declared passed based only on the browser mock test. The PostgreSQL integration race and exact inventory assertions still need a successful run.
