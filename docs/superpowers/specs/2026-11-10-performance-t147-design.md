# T147 Performance and Integrity Review Design

## Intent

Produce fresh, reproducible evidence for SC-003, SC-004, SC-006, and SC-008 before considering a cache. The evidence must pair response timings with persisted stock and money outcomes so a fast but incorrect result cannot pass.

## Existing state

- `apps/api/test/integration/discovery.integration.spec.ts` already creates 1,000 products across 10 shops and records 100 search observations in five waves of 20. The old p95 was 153.8 ms, recorded in `docs/testing/us4-evidence.md` on 2026-10-23.
- Its index assertion sets `enable_seqscan = off` and checks a shop/status index with a synthetic UUID. It proves that index can be selected, but it does not record the planner's natural choice for the measured workload.
- Existing PostgreSQL tests already prove SC-003's 20-buyer / stock-5 race, SC-004's ten same-key checkout/payment/cancel replays, and SC-008's known daily/monthly revenue totals. Those scenarios should supply the integrity checks; duplicating their setup would add cost and make evidence disagree more easily.
- Relevant indexes already exist for product shop/category/status ordering, product variant price lookup, inventory variant/shop lookup, and seller-order shop/completion-time reporting.

## Goals

- Run the 1,000-product / 10-shop catalog search benchmark with 20 concurrent guests and 100 timed responses; report p50, p95, maximum, failures, host, CPU, runtime, database, and request transport.
- Capture PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` with the real planner settings and representative fixture values. Record whether the planner uses an index or a sequential scan and why.
- Reconcile the load fixture's known unit prices and stock, and emit timings/outcomes for the existing SC-003, SC-004, and SC-008 PostgreSQL scenarios.
- Keep the SC-006 gate at at least 95 of 100 responses under 2,000 ms.

## Non-goals

- Do not add Redis, a cache, an external load-testing dependency, or production telemetry.
- Do not add an index merely to force an index scan. Add or change an index only if measured query plans and latency show a useful improvement; document any required additive migration.
- Do not change checkout, payment, inventory, or reporting business rules while measuring them.
- Do not connect the benchmark to a shared or hosted database. Integration setup must continue to require the disposable-database name and exact confirmation.

## Approaches considered

1. **Keep all measurement in the discovery integration suite.** This changes the fewest files, but leaves performance evidence mixed with behavioral coverage and does not place the benchmark at the T147 path.
2. **Move the discovery workload to a dedicated performance suite and instrument existing integrity scenarios.** This gives T147 a clear benchmark entry point, measures one source of truth for checkout/replay/revenue behavior, and avoids duplicating complex fixtures. **Use this approach** because it fits the required test path and existing PostgreSQL harness.
3. **Add a separate load generator such as k6.** This could model network traffic, but it adds a tool and environment outside the current CI harness. The approved SC-006 target already measures Supertest against a real PostgreSQL database, so this is unnecessary for T147.

The user requested planning and implementation in one pass. Approach 2 is the implementation decision for this batch.

## Design

- Move the existing 1,000-product test into `apps/api/test/performance/discovery.spec.ts` and expose it at `tests/performance/discovery.spec.ts`, which is added to the API integration Jest roots. The package's existing `test/**/*.ts` include typechecks the suite; keep discovery behavior tests in their current suite.
- Seed 10 active shops with 100 products each. Use a known price of 100,000 VND and stock of 5 per product; assert 1,000 products, 100,000,000 VND summed unit-price values, and 5,000 available units before measuring responses.
- Run five waves of 20 concurrent `/api/v1/products` searches, record all 100 durations, verify each response's status/count/known price/availability, compute p50/p95/max, and print a machine-readable summary.
- Capture the discovery count and paged item planner output using the same CTEs, optional predicates, sort, and normalized inputs as `DiscoveryRepository.list`, without changing `enable_seqscan`. Record the actual seller-revenue aggregation plan with its existing integration fixture; do not make tests brittle to cost-based sequential scans on small fixtures.
- Add timing and concise reconciliation output to the existing SC-003 checkout race, SC-004 same-key replay, and SC-008 revenue report tests. Preserve their existing assertions as the source of truth for state and totals.
- Add `docs/testing/performance-evidence.md` with measured values from the actual local or CI run, query-plan observations, index decision, and explicit host/database/transport limits.

## Constraints and open questions

- PostgreSQL-backed tests may run only when `TEST_DATABASE_URL` names a `_test` or `_disposable` database and `TEST_DATABASE_NAME_CONFIRMATION` matches exactly; the integration helper resets that database.
- The local worktree has no `.env.test` and its Docker daemon is unavailable. Use the repository CI service containers for disposable PostgreSQL evidence if no safe local disposable database is configured.
- The existing CI and integration test stack use Node, Jest, Supertest, Prisma, and PostgreSQL. No new dependency is needed.
- No unresolved product decision blocks implementation; query plans and index changes are determined from observed evidence.
