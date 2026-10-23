# T023 identity contract test baseline

The T023 contract suite is in `tests/contracts/identity.contract.spec.ts` and runs with `pnpm --filter @marketplace/api test:contracts`.

Baseline on 2026-10-23:

- 21 checks pass: OpenAPI operation identifiers and success responses, request fixtures against schemas, secret redaction, and multipart image upload shape.
- 13 runtime checks fail because the current Nest application does not expose the identity operations yet (`GET /auth/csrf`, auth register/login/refresh/logout, and `/users/me` profile, password, address, and asset operations).
- Jest exits 1 as expected for this test-first baseline. No database connection or migration is used.

Keep these runtime checks enabled. They should turn green when the identity routes are implemented; do not mark the feature complete based on the passing schema-only checks.
