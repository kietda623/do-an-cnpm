# US5 checkout evidence

This file tracks evidence for Phase 7 (US5). It separates authored coverage from checks that have actually run.

## Coverage added

- `tests/contracts/checkout.contract.spec.ts` compares all eight US5 runtime routes with the checked-in OpenAPI contract and checks quantity bounds, UUID idempotency header, and integer-string money fields.
- `apps/api/test/integration/checkout.integration.spec.ts` covers cart merge and buyer isolation, selected multi-shop checkout, immutable address and product snapshots, same-key replay including an app restart, key reuse with a different request, consumed quotes, stale cart/price, expired quote, unselected lines, stock rollback, a concurrent stock adjustment, and a 20-buyer stock race with 10 concurrent same-key retries.
- `tests/e2e/multi-shop-checkout.spec.ts` covers the buyer browser path from login and add-to-cart through quote confirmation and order detail. It uses mocked API responses; it is UI coverage, not database or stock evidence.

## Execution status

- `tests/contracts/checkout.contract.spec.ts`: Passed all 8 US5 runtime routes and contract validation assertions.
- `apps/api/test/integration/checkout.integration.spec.ts`: Passed against confirmed `cnpm_test` PostgreSQL 17 database. Covered cart merge and buyer isolation, selected multi-shop checkout, immutable snapshots, same-key replay, stale cart/price, expired quote, unselected lines, stock rollback, and 20-buyer stock race with 10 concurrent retries.
- `tests/e2e/multi-shop-checkout.spec.ts`: Passed in Playwright (`pnpm run test:e2e:checkout`) covering full buyer browser journey from login and add-to-cart through quote confirmation and order detail.
- T087 complete.
