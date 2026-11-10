# T149 Database Migration and Restore Rehearsal Plan

## Goal

Produce reproducible evidence that the committed PostgreSQL migrations support a fresh database, an upgrade from the previous migration set, the data integrity rules accepted in ADR-0003, and a backup restored into a separate disposable database. Record actual results in `docs/database/migration-rehearsal.md` and update ADR-0003 with the verified status.

## Architecture and approach

- Keep the existing migration history immutable. Do not edit any committed migration; add a corrective migration only if a verified defect requires it.
- Reuse `apps/api/test/integration/database-migrations.spec.ts` for checks already covered by PostgreSQL tests: fresh migration and repeat deploy, FK/unique/check enforcement, payment snapshot shape and immutability, append-only records, and the idempotent expired-order backfill.
- Run the rehearsal on a new local PostgreSQL cluster and uniquely named `_disposable` databases. Never point the destructive migration test helper at an existing application database. Keep dumps and cluster data outside the repository, and shut down/remove only the cluster created for this rehearsal.
- For the upgrade path, deploy migrations through `0008_reviews` in an isolated database using a temporary migration directory, then run the repository's normal deploy against that same database so `0009_backfill_expired_order_status` is applied by Prisma. Confirm the migration ledger before and after.
- Back up the migrated upgrade database with `pg_dump` custom format, restore it into a second fresh disposable database, then compare migration ledger, schema, and representative row counts. Do not restore over the source database.
- Update the report with tool versions, commands, observations, and limitations; update ADR-0003 from baseline/pending evidence to verified evidence without changing its integrity decisions. Mark T149 complete only after the rehearsal evidence is collected. Keep T150 open.

## Tech stack

PostgreSQL 18 local disposable cluster, Prisma 7.10.1, Node.js 24, pnpm 12, Jest 30, PostgreSQL client utilities (`pg_dump`, `pg_restore`, `psql`, `createdb`).

## Global constraints

- Do not use a shared, demo, staging, or production database for tests, resets, migration experiments, dumps, or restores.
- Do not expose database URLs, credentials, or dump contents in logs or tracked files.
- Preserve all pre-existing worktrees and branches; implement only on `codex/migration-rehearsal-t149` based on merged `main` at #45.
- Do not change T150 status or files unless the rehearsal uncovers a blocking migration defect.

## Tasks

### 1. Inspect current integrity coverage and tool support

- Review migration list and existing DB helper guards.
- Map each ADR-0003 invariant to an existing migration integration test or transaction integration test; add a focused test only for a real gap.
- Confirm Prisma supports the temporary migration directory needed to model an upgrade from 0008.

### 2. Run focused integrity and fresh-install checks first

- Install the locked workspace dependencies if absent.
- Start a new temporary PostgreSQL cluster on an unused port.
- Create the uniquely named fresh `_disposable` DB and set `TEST_DATABASE_URL` plus exact `TEST_DATABASE_NAME_CONFIRMATION` only for it.
- Run the database migration integration test, which directly exercises the FK/unique/check and payment snapshot constraints needed by T149. Broader checkout/concurrency evidence remains in its existing task evidence and is not re-run as part of this migration rehearsal.
- Confirm nine migrations are applied once, no failed rows exist in `_prisma_migrations`, and a second deploy is stable.

### 3. Rehearse upgrade and backup/restore

- Create another isolated `_disposable` DB for the upgrade path.
- Apply migrations `0001_shared`–`0008_reviews`, then run normal Prisma deploy to apply `0009_backfill_expired_order_status`.
- Seed only small uniquely keyed rehearsal rows if needed; verify migration behavior and integrity without copying demo/user data.
- Dump the upgrade DB in custom format and restore to a separate empty `_disposable` DB.
- Compare migration ledger, schema diff, representative schema/table counts, and run basic FK/unique/check probes on the restored copy.

### 4. Record evidence and finish T149

- Write `docs/database/migration-rehearsal.md` with the exact procedure, observed versions, DB isolation strategy, checks and results, cleanup, and limitations.
- Update `docs/adr/0003-data-integrity.md` so pending acceptance language accurately reflects what this rehearsal proves and what remains outside T149.
- Update the migration evidence paragraph in `docs/database/data-design.md` so it no longer says migration and restore checks have not run.
- Mark only T149 complete in `specs/001-marketplace-mvp/tasks.md`; leave T150 unchecked.
- Run the repository unit suite and focused PostgreSQL migration suite, verify Prisma status/schema parity on the isolated DBs, run `git diff --check`, inspect the full diff, and request a final read-only review before commit/PR.

## Verification commands

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @marketplace/api prisma:generate
corepack pnpm test
corepack pnpm --filter @marketplace/api test:integration --testPathPatterns=database-migrations.spec.ts
corepack pnpm --filter @marketplace/api prisma:schema:check
```

The database integration commands must run only with the newly created disposable cluster and exact database-name confirmation. T149 run record: locked install and Prisma generation succeeded; `corepack pnpm test` passed 25/25 suites (170 passed, 1 skipped) with CI-like test-only rate-limit values; `database-migrations.spec.ts` passed 6/6; fresh, upgrade, and restore databases each reported nine applied migrations, no failed migration rows, and no Prisma schema diff; integrity probes rejected FK/unique/check/snapshot mutations. `pg_dump`/restore completed with matching source/restore summaries. Final diff review and PR remain before the branch is finished.
