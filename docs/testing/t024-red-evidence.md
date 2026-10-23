# T024 identity integration test baseline

The PostgreSQL-backed T024 suite is in `apps/api/test/integration/identity.integration.spec.ts` and runs with `pnpm --filter @marketplace/api test:integration`.

Baseline on 2026-10-23, using the confirmed disposable `cnpm_test` database:

- Prisma reset and migration deployment completed successfully; only the shared migration is present at this stage.
- 3 checks pass: the existing browser-origin CSRF middleware rejects a mutation without its token, and the existing database migration tests pass.
- 4 identity-flow checks fail at registration with HTTP 404 because identity routes and user tables have not been implemented yet. They cover refresh rotation/reuse/logout, locked account/password revocation, normalized-email and concurrent default-address behavior, and cross-buyer asset assignment.
- The test app applies the production CSRF middleware and error filter. No test is skipped or marked green to hide missing behavior.
