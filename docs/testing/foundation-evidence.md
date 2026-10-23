# Foundation Smoke Evidence

**Date:** 2026-10-22
**Workspace revision:** `0b18257` plus uncommitted foundation changes
**Status:** T022 runtime smoke passed; W008 platform resource access/provisioning remains a separate open readiness item.

## Environment

| Component | Observed version or state |
| --- | --- |
| Node.js | 24.18.0 |
| Corepack | 0.35.0 |
| pnpm | 12.14.0 |
| Docker Engine | 29.6.1 |
| Docker Compose CLI | 5.2.0 |
| Compose PostgreSQL | `postgres:17.11-bookworm`, healthy, isolated named dev volume |
| PostgreSQL for local integration | 18.4, confirmed disposable database `cnpm_test` |
| Compose environment | Local `.env.compose` generated with random secrets; ignored by Git |

## Observed checks

| Command or smoke | Exit | Observation |
| --- | ---: | --- |
| `corepack pnpm install --frozen-lockfile` | 0 | Lockfile is current; only approved Prisma, SWC, and resolver build scripts ran. Telemetry and optional watcher scripts remain denied. |
| `corepack pnpm lint:workspaces` | 0 | 11 lint tasks succeeded. |
| `corepack pnpm typecheck` | 0 | 11 typecheck tasks succeeded. |
| `corepack pnpm test` | 0 | API 9/9 and API client 3/3 unit tests passed. |
| `corepack pnpm build` | 0 | API and all three Next.js shells built successfully. |
| Filtered web build after Tailwind v4 integration | 0 | All three Next.js shells compiled Tailwind CSS and rendered their root routes. |
| `corepack pnpm --filter @marketplace/api test:integration` | 0 | 2/2 PostgreSQL migration/invariant tests passed on `cnpm_test`; fresh reset, deploy, and repeated deploy observed with prior user confirmation. This suite used local PostgreSQL 18.4. |
| `corepack pnpm --filter @marketplace/api prisma:schema:check` | 0 | No difference detected between the current database schema and Prisma schema. Read-only check. |
| `corepack pnpm --filter @marketplace/api-client generate:types` then generated-file diff | 0 | Generated OpenAPI types are reproducible from the reviewed contract. |
| `docker compose --env-file .env.compose config --quiet` | 0 | Compose file and local environment substitutions validate. |
| `docker compose --env-file .env.compose up -d --build postgres api storefront seller-center admin-panel` | 0 | All five containers started; PostgreSQL, API and all three web apps reached healthy status. Images built from the checked-in Dockerfiles. |
| `docker compose --env-file .env.compose run --rm api pnpm prisma:migrate:deploy` | 0 | Migration `0001_shared` applied successfully to the fresh isolated Compose database on PostgreSQL 17.11. This is additive deploy, not a reset. |
| HTTP smoke: API `/health/live`, `/health/ready`, `/api/docs`; web roots on ports 3000, 3001, 3002 | 0 | All six requests returned HTTP 200; `docker compose ps` showed all five services healthy. |
| API at `http://localhost:4401` using `cnpm_test` | 0 | Earlier `/health/live`, `/health/ready`, and `/api/docs` smoke all returned 200; API was stopped afterward. |

## Remaining limits

The integration suite that resets its test database was not run against the Compose `marketplace_test` database; its 2/2 result is from the separately confirmed `cnpm_test` database on PostgreSQL 18.4. Compose PostgreSQL 17.11 runtime was verified by applying the migration and running the API against it. The isolated Compose stack is currently running; use `docker compose --env-file .env.compose stop` to stop it while preserving its named dev volume.

The GitHub Actions workflow is present but has not run on GitHub because these changes have not been pushed. T022 runtime smoke is complete; W008 access/provisioning and any CI run remain separate gates.
