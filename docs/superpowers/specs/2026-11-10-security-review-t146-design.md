# T146 Security Review Design

## Goal

Review the marketplace API's state-changing routes and the security controls named in T146. Add repeatable negative authorization checks and an evidence report. Fix only issues reproduced by a failing test or a verifiable source-level gap.

## Scope

- Every API `POST`, `PUT`, `PATCH`, and `DELETE` route: record whether it is intentionally public, Bearer-authenticated, shop-member scoped, or administrator-only.
- IDOR boundaries for user-owned records, shop membership, buyer/seller order roles, and administrator operations.
- Existing CSRF/CORS behavior for cookie-authenticated browser auth routes and Bearer-authenticated API writes.
- Authentication rate limits and Redis-backed shared state/fail-closed behavior.
- Upload validation, storage exposure, and ownership checks.
- Refresh-token rotation/reuse revocation and secret/PII redaction in structured logs.
- Documentation of evidence, limitations, and any verified findings.

## Approach

1. Build a route inventory from controller decorators and inspect the guard/service boundary for each mutation.
2. Add `tests/security/authorization.spec.ts` to the API Jest integration project. Its unauthenticated mutation matrix will assert that every protected write is rejected before payload validation or persistence. Add focused cross-principal checks only where existing integration tests do not already cover the boundary.
3. Link each remaining security area to its existing negative/integration tests; add a new regression test before changing production code if the audit exposes a defect.
4. Repair verified defects with the smallest code change, then run the failing test first and the relevant security suites again.
5. Write `docs/testing/security-review.md` with the reviewed route inventory, evidence and commands, observed outcomes, fixes, and explicit coverage limitations.

## Test boundary

The new suite uses the isolated `TEST_DATABASE_URL` and disposable integration database pattern already used by API integration tests. It does not contact production or Redis Cloud. Redis-backed rate limit behavior is covered by the repository's Redis integration tests when `RATE_LIMIT_REDIS_TEST_URL` is configured; absence of that external test URL will be recorded as an unexecuted check rather than a pass.

## Acceptance

- Every protected mutation in the source inventory appears in the authorization matrix and fails closed without a Bearer token.
- Existing and new negative tests cover cross-user and cross-shop access, administrator-only writes, CSRF/CORS, upload validation, refresh reuse, rate limiting, and secret redaction.
- Any production fix has a regression test that fails before the fix and passes after it.
- The evidence report distinguishes executed checks from source review and environment-dependent checks.
- T146 is marked complete only after implementation and verification evidence exist.
