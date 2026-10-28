# US8 review and Seller reporting evidence

## Environment and scope

- FR-40–45, BR-05/BR-10, tasks T112–T120; branch based on `origin/main` at `8ee488a`.
- Windows 11, Node.js 24, pnpm 12 through Corepack. PostgreSQL 18 runs in an isolated local cluster on `127.0.0.1:55435`; integration uses `marketplace_us8_disposable` and exact `TEST_DATABASE_NAME_CONFIRMATION`. No shared database is used. CI uses PostgreSQL 17.11.
- Review adds migration `0008_reviews`, UNIQUE(order_item_id), CHECK rating 1–5 and `(product_id, created_at, id)` index. Previous migrations remain unchanged.
- The user confirmed that ACTIVE users with ACTIVE memberships may read reviews, stats and revenue for an ACTIVE or SUSPENDED shop; PENDING/REJECTED shops are denied. This clarification is in BR-10 and the API contract.
- The user resolved the reporting range ambiguity: both Seller stats and revenue require UTC `from` and `to` with `from < to`; revenue also requires `groupBy=DAY|MONTH`. The API has no default or range-length limit. Seller Center supplies an editable 30-day default and converts Vietnam local time to UTC.
- The API PostgreSQL pool forces UTC, including when connection URL options request a different timezone. This corrects future reads/writes; previously mis-stored timestamps are not repaired or backfilled.

## Red and green evidence

| Behavior | Red before implementation | Green |
| --- | --- | --- |
| Runtime/OpenAPI routes | `test:contracts --testPathPatterns=reviews-revenue.contract.spec.ts`: 5 failures because the five contract routes had no runtime handler. | Contract suite: 9 suites / 221 tests passed, including US8 route/auth/filter/error and required-range checks. |
| Review and reporting | US8 integration initially returned 404 for incomplete-item review (expected 422), both parallel reviews (expected 201/409), suspended Seller reads and reports. Fixture setup errors were corrected before capturing this red result. | Targeted US8 PostgreSQL integration: 11 tests passed. It checks ownership, 422, rating bounds, trimmed comments, 201/409 duplicate requests, two-connection barrier and unique violation, public visibility, cross-shop isolation, revoked/locked users and shop status rules. |
| Timezone | API PostgreSQL session was `Asia/Bangkok`, and `2026-10-26T16:59:59Z` persisted as `09:59:59Z`. A regression with a non-UTC connection URL then failed when URL options overrode the pool setting. | Targeted integration confirms API session UTC and verifies both ORM readback and stored UTC; DAY/MONTH groups across 31 October/1 November Vietnam time yield 101 and 202 VND, total 303. A cancelled and refunded 999 VND SellerOrder and another shop's 9999 VND do not enter the result. |
| Buyer locking race | With an uncommitted concurrent account lock, review submission finished before the lock committed. | A real row-lock wait and subsequent 401 are verified after rechecking ACTIVE under the User lock before Order and SellerOrder. |
| Read-only existing review | Product detail returned `ratingAverage=null`/`ratingCount=0`; OrderItem omitted review contents; the browser lacked read-only review text. | Targeted integration and mocked browser tests confirm real rating aggregate, `reviewId` and read-only rating/comment on OrderItem, including Admin Product projection. |
| Seed | The seed integration test failed because `reviews-statistics.seed.ts` did not exist. | It runs twice idempotently on the confirmed disposable DB and checks 101/202 completed, 999 cancelled/refunded, one review and midnight instants; mismatched confirmation is rejected. |
| Required reporting parameters | After the contract decision, targeted contract tests reported 8 failures: runtime Swagger still marked `from`/`to` optional and missing parameters returned 200. Seller browser test also failed because it sent no range. | Targeted contract tests passed 20/20, including missing `from`, `to`, `groupBy`, malformed dates, invalid grouping and reversed/equal ranges with field-specific 400 details. Seller browser test passed with explicit UTC query values and editable Vietnam-time inputs. Integration accepts a range from 1900 to 2999 without an arbitrary length limit. |

## Commands and observed results

| Command | Result |
| --- | --- |
| `corepack pnpm lint:workspaces` | Passed, 11 tasks. |
| `corepack pnpm typecheck` | Passed, 11 tasks. |
| `corepack pnpm --filter @marketplace/api test:contracts --testPathPatterns=reviews-revenue.contract.spec.ts` | Passed, 20 tests after the required-range change. |
| Confirmed disposable DB; `corepack pnpm --filter @marketplace/api test:integration --testPathPatterns=reviews-revenue.integration.spec.ts` | Passed, 11 tests. |
| Confirmed disposable DB; `corepack pnpm --filter @marketplace/api prisma:schema:check` | Passed, `No difference detected`. |
| `corepack pnpm --filter @marketplace/api-client generate:types` | Passed after OpenAPI changes. |
| `corepack pnpm test:e2e:us8` | Passed, 2 browser tests with mocked API responses. |
| Confirmed disposable DB; `corepack pnpm test:e2e:us8-live` | Passed, 1 browser test using real API and PostgreSQL. The completed OrderItem is a database fixture; the test covers Buyer login/review/persistence/public list and Seller login/dashboard, not checkout or fulfillment. |
| Upgrade rehearsal | On a second isolated DB `marketplace_us8_upgrade_disposable`, Prisma deployed 0001–0007, a User fixture was inserted, then 0008 was deployed. The User remained, and the rating CHECK and both Review indexes were verified. |
| `corepack pnpm test` | Passed: 9 API unit suites / 46 tests and 5 API-client tests. |
| `corepack pnpm --filter @marketplace/api test:contracts` | Passed: 9 suites / 221 tests. |
| Confirmed disposable DB; `corepack pnpm --filter @marketplace/api test:integration` | Passed: 11 suites / 55 tests. |
| `corepack pnpm build` | Passed: 4 build tasks. |
| `corepack pnpm format:check` | Windows run failed with 95 file warnings; most are pre-existing, and some touched files are also flagged. Only new files were formatted individually; no repository-wide formatting was performed. |

## Limits and task paths

- Mock E2E is not database evidence; the additional live test uses an actual API and database. The live fixture creates a completed order directly and does not prove the checkout-to-completion lifecycle.
- The Seller reports use repeatable-read, read-only transactions and only sum completed SellerOrder amounts; cancelled/refunded parts and other shops are excluded. VND amounts remain integer decimal strings.
- Task file paths T112–T120 match the created implementation and test paths, including the real seed. T120 was ticked before US9 evidence was rerun; T121–T129 are recorded separately with the rerun evidence.
