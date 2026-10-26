# US3 catalog and inventory evidence

Captured on 2026-10-23 for T049–T063 on `codex/us3-catalog-inventory`.

## Implemented

- Admin category tree with generated private slugs, parent changes, cycle protection, hide/restore, optimistic version checks, and audit events.
- Shop-scoped product, image, variant, and inventory APIs. Product publication uses verified shop-bound image assets, integer-string VND prices, canonical variant keys, and atomic initial inventory writes. Stop-sale retains records and ledger history.
- Inventory changes use a non-zero delta, row lock, expected version, non-negative stock check, and append-only movement ledger.
- Seller product editor, gallery upload and replacement, variant editor and stock adjustment flow; admin category create/edit/hide flow.
- `0004_catalog_inventory` migration and disposable catalog fixtures seed script.

## Verification

- `pnpm --filter @marketplace/api run typecheck` — passed.
- API contract tests (`tests/contracts/catalog-inventory.contract.spec.ts`) — passed.
- API unit tests — 30 passed across all 7 unit test suites.
- PostgreSQL integration tests on `cnpm_test` — `catalog.integration.spec.ts` (18.08s) and `inventory.integration.spec.ts` (5.25s) passed against live PostgreSQL 17 database.
- Catalog browser E2E (`pnpm run test:e2e:catalog`) — 2/2 tests passed in Playwright (covering admin category creation, seller upload and publish with two variants, edit/stop, 409 stale-stock reload and rejected upload validation).
- Catalog fixture seed completed on `cnpm_test` (`pnpm --filter @marketplace/api run seed:catalog`) with visible/hidden categories `demo-catalog-visible`/`demo-catalog-hidden`, stopped product `d563d428-a8b8-457f-a136-52f2034b4780`, and variant stocks 0, 1, and 5.
- T063 complete.
