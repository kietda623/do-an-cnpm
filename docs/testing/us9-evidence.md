# US9 Admin evidence

## Scope and environment

- Target: FR-46–50, BR-01/BR-10; US9 Admin routes and Admin panel.
- The request enumerates nine route paths although it calls them “8 routes”; this implementation follows all nine listed paths. Seller Reviews and Seller statistics/revenue (US8) and additional system roles are out of scope.
- Windows 11, Node.js 24.21.0, pnpm 12.14.0 through Corepack.
- PostgreSQL 18 disposable local cluster at `127.0.0.1:55434`, database `marketplace_us9_disposable`. The Windows PostgreSQL service and shared databases were not used. Integration helper reset only this database after validating `TEST_DATABASE_NAME_CONFIRMATION`.
- No Prisma schema or migration change was needed. The existing user auth version/session, product moderation, idempotency, audit and order tables cover this scope.

## Red/green evidence

| Check | Red evidence before implementation | Final result |
| --- | --- | --- |
| Admin contract/runtime parity | `corepack pnpm --filter @marketplace/api test:contracts --testPathPatterns=admin-operations.contract.spec.ts` — 12 failures / 4 passes because the new Admin handlers were absent and the three new writes did not yet declare the required idempotency header. | `corepack pnpm --filter @marketplace/api test:contracts` — 8 suites, 201 tests passed. Includes all nine routes, Admin recovery route security and idempotency headers, User version projection and secret exclusion. |
| Central permissions | `corepack pnpm --filter @marketplace/api test --testPathPatterns=permissions.spec.ts` — failed on the missing Admin capability predicates before the policy implementation. | Included in `corepack pnpm test` — 9 API unit suites, 46 tests passed; 3 API-client tests passed. The source guard confirms role equality is centralized in `permissions.ts`. |
| Admin PostgreSQL lifecycle | Initial Admin integration run failed on missing route behavior (404 where the contract expected Admin 403 or success). | Included in full integration: account lock/unlock, session revocation, locked-user purchase/seller-write denial, order history retention, product hide/replay/checkout block, safe audit, read-only order inquiry and known stats. |
| Admin reject recovery guard | New test first observed HTTP 200 for an ACTIVE Seller where locked-Seller recovery required HTTP 409 `ADMIN_RECOVERY_NOT_REQUIRED`. | `fulfillment.integration.spec.ts` verifies active Seller rejection is refused, locked Seller recovery succeeds and same-key replay restores stock only once. Full integration passed. |

## Final checks

| Command | Observed result |
| --- | --- |
| `corepack pnpm lint:workspaces` | Passed: 11 workspace tasks. |
| `corepack pnpm typecheck` | Passed: 11 workspace tasks. |
| `corepack pnpm test` | Passed: 9 API unit suites / 46 tests and 3 API-client tests. |
| `corepack pnpm --filter @marketplace/api test:contracts` | Passed: 8 suites / 201 tests. |
| `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55434/marketplace_us9_disposable?schema=public`, `TEST_DATABASE_NAME_CONFIRMATION=marketplace_us9_disposable`; `corepack pnpm --filter @marketplace/api test:integration` | Passed: 10 suites / 44 tests on the disposable PostgreSQL 18 cluster. The integration tests reset the named disposable DB between suites. |
| Same disposable DB variables; `corepack pnpm --filter @marketplace/api prisma:schema:check` | Passed: “No difference detected.” |
| `corepack pnpm --filter @marketplace/api-client generate:types` | Passed; generated TypeScript reflects the Admin Idempotency-Key headers and updated Product/AdminStats schemas. |
| `corepack pnpm build` | Passed: 4 build tasks, including Admin panel and API. |
| `corepack pnpm test:e2e:admin` | Passed: 2 Playwright tests. The US9 browser journey stubs API responses; the existing return-confirmation browser test also passed. Database behavior is established by PostgreSQL integration, not by browser mocks. |
| `corepack pnpm format:check` | Failed: Prettier reported 92 files. Most are untouched/pre-existing files outside the Admin changes. New Admin files were formatted individually; some existing files touched by this work are also flagged. No repository-wide formatting was run; broad formatting cleanup is separate work. |

## Behavior covered

- Admin capability checks are centralized. Non-Admin access to user/product/order/statistics/audit routes returns 403 without exposing the target user ID.
- Lock increments `auth_version`, revokes active sessions, invalidates old access/refresh credentials and denies locked-user Buyer/Seller writes. Unlock permits a new login and does not revive old sessions; the prior order remains in history. Self-lock is forbidden.
- Product hide checks `Product.version`, stores the required reason, audits once, replays the same result for the same key, rejects key/body reuse conflicts, blocks a pre-hide checkout quote, and leaves old order snapshots intact. Seller DTO validation cannot unhide the product.
- Order inquiry supports Buyer/shop/status/date/search filters, detail and audit references, with no order mutation endpoint. Stats report row counts by entity/status and aggregate completed SellerOrder value only, without adding parent Order value again. Audit query paginates and removes sensitive metadata keys.
- Admin confirm/pack/reject routes remain explicit recovery actions. Confirm, pack and reject enforce the locked-Seller recovery condition and reuse existing domain-state guards.
- Contract changes require Idempotency-Key for Admin user lock/unlock and product hide. The API contract documents `expectedVersion = User.version (auth_version)` and `Product.version`; existing seller-order commands use `SellerOrder.version` and Buyer mock-result uses `MarketplaceOrder.version`.

## Task dependency and limits

- The US9 implementation artifacts and test evidence are present in this branch. T121–T129 remain unchecked in `tasks.md` because they explicitly depend on T120, which is still unchecked. US8 is outside this PR; therefore this evidence does not claim the US9 task dependency chain or story checkpoint is complete.
- No Review model exists in the current Prisma schema. Admin Product projection uses the contract’s neutral empty rating fields; review implementation remains US8.
- No `MODERATOR` role, shop-staff role, or generic order editor was added.
- Local full integration used PostgreSQL 18; CI’s PostgreSQL 17.11 remains the cross-version check.
