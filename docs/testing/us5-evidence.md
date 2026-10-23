# US5 checkout evidence

This file tracks evidence for Phase 7 (US5). It separates authored coverage from checks that have actually run.

## Coverage added

- `tests/contracts/checkout.contract.spec.ts` compares all eight US5 runtime routes with the checked-in OpenAPI contract and checks quantity bounds, UUID idempotency header, and integer-string money fields.
- `apps/api/test/integration/checkout.integration.spec.ts` covers cart merge and buyer isolation, selected multi-shop checkout, immutable address and product snapshots, same-key replay including an app restart, key reuse with a different request, consumed quotes, stale cart/price, expired quote, unselected lines, stock rollback, a concurrent stock adjustment, and a 20-buyer stock race with 10 concurrent same-key retries.
- `tests/e2e/multi-shop-checkout.spec.ts` covers the buyer browser path from login and add-to-cart through quote confirmation and order detail. It uses mocked API responses; it is UI coverage, not database or stock evidence.

## Execution status

Not run in this workspace yet. The checked-in `.env.test` identifies the disposable database as `cnpm_test`, but local test execution stops before Jest starts because the API workspace cannot resolve its installed `dotenv` package. pnpm also reports `ERR_PNPM_PACKAGE_MANAGER_INSPECT_OPTIONAL_DEPENDENCY` while traversing the existing `node_modules/.pnpm/rolldown...` mount. The final formatting check also could not start because the root `node_modules` link cannot resolve `prettier`. `git diff --check` passes. No database reset or migration was executed. Run the API contract and integration projects plus `pnpm test:e2e:checkout` in CI or after repairing the local dependency links, then append the run URL/commit and measured result here.

US5 must not be declared passed based only on the browser mock test. The PostgreSQL integration race and exact inventory assertions still need a successful run.
