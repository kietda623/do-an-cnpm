# T147 Performance and Integrity Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record reproducible SC-003/004/006/008 latency, query-plan, stock, and money evidence on the marketplace's PostgreSQL integration path.

**Architecture:** Move the existing 1,000-product discovery workload into a dedicated performance integration suite and capture the planner's natural `EXPLAIN ANALYZE` output. Reuse and instrument the existing checkout, idempotency, and reporting scenarios so timing evidence stays attached to the tests that assert persisted correctness. Use existing indexes unless observed plans and measurements justify an additive change; do not add caching in this task.

**Tech Stack:** TypeScript, Jest 30/SWC, NestJS, Supertest, Prisma, PostgreSQL, Node `perf_hooks` / `os`.

**Spec:** [T147 Performance and Integrity Review Design](../specs/2026-11-10-performance-t147-design.md)

## Global Constraints

- SC-006 uses 1,000 products across 10 shops, 20 concurrent guest requests, and 100 raw observations; at least 95 observations must be under 2 seconds.
- SC-003 uses 20 checkout requests competing for stock 5; exactly 5 commit, 15 are out of stock, and final stock is 0.
- SC-004 replays checkout, payment, and cancellation 10 times with the same key; each operation has one business effect and exact money/order/stock outcomes.
- SC-008 includes only completed SellerOrders in revenue; known daily/monthly totals must match exactly and must not double-count MarketplaceOrder totals.
- Integration tests may reset only a database ending in `_test` or `_disposable` when `TEST_DATABASE_NAME_CONFIRMATION` matches exactly.
- Do not add a cache or dependency. Add/change an index only after real-plan and latency evidence; any schema change must use an additive migration.

## Review Focus

- A 1,000-row fixture can appear fast while returning the wrong count, price, or availability; assert all three and reconcile aggregate fixture totals.
- A forced index scan can hide the planner's normal choice; capture the actual plan without overriding `enable_seqscan`.
- Concurrent checkout may return the right HTTP counts while duplicating orders or stock movements; compare persisted orders, movements, total VND, and final inventory.
- Same-key retries may return 2xx while duplicating capture/refund or restoring stock twice; assert exact replay response identity and ledger rows.
- Revenue may be fast but include cancelled/refunded/unpaid rows or double-count parent and seller totals; assert known daily/monthly values and excluded states.

---

### Task 1: Add and test latency summary helpers

**Files:**

- Create: `apps/api/test/helpers/performance-metrics.ts`
- Test: `apps/api/test/performance-metrics.spec.ts`

**Interfaces:**

- Produces `summarizeLatencies(samples: number[], thresholdMs: number)` returning sample count, p50, p95, maximum, and count under the supplied threshold using nearest-rank percentiles.
- The helper rejects an empty sample list and non-finite or negative durations.

**Steps:**

- [x] Write unit tests for p50/p95/max/count, threshold count, empty input, and invalid values.
- [x] Run `corepack pnpm --filter @marketplace/api exec jest --config jest.config.cjs --selectProjects unit --testPathPatterns=performance-metrics.spec.ts --runInBand`.
  - Expected: FAIL because the helper module does not exist yet.
- [x] Implement the smallest pure helper that satisfies the tests.
- [x] Re-run the focused test command.
  - Expected: all latency-summary tests pass.

### Task 2: Isolate and strengthen the discovery benchmark

**Files:**

- Create: `tests/performance/discovery.spec.ts`
- Create: `apps/api/test/performance/discovery.spec.ts`
- Modify: `apps/api/test/integration/discovery.integration.spec.ts`
- Modify: `apps/api/jest.config.cjs`

**Interfaces:**

- The integration Jest project discovers `tests/performance/**/*.spec.ts`.
- The repository-level T147 entrypoint delegates to the API-package suite so its dependencies resolve during typecheck; that suite owns the 1,000-product fixture, 100-observation benchmark, inventory/price reconciliation, and plan capture.
- Behavioral discovery tests remain in `apps/api/test/integration/discovery.integration.spec.ts`.

**Steps:**

