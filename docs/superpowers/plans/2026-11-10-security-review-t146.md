# T146 Security Review Implementation Plan

> **For implementation:** execute this checklist in order. Keep each security correction test-first and limited to a reproduced finding.

**Goal:** Complete T146 with an auditable review of API mutation authorization and the named cross-cutting security controls, negative regression tests, and an evidence report.

**Design:** [T146 Security Review Design](../specs/2026-11-10-security-review-t146-design.md). The API integration suite will own the route-level unauthenticated matrix in `tests/security/authorization.spec.ts`; existing focused tests remain the evidence for deep scenarios unless a gap is found.

**Stack:** NestJS 12, TypeScript, Jest 30/SWC, Supertest, PostgreSQL integration fixtures, Redis integration tests.

## Tasks

- [x] 1. Inventory every mutation route and its security boundary.
  - Cross-reference controller route decorators, guards, trusted actor identity, and service-level ownership checks.
  - Record public exceptions (register/login and refresh-token flow) separately from Bearer-protected writes.
  - Review existing IDOR coverage in identity, shops, catalog, cart/checkout, fulfillment, reviews, payments, and admin integrations.
  - Files: `apps/api/src/modules/**/**controller.ts`, corresponding services and integration tests.
  - Check: source inventory includes every `POST`, `PUT`, `PATCH`, and `DELETE` route.

- [x] 2. Add a route-wide unauthenticated authorization matrix.
  - Add `tests/security/authorization.spec.ts` with every protected mutation path and its expected unauthenticated status.
  - Extend the API Jest integration project's roots and match patterns to include `tests/security/`.
  - Include targeted cross-principal checks for any IDOR boundary not already covered by an existing negative integration test.
  - Keep the implementation beside API dependencies in `apps/api/test/security/authorization.spec.ts`; the required repository-level file imports that suite.
  - Files: `tests/security/authorization.spec.ts`, `apps/api/test/security/authorization.spec.ts`, `apps/api/jest.config.cjs`, `apps/api/tsconfig.json`.
  - Verify: run the 45 no-token probes; if a protected route is not rejected, retain that failing case before correcting its guard.

- [x] 3. Review the cross-cutting security controls against tests and implementation.
  - CSRF/CORS: `apps/api/test/http/cors-csrf.spec.ts` and HTTP configuration.
  - Rate limit: limiter unit/HTTP/auth integration tests; Redis store integration when its test URL is configured.
  - Upload: validation, size/pixel limits, ownership, persistence cleanup, and local asset path checks.
  - Refresh reuse: rotation, replay/revocation, cookie handling, and errors across browser/native transports.
  - Secret redaction: structured keys and text values, including authorization, tokens, credentials, and PII.
  - Add a negative regression test before changing code for each verified gap.
  - Files: relevant `apps/api/src/**`, `apps/api/test/**`, `tests/security/authorization.spec.ts`.

- [x] 4. Fix reproduced security findings.
  - Implement the smallest corrective change that makes the failing negative test pass.
  - Re-run each focused test immediately after its fix.
  - Do not describe unexecuted external Redis checks as passing.

- [x] 5. Publish evidence and close T146.
  - Add `docs/testing/security-review.md` with route classes, controls, test evidence, commands/results, fixes, and limits.
  - Run focused authorization, CSRF/CORS, rate-limit, upload, refresh-reuse, and logger tests; run the API integration suite if environment permits.
  - Run `git diff --check` and inspect the final diff.
  - Mark T146 complete in `specs/001-marketplace-mvp/tasks.md` only when evidence is present.
  - Files: `docs/testing/security-review.md`, `specs/001-marketplace-mvp/tasks.md`.

## Review focus

- No write route trusts a user ID, role, shop ID, or ownership claim from the request body in place of the authenticated context and current persisted membership.
- Admin guards are applied before mutation and service policies still scope resources.
- Tests assert denial and absence of unauthorized state changes for representative object-level checks.
- Evidence labels distinguish tests actually run from source review and environment-dependent checks.
