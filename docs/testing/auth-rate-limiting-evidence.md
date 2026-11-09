# Auth rate limiting: verification evidence

Observed on 2026-11-09 in the Windows Codex worktree with Node.js `v24.21.0`, PostgreSQL `17.11` (`postgres:17.11-bookworm`), and Redis server `8.10.3` (`redis:8.10.3-alpine`). Tests used the disposable `marketplace_test` database and Compose test Redis on `127.0.0.1:56380`.

## Policy and HTTP behavior

The default per-minute limits are register `5/email`, `60/IP`; login `10/email`, `180/IP`; refresh `30/session family`, `300/IP`. `rate-limiter.service.spec.ts` verifies the six defaults, normalized email buckets, HMAC keys, IP-first behavior, family isolation, 429 conversion, and fail-closed store errors.

`rate-limit.http.spec.ts` verified that a denied request returns `429` with integer `Retry-After: 37`, exposes that header through CORS, and ignores a spoofed `X-Forwarded-For` while `API_TRUST_PROXY_HOPS=0`. Redis failure returns the standard 503 error envelope. `readiness.service.spec.ts` verified that Redis ping success reports `rateLimiter: "up"`, ping failure makes `/health/ready` return 503 with `rateLimiter: "down"`, missing Redis settings mark configuration down, and missing/short production HMAC secrets are rejected.

`auth-rate-limit.integration.spec.ts` used a generated Redis prefix and PostgreSQL: one refresh family was allowed two rotations, received 429 on the next rotation, and a second family continued to rotate. `identity.integration.spec.ts` confirmed the stored session family ID remains stable after refresh-token rotation. The runtime Swagger contract test confirms that both auth error responses reference a registered `ErrorEnvelope` component.

## Redis behavior

`rate-limit-store.integration.spec.ts` passed all four checks:

- Two independent Redis clients shared one atomic counter: 40 concurrent requests against limit 7 produced exactly 7 allowed and 33 denied requests; the stored value stayed capped at 7.
- A new request was allowed after a 100 ms test window expired and the test waited 150 ms.
- Distinct explicit prefixes isolated the same logical key.
- An unavailable Redis endpoint failed `ping()` as expected.

The dedicated Redis suites generate their own key prefixes and clean up only keys under those prefixes. They do not call `FLUSHDB` or `FLUSHALL`.

## Commands and results

The full API Jest suites passed with Windows worktree discovery overrides:

```text
node apps/api/scripts/run-tests.mjs unit '--testMatch=**/*.spec.ts' '--testPathIgnorePatterns=test[/\\]integration'
  22 suites, 116 tests passed

node apps/api/scripts/run-tests.mjs contracts '--testMatch=**/tests/contracts/**/*.spec.ts' '--testPathIgnorePatterns=(?!)'
  12 suites, 322 tests passed

node apps/api/scripts/run-tests.mjs integration '--testMatch=**/test/integration/**/*.spec.ts' '--testPathIgnorePatterns=(?!)'
  15 suites, 73 tests passed
```

The integration run set `TEST_DATABASE_URL` and `DATABASE_URL` to the disposable `marketplace_test` database, `TEST_DATABASE_NAME_CONFIRMATION=marketplace_test`, Redis URL to `redis://127.0.0.1:56380`, `NODE_ENV=test`, and local test-only signing/HMAC secrets. Broad domain integration tests used 10,000 test-only limits because their fixtures share the loopback IP; policy defaults remain unchanged in application configuration and are tested separately. The dedicated auth-rate-limit integration suite installs its own small limits and unique prefix.

Other verification:

- `corepack pnpm@12.14.0 lint:workspaces` — 9 workspace tasks successful.
- `corepack pnpm@12.14.0 typecheck` — 9 workspace tasks successful.
- `corepack pnpm@12.14.0 build` — 4 workspace builds successful.
- `corepack pnpm@12.14.0 --filter @marketplace/ui-web test` — 15 tests passed.
- `corepack pnpm@12.14.0 --filter @marketplace/api-client test` — 32 tests passed.
- `corepack pnpm@12.14.0 --filter @marketplace/api prisma:schema:check` — `No difference detected.`
- `corepack pnpm@12.14.0 --filter @marketplace/api-client generate:types`, followed by `git diff --exit-code -- packages/api-client/src/generated/index.ts` — generated client was current.
- `docker compose --env-file .env.compose.example --profile test config --quiet` — passed.
- `git diff --check` — passed.

The default root `pnpm test` and `pnpm test:contracts` invocations were also attempted, but Jest discovered zero API tests under this Windows `.codex` worktree path. The explicit CLI match overrides above ran the complete API suites successfully; no test configuration was changed for the worktree path.
