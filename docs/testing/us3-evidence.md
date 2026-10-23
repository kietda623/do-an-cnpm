# US3 catalog and inventory evidence

Captured on 2026-10-23 for T049–T063 on `codex/us3-catalog-inventory`.

## Implemented

- Admin category tree with generated private slugs, parent changes, cycle protection, hide/restore, optimistic version checks, and audit events.
- Shop-scoped product, image, variant, and inventory APIs. Product publication uses verified shop-bound image assets, integer-string VND prices, canonical variant keys, and atomic initial inventory writes. Stop-sale retains records and ledger history.
- Inventory changes use a non-zero delta, row lock, expected version, non-negative stock check, and append-only movement ledger.
- Seller product editor, gallery upload and replacement, variant editor and stock adjustment flow; admin category create/edit/hide flow.
- `0004_catalog_inventory` migration and disposable catalog fixtures seed script.

## Verification

- `corepack pnpm --dir apps/api run typecheck` — passed.
- API contract tests — 129 passed, including required optimistic versions on category, product and variant updates.
- API unit tests — 11 passed.
- PostgreSQL integration tests on the confirmed `cnpm_test` database — 19 passed across 5 suites. This run reset the disposable database and applied migrations 0001–0004 from scratch.
- Catalog browser E2E — 2 passed before the final gallery-edit assertion was added. It covers admin category creation, seller upload and publish with two variants, edit/stop, a 409 stale-stock reload, successful retry, and rejected upload. API responses and upload are mocked in these browser tests. The additional gallery edit assertion is typechecked but could not be rerun because a frozen dependency reinstall was blocked by pnpm's untrusted-mount-point check, which left the local Playwright/Next executable links unusable.
- Seller Center, Admin Panel, and API Client typechecks — passed.
- Prisma migration/schema consistency check — no difference detected.

## Pending live-storage check

The catalog fixture seed completed on the confirmed `cnpm_test` database after creating disposable demo identity and shop fixtures. It created visible/hidden categories, a stopped product, and variants with stock 0, 1 and 5. Generated passwords were not written to files. The local environment has no `S3_BUCKET`, S3 access key/secret, or public asset base configured, so a real object-store upload could not be exercised. The browser upload checks above use mocked API responses and do not prove bucket connectivity. The final gallery-edit E2E assertion is typechecked but remains unverified because pnpm cannot traverse an optional dependency mount point and its failed install left the local Playwright/Next links unusable. T063 remains open until a real-bucket upload can run in a configured demo environment and the gallery E2E can be rerun.
