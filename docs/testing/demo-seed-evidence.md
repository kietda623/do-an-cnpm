# T150 Demo Seed Evidence

## Scope and environment

- Date: 2026-11-06.
- Scope: deterministic `seed:demo` command, 10 shops, 1,000 products, and four order/payment/shipment fixtures. Existing seed commands and migrations were not changed.
- OS: Windows 11 Home Single Language, build 26200, x64.
- Node.js: 24.21.0. The repository `.nvmrc` pins 24.18.0; this machine used its installed 24.21.0 runtime.
- pnpm: 12.14.0. Prisma: 7.10.1. PostgreSQL: 18.1, x64.
- PostgreSQL ran in a newly initialized local cluster bound to `127.0.0.1:55439`, isolated from the app and shared databases. Integration tests used `t150_demo_disposable`; direct CLI verification used a separate `t150_demo_cli_disposable` database. Credentials were generated for this temporary cluster and never committed or printed.
- The test database helper applied migrations only to `t150_demo_disposable`. For CLI verification, migrations were deployed separately to `t150_demo_cli_disposable` with `DATABASE_URL` set to that exact disposable URL. `seed:demo` itself does not migrate, reset, truncate, or delete data.
- Bootstrap passwords were generated only in the PowerShell process environment. Both CLI outputs were checked and contained none of the three values.

## Red / green evidence

| Check                                           | Observed result                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fixture/config unit tests before implementation | Red because the planned seed modules were absent. After implementation, fixture planner: 4 tests passed; disposable DB/password config: 12 tests passed.                                         |
| Seed resolver test before loader update         | Red: the `.js` import fallback rejected `./demo-fixtures.js` with the original `module not found` error. After the scoped resolver update: 4 tests passed.                                       |
| First PostgreSQL seed run                       | Red on the existing `marketplace_orders_deadline_consistent` constraint. MOCK order deadline was corrected to `created_at + 15 minutes`.                                                         |
| Next PostgreSQL seed run                        | Red on `order_events_actor_kind_check`; schema allows only `USER` or `SYSTEM`. The seed event now uses `USER` for seller action.                                                                 |
| Snapshot write invariant                        | The full API unit suite caught the test-enforced requirement that the builder call initialize `targetSellerOrdersSnapshot` directly. The seed now calls the existing builder at that write site. |
| Focused PostgreSQL integration after fixes      | Green: 1 suite / 1 test on the isolated disposable PostgreSQL database. The test verifies the complete graph, inventory movements and second-run preservation.                                   |

## Commands and results

| Command                                                                                                               | Result                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                                                             | Pass; installed the locked workspace dependencies, no lockfile changes. The offline attempt had stopped because `lucide-react@1.66.0` was missing from the local tarball store. |
| `corepack pnpm --offline --filter @marketplace/api typecheck`                                                         | Pass.                                                                                                                                                                           |
| `corepack pnpm --offline --filter @marketplace/api test`                                                              | Pass: 17 suites / 82 tests.                                                                                                                                                     |
| `corepack pnpm --offline --filter @marketplace/api test:integration --testPathPatterns=demo-seed.integration.spec.ts` | Pass: 1 suite / 1 test; PostgreSQL 18.1, `t150_demo_disposable`, port 55439.                                                                                                    |
| `corepack pnpm --offline --filter @marketplace/api prisma:migrate:deploy`                                             | Pass for CLI preparation only, with `DATABASE_URL` pointing to `t150_demo_cli_disposable` on the isolated cluster. This migration ran separately from the seed command.         |
| `corepack pnpm --offline --filter @marketplace/api seed:demo` (run twice)                                             | Pass both runs on `t150_demo_cli_disposable`. Output contained no bootstrap password values; second run preserved the same row/state summary.                                   |
| `corepack pnpm lint:workspaces`                                                                                       | Pass: 9 tasks. Initial attempt failed because `@eslint/js` was not linked in the worktree; a frozen-lockfile install from the registry repaired the local install.              |
| `corepack pnpm typecheck`                                                                                             | Pass: 9 tasks.                                                                                                                                                                  |
| `corepack pnpm format:check`                                                                                          | Fails on 139 existing workspace files outside this change. Targeted Prettier check for all T150 seed, resolver, and test files passes. No broad formatting was applied.         |
| `corepack pnpm test`                                                                                                  | Pass: 3 workspace test tasks (API 82, API client 28, UI web 7).                                                                                                                 |
| `corepack pnpm build`                                                                                                 | Failed under default Turbo concurrency because the machine ran out of memory while building the parallel Next.js apps.                                                          |
| `corepack pnpm exec turbo run build --concurrency=1`                                                                  | Pass: 4 build tasks; serial execution avoided the memory failure. Three tasks used successful Turbo cache entries, and storefront built in this run.                            |

## Observed database summary

The first and second CLI run produced identical summaries:

- 12 demo users; 10 active shops; 10 visible categories.
- 1,000 products, variants, inventory rows, and product-image relations; 1,010 metadata-only assets; exactly one hidden product.
- Four orders: completed COD, expired/cancelled MOCK, pending COD, and refunded/cancelled MOCK.
- Three attempts: one cancelled MOCK, one succeeded MOCK, and one succeeded `COD_SIMULATION`; one refund; one delivered shipment; 1,006 demo inventory movements.
- Inventory across demo products: minimum 23, maximum 25, total 24,998. Product 1 ends at 23 after the pending reservation and completed COD sale; cancelled fixtures restore their units.
- The integration test added a valid one-unit inventory adjustment and changed the pending order/seller-order/payment versions and status; a second call to `seedDemoDatabase` preserved those values and all fixture row counts.

## Review and outstanding scope

- AGY read-only review was attempted in plan/sandbox mode but did not return findings: CLI ended with `RESOURCE_EXHAUSTED (429): Individual quota reached`. A manual review of the branch delta against the schema, seed invariants, and integration assertions found no remaining blocking issue. This is not an AGY review pass.
- T149 is still open. T150 remains unchecked and must not be marked complete until its dependency is satisfied.
- The repository targets PostgreSQL 17, but the local disposable test cluster was PostgreSQL 18.1; PostgreSQL 17 execution was unavailable in this environment.
- The CLI command was exercised on a local disposable database only. No shared or production database was seeded.
