# T024 identity integration test baseline

The PostgreSQL-backed T024 suite is in `apps/api/test/integration/identity.integration.spec.ts` and runs with `pnpm --filter @marketplace/api test:integration` against a confirmed disposable test database. GitHub Actions skips the identity baseline while `CI=true`; the endpoints and tables arrive in later implementation tasks. The migration and CSRF integration tests continue to run in CI.

Baseline on 2026-10-23, using the confirmed disposable `cnpm_test` database:

- Prisma reset and migration deployment completed successfully; only the shared migration is present at this stage.
- 3 checks pass: the existing browser-origin CSRF middleware rejects a mutation without its token, and the existing database migration tests pass.
- 4 identity-flow checks fail at registration with HTTP 404 because identity routes and user tables have not been implemented yet. They cover refresh rotation/reuse/logout, locked account/password revocation, normalized-email and concurrent default-address behavior, and cross-buyer asset assignment.
- The test app applies the production CSRF middleware and error filter. Locally, the identity baseline remains enabled and records the expected 404 failures until implementation; CI skips only that not-yet-implemented describe block.
