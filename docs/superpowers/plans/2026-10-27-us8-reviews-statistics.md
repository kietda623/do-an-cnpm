# US8 Reviews and Seller Statistics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven development for each task.

**Goal:** Deliver reviews and simulated Seller statistics with PostgreSQL-enforced uniqueness, shop isolation and reproducible evidence.

**Architecture:** The Review module owns review creation and safe projections; the Shop statistics service reads SellerOrder totals from a repeatable-read snapshot. Existing catalog and order query services expose aggregate ratings and review IDs through their established interfaces. The centralized shop access policy checks active membership and active or suspended shop status on every private read.

**Tech Stack:** NestJS, Prisma/PostgreSQL, OpenAPI, TypeScript, Next.js, Jest and Playwright.

**Spec:** `specs/001-marketplace-mvp/spec.md` BR-05, BR-10, FR-40–45; `contracts/api.md`; tasks T112–T120.

## Global Constraints

- Do not alter previous migrations or use shared databases; use migration `0008_reviews` and an isolated test database.
- Revenue is integer VND from completed SellerOrders, grouped by completion date in Asia/Saigon; never add parent Order amounts.
- Only an ACTIVE member of an ACTIVE or SUSPENDED shop may read its reviews and reports; reject PENDING/REJECTED and cross-shop requests.
- Write tests first and retain observed red and green results; do not tick tasks without supporting evidence.

## Review Focus

- Concurrent duplicate submissions must produce one Review and one 409, protected by a database unique constraint.
- Buyer ownership and COMPLETED state must be checked in the write transaction.
- A UTC timestamp adjacent to Vietnam midnight must fall into the correct day and month.
- Hidden products and unrelated shops must not leak private review or reporting data.
- Locked users and revoked memberships must immediately lose private access.

## Tasks

1. Add `tests/contracts/reviews-revenue.contract.spec.ts` and `apps/api/test/integration/reviews-revenue.integration.spec.ts`; verify red for the five missing routes and record the exact results.
2. Add Review schema and `0008_reviews` constraints, then implement `review.service.ts` and `reviews.controller.ts` with transaction ownership, unique conflict and safe public/shop reads; connect actual rating aggregates and OrderItem review IDs.
3. Add `shop-statistics.service.ts` and `shop-statistics.controller.ts` for isolated counts and completed revenue, using one repeatable-read transaction and DAY/MONTH grouping in Asia/Saigon.
4. Add storefront review form/list and Seller dashboard/revenue/review filters, with loading, empty and error states; write Playwright coverage for the chosen UI seams.
5. Regenerate OpenAPI client, add an isolated seed, run the requested CI commands and applicable E2E, record `docs/testing/us8-evidence.md`, and tick only evidenced T112–T120.
6. If T120 is complete, rerun the US9 evidence and update T121–T129 in a separate commit only when its tests are actually reproduced. Push and open the requested PR without merging.