- [x] Write the dedicated test to seed 10 shops × 100 products, price each at 100,000 VND, stock each at 5, and assert 1,000 products, 100,000,000 summed unit prices, and 5,000 units.
- [x] Add the repository-level Jest entrypoint and API integration root; the existing `test/**/*.ts` include typechecks the package-local suite.
- [x] Run the focused performance integration test against an explicitly confirmed disposable database.
  - Result: the CI PostgreSQL service passed the guarded disposable-database helper; fixture totals reconciled, 100/100 responses were valid and under 2,000 ms, and p95 was 136.1 ms. No local test database was configured.
- [x] Measure 100 searches in five waves of 20; verify result count, `minimumPrice`, and availability for every response.
- [x] Capture the actual discovery count and paged-item plans with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`, including the repository CTEs, optional filters and default sort; remove the old forced `enable_seqscan = off` assertion with the moved performance case.
- [x] Run the focused performance integration test in CI.
- [x] Run the behavioral discovery integration tests.
  - Expected: existing category, visibility, pagination, and ownership behavior remains green.

### Task 3: Capture SC-003, SC-004, and SC-008 timings with integrity outcomes

**Files:**

- Modify: `apps/api/test/integration/checkout.integration.spec.ts`
- Modify: `tests/concurrency/payment-cancellation.spec.ts`
- Modify: `apps/api/test/integration/reviews-revenue.integration.spec.ts`

**Steps:**

- [x] Extend the 20-buyer stock-5 test with per-request latency observations and exact order-item gross total; retain its 5-success/15-out-of-stock, five movements/orders, and stock-zero assertions.
- [x] Add the assertion that the contention scenario reconciles to 1,000 VND gross at 200 VND per successful unit.
  - Expected: the assertion passes only if persisted successful order items and stock movement count agree with 5 successful requests.
- [x] Measure the existing ten-way checkout/payment/cancel replays and assert the 2,500 VND allocation/refund and stock transition 6 → 4 → 6 remain exact.
- [x] Measure the existing SC-008 stats/day/month report calls and retain exact 303 VND total with 101/202 VND daily and monthly points.
- [x] Print one concise machine-readable line per SC scenario with sample count, elapsed/percentile values, and reconciled business totals.
- [x] Run focused PostgreSQL cases for checkout contention, payment/cancellation replay, and reviews/revenue.
  - Result: full API integration and the dedicated payment/cancellation concurrency step passed in CI; each scenario printed its observed values.

### Task 4: Publish evidence, review indexes, and close T147

**Files:**

- Create: `docs/testing/performance-evidence.md`
- Modify: `specs/001-marketplace-mvp/tasks.md`
- Conditional: an additive Prisma migration and schema/index tests only if measured evidence justifies an index change.

**Steps:**

- [x] Run `EXPLAIN ANALYZE` output from the actual performance fixture and record the natural planner choices for discovery and the actual seller-revenue aggregation predicate.
- [x] Review index candidates against actual plans and latency; the sequential scans fit the 1,000-row broad-match fixture, the seller revenue index is used, and p95 is well under target. No index or cache change is justified.
- [x] Write `docs/testing/performance-evidence.md` with SC-003/004/006/008 observations, query plans, fixture reconciliation, host/runtime/PostgreSQL/transport, and limits.
- [x] Run focused performance, checkout contention, replay, and revenue integration tests, then the full API integration suite when CI provides its PostgreSQL service.
  - Result: CI run 42756121824 passed the API PostgreSQL integration and payment/cancellation concurrency steps; the evidence report cites the observed output.
- [x] Run API unit tests, API typecheck/lint, changed-file formatting, and `git diff --check`.
  - Result: local API unit 25 suites/170 passed/1 skipped, typecheck, lint, Prettier, and diff checks passed; CI also passed workspace lint/typecheck/build.
- [x] Mark T147 complete after evidence includes the observed CI result.
- [x] Request one whole-branch code review, fix any Critical/Important findings test-first, and rerun affected suites.
  - Result: review confirmed the EXPLAIN SQL mirrors both production repository queries and every returned item is checked. No findings remained; CI run 42756121824 passed on the reviewed code.

## Index decision gate

The existing code already has shop/category/status and variant/inventory/reporting indexes. The test must not force their use. If the actual 1,000-product p95 is below 2 seconds and the natural plans have no avoidable high-cost scan, keep the schema unchanged and document that result. If either condition fails, identify the measured bottleneck, add the smallest additive index, then compare the same fixture and query plan before/after.
