# US7 fulfillment evidence

## Environment

- Windows 11, Node.js 24.21.0, pnpm 12.14.0 through Corepack.
- Disposable PostgreSQL 18 cluster initialized locally at `127.0.0.1:55433`, database `marketplace_us7_disposable`. It is separate from the installed PostgreSQL service and any shared database. The integration helper required both `TEST_DATABASE_URL` and the exact `TEST_DATABASE_NAME_CONFIRMATION`; migrations reset only this disposable database.
- CI uses PostgreSQL 17.11 on Ubuntu. Local integration passed on PostgreSQL 18; CI remains the version parity check.

## Test evidence

| Check | Command/result |
| --- | --- |
| Contract | `corepack pnpm --filter @marketplace/api test:contracts` — 7 suites, 182 tests passed. Includes runtime/OpenAPI route parity and required idempotency headers, including Admin locked-Seller confirm/pack. |
| Unit | `corepack pnpm --filter @marketplace/api test` — 8 suites, 31 tests passed. Includes the BR-08 mixed seller-order status regression. |
| Fulfillment integration | `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55433/marketplace_us7_disposable?schema=public`, `TEST_DATABASE_NAME_CONFIRMATION=marketplace_us7_disposable`; `corepack pnpm --filter @marketplace/api test:integration --testPathPatterns=fulfillment.integration.spec.ts` — 1 suite, 12 tests passed. Covers suspended-shop list/detail/reject, Buyer pending cancellation and one-time stock restoration, suspended-shop confirm/pack/shipment/COD, Admin COD and locked-Seller confirm/pack, checkout rejection, revoked/locked/foreign membership denial, retry, return, mock payment/refund, illegal shipment jumps, receive eligibility and API restart persistence. |
| Full integration | Same disposable DB variables; `corepack pnpm --filter @marketplace/api test:integration` — 9 suites, 40 tests passed. Existing checkout integration includes SC-003 (20 buyers contend for stock 5: 5 checkouts succeed, 15 receive 409, five sale movements) and SC-004 (10 same-key replays resolve to one order/movement). |
| Prisma/schema parity | Same disposable DB variables; `corepack pnpm --filter @marketplace/api prisma:schema:check` — “No difference detected.” |
| Workspace lint/typecheck | `corepack pnpm lint:workspaces` and `corepack pnpm typecheck` — both passed after the final source changes. |
| Two-shop checkout E2E | `corepack pnpm test:e2e:checkout` — 1 test passed with products from two shops, COD and two seller-order snapshots. |
| Seller E2E | `corepack pnpm test:e2e:seller` — 2 tests passed, including suspended-shop order confirm, pack, failed shipment, retry, delivery and COD UI. |
| Buyer E2E | `corepack pnpm test:e2e` — 8 tests passed, including mock payment, pending-part cancellation, delivered timeline and Buyer receive. |
| Admin E2E | `corepack pnpm test:e2e:admin` — 1 test passed for failed shipment return confirmation with reason/version. |
| Build | `corepack pnpm build` — all four build targets passed. |
| Format check | `corepack pnpm format:check` reports 190 files in the Windows checkout. The pre-PR baseline was 177 existing files; the remainder are changed/new files that inherit CRLF in this checkout. See the EOL finding below; this PR does not format the repository wholesale. |

The first COD regression test run was intentionally red: submitting `MarketplaceOrder.version` returned HTTP 200 instead of the required 409. After changing the comparison to `SellerOrder.version`, tests prove current SellerOrder version succeeds, stale and MarketplaceOrder versions return 409, replaying the same event ID returns the existing attempt with one allocation, and a seller from another shop gets 404. COD collection does not increment `SellerOrder.version`.

The locked-Seller Admin recovery test was also red first: `POST /admin/seller-orders/{id}/confirm` returned 404 because the contract route had no runtime handler. After adding the Admin confirm/pack handlers, the targeted PostgreSQL integration suite passes 12/12 and verifies a locked Seller cannot use the Seller route while Admin can confirm and pack with a reason recorded in audit. No `spec.md` change was made.

Earlier red evidence during US7 work: an ACTIVE member could not read a suspended shop’s existing seller orders (404) or confirm them (404); initial shipment history was absent; the aggregate unit expected PENDING but received SHIPPING. The shared fulfillment access policy, initial shipment event and BR-08 derivation corrected these failures. Buyer cancellation with the shop suspended succeeds and restores inventory once.

## Existing format failures

Git reports tracked files as index LF / working-tree CRLF (`git ls-files --eol package.json` showed `i/lf w/crlf`). Prettier check fails with its default LF expectation but passes for the same file with `--end-of-line crlf`, confirming Windows checkout EOL conversion as the cause. The 177 files failing before this work were pre-existing; the current count includes EOL warnings in changed/new files too. No unrelated files were rewritten. Propose a separate small PR adding `.gitattributes` with `* text=auto eol=lf`, then verify the checkout and formatter behavior there.

## E2E boundary

Browser E2E tests stub API responses and cover the two-shop COD checkout, mock payment, suspended-shop Seller fulfillment/failure/retry/COD, Buyer cancellation/receipt and Admin return screen. PostgreSQL integration tests cover matching state transitions, permissions, idempotency, refunds, stock effects and a real API restart with persisted SellerOrder/Shipment rows. The browser is not connected to the live API/database in these E2E runs; keep that distinction visible when reading the evidence.

The checkout Playwright config initially failed to start its web server because the Windows `pnpm` shim was not executable. Using `corepack pnpm` to match the other Playwright configs fixed startup; checkout then passed 1/1.

## Red and green COD evidence

- Red command: targeted fulfillment integration with the disposable PostgreSQL variables above; expected `409`, observed `200` when passing `MarketplaceOrder.version`.
- Green command: same targeted integration command; 11/11 tests passed after comparing against `SellerOrder.version`.
- Admin recovery red: targeted integration returned 404 for the contract-declared Admin confirm endpoint. Green: same targeted integration command; 12/12 tests passed after adding the runtime handler and Admin pack path.

## Task path notes

T105/T106 name `shipment.repository.ts`, `receive-order.service.ts` and `cod-collection.service.ts`, which are not present in this checkout. The behavior is implemented in the existing `ShippingService`, `FulfillmentService` and `PaymentService` modules and is covered by the integration evidence above; no repository/service placeholder files were added.


## Live acceptance follow-up (2026-10-27)

Validated on main 5ca198b with the fulfillment UI/session follow-up. `pnpm test:e2e:fulfillment` builds the API and starts actual Buyer, Seller and Admin Next apps with PostgreSQL. Final result: 1/1 passed (59.1s test body). No request interception is used. The prior intercepted journey is retained in commerce-fulfillment-ui.spec.ts.

Covers two-shop MOCK/COD checkout, partial cancellation, delivery failure/retry using the same shipment, API process restart, Buyer receipt, delivered-only COD and Admin physical-return confirmation. Assertions verify MOCK captured 2500/refunded 1250/outstanding 0; COD captured 1250/refunded 0/outstanding 0; final stocks A=8 and B=10 from 10 each. Screenshots: test-results/fulfillment-live-buyer.png and fulfillment-live-admin.png.

Requires migrated TEST_DATABASE_URL with database suffix _test or _disposable and exact TEST_DATABASE_NAME_CONFIRMATION. Fixtures are unique and do not reset the database. Shared WebSession restoration prevents concurrent refresh; unmounted checkout effects no longer clear sessions. Workspace typecheck passed.
