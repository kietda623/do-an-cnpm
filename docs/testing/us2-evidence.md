# US2 shop onboarding evidence

The shop workflow is implemented in the API, Seller Center, and Admin Panel. Shop creation commits the shop, owner membership, verified logo binding, and audit event in one transaction. Moderation uses row locks and expected versions; public reads expose active shops only.

## Reproduction

1. Configure `.env.test` with a local PostgreSQL database named `cnpm_test`, and set `TEST_DATABASE_NAME_CONFIRMATION=cnpm_test`.
2. Run `corepack pnpm --filter @marketplace/api test:integration`. This deliberately resets only the confirmed disposable test database. The shop integration cases cover atomic owner binding, pending public privacy, duplicate slug races, foreign/unverified logos, moderation state transitions, version conflicts, immutable approved slugs, audit events, and locked-account/role guards.
3. Run `corepack pnpm test:e2e:seller`. The browser test uses mocked HTTP responses to verify that a BUYER can sign in to Seller Center and submit a shop application.
4. Run `corepack pnpm --filter @marketplace/api test:contracts` to check the shop API surface and response privacy.
5. To add deterministic moderation fixtures to a local disposable database, seed an identity buyer and then run `corepack pnpm --filter @marketplace/api seed:shops`. The seed command requires `TEST_DATABASE_URL` and exact database-name confirmation and never falls back to `DATABASE_URL`.

## Results

- PostgreSQL integration: 12 tests passed against `cnpm_test` with migrations `0001_shared`, `0002_identity_assets`, and `0003_shops`.
- API unit regression: 11 tests passed; existing Storefront browser regression: 5 tests passed.
- Seller browser onboarding: 1 test passed.
- Contract tests: 73 tests passed.
- API, Seller Center, and Admin Panel lint, typecheck, and production builds passed.

The browser test verifies the Seller Center form and API request sequence with mocked HTTP. The API integration tests exercise persistence and authorization against PostgreSQL; no production deployment or live object-storage upload is represented by this evidence.
