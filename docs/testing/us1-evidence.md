# US1 identity test evidence

Recorded: 2026-10-23

## Implemented checks

| Check                      | Command                                                       | Observed result                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit                   | `corepack pnpm --filter @marketplace/api test:unit`           | Pass: 4 suites, 11 tests. Includes Argon2id password hashing, refresh hash shape/expiry contract, and CSRF token matching.                                                 |
| Identity contract          | `corepack pnpm --filter @marketplace/api test:contracts`      | Pass: 1 suite, 34 tests. Covers OpenAPI identity fixtures and all 13 runtime routes.                                                                                       |
| Buyer account browser flow | `corepack pnpm test:e2e -- tests/e2e/buyer-account.spec.ts`   | Pass: 5 tests (L/E/X/S and unauthorized redirect).                                                                                                                         |
| Workspace typecheck        | `corepack pnpm typecheck`                                     | Pass: all 11 workspace tasks.                                                                                                                                              |
| Workspace lint             | `corepack pnpm lint:workspaces`                               | Pass: all 11 workspace lint tasks.                                                                                                                                         |
| PostgreSQL integration     | `corepack pnpm --filter @marketplace/api test:integration`    | Pass: 2 suites, 8 tests. Reset `cnpm_test`, applied migrations `0001_shared` and `0002_identity_assets`, then verified repeat deploy, identity/session behavior, concurrency and database constraints. |
| Prisma schema drift        | `corepack pnpm --filter @marketplace/api prisma:schema:check` | Pass: no difference detected after integration applied both migrations. Read-only check. |
| Workspace build            | `corepack pnpm build`                                         | Pass: API, Storefront, Seller Center, and Admin Panel builds.                                                                                                              |

## Database integration status

Pass. With the owner's explicit confirmation, the integration runner reset and recreated only `cnpm_test`, applied both migrations, and ran 8 PostgreSQL integration checks across 2 suites. This covers fresh migration and repeat deploy, identity/session rotation and reuse revocation, logout, account lock/password change, concurrent case-insensitive registration/default-address behavior, asset ownership, and database constraints. The integration runner now passes `TEST_DATABASE_URL` as the app's `DATABASE_URL` only in integration mode, keeping runtime tests on the disposable database.

## Storage status

S3 upload code is implemented, including magic-byte validation, image decoding and metadata checks, random object keys, and cleanup on database failure. An actual upload against S3-compatible storage was not run because this workspace has no configured storage credentials/bucket.

## Seed

`apps/api/prisma/seed/identity.seed.ts` upserts Admin and Buyer identities from `IDENTITY_ADMIN_EMAIL`, `IDENTITY_ADMIN_PASSWORD`, `IDENTITY_BUYER_EMAIL`, and `IDENTITY_BUYER_PASSWORD`. Passwords are never committed; the script refuses to run when values are absent or outside the 12–128 character policy.
