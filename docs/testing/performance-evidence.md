# T147 Performance and Integrity Evidence

This report records the disposable PostgreSQL run for commit `ec498625` in [GitHub Actions run 42756121824](https://github.com/kietda623/do-an-cnpm/actions/runs/42756121824). The workflow completed successfully, including API unit, contract, PostgreSQL integration, payment/cancellation concurrency, storefront checkout E2E, and fulfillment E2E checks.

## Environment

- Date: 2026-11-10
- Runner: `runnervm7aw5e`, Linux x64
- CPU: AMD EPYC 9V74 80-Core Processor
- Node.js: v24.18.0
- PostgreSQL: 17.11 (Debian 17.11-1.pgdg12+2)
- Transport: Supertest in-process against the CI PostgreSQL service
- Database: disposable CI test database, reset by the guarded integration helper

## Observed scenarios

| Scenario                                |                       Samples |      p50 |      p95 |      Max | Integrity result                                                                          |
| --------------------------------------- | ----------------------------: | -------: | -------: | -------: | ----------------------------------------------------------------------------------------- |
| SC-003 stock-5 checkout contention      |          20 checkout requests | 222.6 ms | 271.9 ms | 276.7 ms | 5 committed, 15 out of stock; 5 orders and sale movements; gross 1,000 VND; final stock 0 |
| SC-004 same-key checkout replay         |                   10 requests | 113.5 ms | 132.3 ms | 132.3 ms | One order; original total and line total 2,500 VND; final stock after checkout 4          |
| SC-004 payment start replay             |                   10 requests |  57.0 ms |  65.5 ms |  65.5 ms | One payment attempt                                                                       |
| SC-004 successful payment result replay |                   10 requests |  61.7 ms |  69.5 ms |  69.5 ms | One allocation for 2,500 VND                                                              |
| SC-004 cancellation replay              |                   10 requests |  67.7 ms |  75.9 ms |  75.9 ms | One refund for 2,500 VND; stock restored from 4 to 6                                      |
| SC-006 discovery search                 | 100 requests in 5 waves of 20 |  79.5 ms | 136.1 ms | 136.9 ms | 100/100 responses valid and under 2,000 ms                                                |
| SC-008 stats/day/month reports          |  3 sequential report requests |   5.5 ms |   9.2 ms |   9.2 ms | Completed revenue 303 VND; daily and monthly totals 303 VND, with 101/202 VND points      |

SC-004 timings use the dedicated payment/cancellation concurrency workflow step; that suite also ran and passed as part of the full API integration step.

For SC-006 the fixture had 1,000 products across 10 active shops, each with one 100,000 VND variant and 5 available units. The database reconciliation returned 100,000,000 VND in summed unit prices and 5,000 units of stock. Every returned page contained 20 products, each at 100,000 VND and available.

## Query plans and index decision

The discovery test captures the count and paged-item plans using the same recursive category CTE, optional predicates, `NEWEST` sort, and values as `DiscoveryRepository.list`. PostgreSQL ran with its natural planner settings; the test did not disable sequential scans.

- The count plan took 1.641 ms. It scanned the 1,000-row `products` and `product_variants` fixture tables sequentially; the category ancestry lookup used `categories_parent_status_id_idx`.
- The paged-item plan took 2.357 ms and returned 20 rows. It scanned the 1,000-row `products`, `product_variants`, and `inventory` tables sequentially, and used `categories_parent_status_id_idx` for category ancestry. The plan reported 54 shared-buffer hits and zero reads.
- The SC-008 revenue aggregation plan took 0.236 ms and used the existing `seller_orders_shop_completed_id_idx` index for the shop and completion-time predicate.

The measured search matches every product in the 1,000-row fixture, so PostgreSQL's sequential scans avoid extra index lookups and are appropriate at this scale. SC-006 p95 was 136.1 ms against a 2,000 ms limit. No index or cache was added: the evidence does not show an index bottleneck at the required project size, and the existing seller-order reporting index is used.

## Measurement limits

- The API and PostgreSQL ran in the same CI job; these measurements do not include public-network latency.
- The catalog tables are small and the count reconciliation and `EXPLAIN ANALYZE` run before timed searches, so the measured search results reflect warmed PostgreSQL buffers.
- This is one disposable CI run at the T147 fixture size. It does not model production data volume or traffic distribution.
- The historical T070 p95 of 153.8 ms in `docs/testing/us4-evidence.md` was measured on Windows in October and is not directly comparable to this Linux CI run.
