# Redis Authentication Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Write tests first and verify each task before moving on.

**Goal:** Make register, login, and refresh throttling shared across API instances, bounded by TTL, and independent per user/session.

**Architecture:** Add a small `RateLimitStore` interface with a Redis adapter and a focused identity policy module. Use atomic fixed-window increments with TTL; HMAC all identity keys; resolve client IP only through explicitly trusted proxy configuration. Redis failure returns `503` for auth mutations and marks readiness down.

**Tech Stack:** Node.js 24.18.0, pnpm 12.14.0, NestJS 12.2.0, Redis Node client (exact pinned version), Redis server (explicit non-`latest` image tag), Jest 30.5.2, OpenAPI 3.0.3.

**Spec:** `docs/superpowers/specs/2026-11-09-auth-rate-limiting-design.md` (approved; target baseline `main@44abf5aaf40eb4ffcf49feb67fc5b5637cdb39a1`).

## Global Constraints

- Sync the implementation branch to the approved target baseline before changing code; the current workspace branch is 110 commits behind it.
- Per-minute defaults approved by the user: register 5/email and 60/IP; login 10/email and 180/IP; refresh 30/session family and 300/IP. All requests count, including successes.
- Use a dedicated `RATE_LIMIT_KEY_SECRET` of at least 32 characters; HMAC email/family/IP identifiers and never put raw PII or refresh tokens in Redis keys.
- Default trusted proxy hops to `0`; ignore forwarded headers unless a trusted proxy is explicitly configured.
- Redis has a TTL on every counter. Do not add an in-memory fallback or a global refresh bucket.
- Redis integration tests must use a unique key prefix and delete only their own keys; never flush a shared Redis database.
- Do not change database schema/migrations or refresh rotation semantics.

## Review Focus

- Email case/whitespace normalization must map to the same per-account bucket.
- Many different email addresses from one client IP must hit the IP cap without creating unbounded process memory.
- A refresh family at its limit must not block a second family; a session family stays stable across token rotation.
- Concurrent requests through two Redis clients must not exceed the configured allowance; expiry must reset the bucket.
- Spoofed forwarding headers must not change IP identity, and Redis failure must fail closed with `503` and unhealthy readiness.

---

### Task 1: Define and test the identity rate-limit policy

**Files:**
- Create: `apps/api/src/modules/identity/rate-limit/rate-limit-store.ts`
- Create: `apps/api/src/modules/identity/rate-limiter.service.ts`
- Create: `apps/api/test/rate-limiter.service.spec.ts`

**Interfaces:**
- Consumes: `RateLimitStore.consume(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>`.
- Produces: `assertRegisterAllowed(ip, email)`, `assertLoginAllowed(ip, email)`, `assertRefreshIpAllowed(ip)`, and `assertRefreshFamilyAllowed(familyId)`; each returns `Promise<void>` or throws the documented 429/503 exception.
- The policy consumes the IP bucket before an email bucket. This counts requests toward the IP budget first and avoids creating per-email keys after the IP budget is exhausted. Email and IP limits both apply; the denial response uses the longest retry delay among denied buckets.
- Export a `RATE_LIMIT_STORE` injection token with the interface. The policy maps a denied counter to the existing API error envelope with `RATE_LIMITED`; store connectivity errors map to `503` without retrying the authentication operation.

- [x] **Step 1: Write policy tests against a fake store**

  Pin exact bucket keys through a test HMAC secret, the six default limits, email normalization, per-family isolation, IP-first behavior, and conversion of a denied bucket into `RATE_LIMITED` with `Retry-After` seconds.

- [x] **Step 2: Run focused tests to verify the missing policy fails**

  Run: `pnpm --filter @marketplace/api test --testPathPatterns=rate-limiter.service.spec.ts`  
  Expected: FAIL because the policy module and injected limiter are not implemented yet.

- [x] **Step 3: Implement the policy module**

  Add `assertRegisterAllowed`, `assertLoginAllowed`, `assertRefreshIpAllowed`, and `assertRefreshFamilyAllowed` with 60-second fixed windows. HMAC the scope and identifier before calling the store. Read defaults from `ConfigService` using `RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE`, `RATE_LIMIT_REGISTER_IP_PER_MINUTE`, `RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE`, `RATE_LIMIT_LOGIN_IP_PER_MINUTE`, `RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE`, and `RATE_LIMIT_REFRESH_IP_PER_MINUTE`.

- [x] **Step 4: Run the focused tests and commit**

  Run: `pnpm --filter @marketplace/api test --testPathPatterns=rate-limiter.service.spec.ts`  
  Expected: PASS. Commit as `feat(api): define auth rate-limit policy`.

### Task 2: Add the Redis store and atomic TTL tests

**Files:**
- Create: `apps/api/src/modules/identity/rate-limit/redis-rate-limit-store.ts`
- Create: `apps/api/src/modules/identity/rate-limit/rate-limit.module.ts`
- Create: `apps/api/test/integration/rate-limit-store.integration.spec.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `docker-compose.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the policy store interface from Task 1.
- Produces: a Redis `RateLimitStore` adapter with `consume()` and `ping()`; each counter is atomically incremented, expires after its window, and reports remaining TTL.

- [x] **Step 1: Add Redis adapter integration tests**

  Use two independently created stores against the same Redis URL and a random per-test prefix. Test concurrent increments at the cap, TTL reset, key isolation between prefixes, and connection failure. Tests must delete only generated keys and must not call `FLUSHDB`.

- [x] **Step 2: Add Redis test infrastructure and run the red suite**

  Add an explicit Redis service with a health check to Compose and GitHub Actions. Run: `pnpm --filter @marketplace/api test:integration --testPathPatterns=rate-limit-store.integration.spec.ts`  
  Expected: FAIL because the Redis adapter is missing.

- [x] **Step 3: Implement the Redis adapter**

  Add the exact-pinned official `redis` Node client. Implement one atomic Lua operation for `INCR`, first-write `PEXPIRE`, capped counter growth, and `PTTL`; return `allowed` and `retryAfterSeconds`. Expose `ping()` for readiness. Prefix keys with environment and an explicit `RATE_LIMIT_KEY_PREFIX`; close the client during Nest shutdown. Allow the API process to finish booting when Redis is unavailable so health can report the outage and auth mutations can return `503`. Never fall back to a process-local map.

- [x] **Step 4: Run Redis integration tests and commit**

  Run: `pnpm --filter @marketplace/api test:integration --testPathPatterns=rate-limit-store.integration.spec.ts`  
  Expected: PASS across two store instances. Commit as `feat(api): add shared Redis rate-limit store`.

### Task 3: Wire auth routes, trusted IPs, and error responses

**Files:**
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Modify: `apps/api/src/modules/identity/identity.controller.ts`
- Modify: `apps/api/src/modules/identity/identity.service.ts`
- Modify: `apps/api/test/identity.service.spec.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/common/http/error.filter.ts`
- Modify: `apps/api/src/common/http/request.types.ts`
- Modify: `apps/api/test/integration/identity.integration.spec.ts`
- Create: `apps/api/test/integration/auth-rate-limit.integration.spec.ts`
- Create: `apps/api/test/http/rate-limit.http.spec.ts`
- Modify: `tests/contracts/identity.contract.spec.ts`
- Modify: `packages/contracts/openapi.yaml`
- Modify: `packages/api-client/src/generated/index.ts` only if regeneration changes generated types

**Interfaces:**
- Consumes: the policy module and Redis adapter from Tasks 1–2.
- Produces: auth controller passes `req.ip`; AuthService checks register/login before expensive work, refresh IP before token lookup, and refresh family after resolving the stored family ID but before the existing rotation transaction.

- [x] **Step 1: Write service, HTTP, controller, and contract tests**

  Add AuthService tests proving register/login checks run before Argon2 or database work. Test 429 plus `Retry-After`; 503 on Redis outage; distinct session families; family key stability across token rotation; and untrusted `X-Forwarded-For` behavior when `API_TRUST_PROXY_HOPS=0`.

- [x] **Step 2: Run the focused suites and record red**

  Run: `pnpm --filter @marketplace/api test "--testPathPatterns=identity.service.spec.ts|rate-limit.http.spec.ts"`; `pnpm --filter @marketplace/api test:contracts --testPathPatterns=identity.contract.spec.ts`; and `pnpm --filter @marketplace/api test:integration "--testPathPatterns=identity.integration.spec.ts|auth-rate-limit.integration.spec.ts"`  
  Expected: FAIL because the auth routes do not use Redis policy and the contract has no `Retry-After` header or auth 503 response.

- [x] **Step 3: Wire rate limits without changing auth semantics**

  Pass `req.ip` from register/login/refresh controllers. Normalize email before account-key generation. In refresh, check the IP bucket first, look up the session family by the refresh-token hash, check that family bucket, then run the existing locked rotation transaction unchanged. Configure Express trusted proxy hops from `API_TRUST_PROXY_HOPS`, default `0`.

- [x] **Step 4: Add 429/503 contract behavior**

  Add a rate-limit exception carrying `retryAfterSeconds`; make `ContractErrorFilter` emit an integer `Retry-After` header. Declare that header on the auth 429 responses and add 503 responses to register/login/refresh in OpenAPI. Keep the standard error envelope.

- [x] **Step 5: Run focused suites, regenerate, and commit**

  Run all three focused commands from Step 2, then `pnpm --filter @marketplace/api-client generate:types` and `git diff --exit-code -- packages/api-client/src/generated/index.ts`. Expected: all tests pass and generated types match OpenAPI. Commit as `feat(auth): apply shared rate limits to auth routes`.

### Task 4: Configure Redis, readiness, and operator setup

**Files:**
- Modify: `apps/api/src/health/readiness.service.ts`
- Modify: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Create: `apps/api/test/readiness.service.spec.ts`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `.env.compose.example`
- Modify: `.env.test.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/development/local.md`
- Modify: `docs/testing/fixture-design.md`

**Interfaces:**
- Consumes: `RateLimitStore.ping()` from Task 2 and env contracts from Task 3.
- Produces: development, CI, and production readiness all require configured Redis; local Redis binds only to loopback.

- [x] **Step 1: Add configuration and readiness tests**

  Verify missing/short production `RATE_LIMIT_KEY_SECRET` is rejected, Redis ping failure marks `/health/ready` down, and a successful ping reports `rateLimiter: "up"`. Verify local Compose uses an isolated key prefix and loopback-only Redis port. Keep test coverage in the new readiness spec and existing configuration tests, if present.

- [x] **Step 2: Add runtime configuration**

  Add `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_KEY_SECRET` (minimum 32 characters), `RATE_LIMIT_KEY_PREFIX`, `API_TRUST_PROXY_HOPS` (default 0), and the six numeric limit overrides to env examples. Set Compose and CI values; use an explicit Redis image tag and health check; make API/API-test depend on Redis health. Add Redis ping to `ReadinessService`.

- [x] **Step 3: Document setup and safe test cleanup**

  Update local setup, Docker quickstart and fixture documentation with the Redis port/URL, required secret, key prefix, trusted-proxy setting, and no-`FLUSHDB` rule. Tests must use only their own prefixes.

- [x] **Step 4: Run the full verification set and commit**

  Run: `pnpm lint:workspaces`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @marketplace/api test:contracts`, `pnpm build`, `pnpm --filter @marketplace/api test:integration`, and `pnpm --filter @marketplace/api prisma:schema:check`. Expected: all commands pass; schema check reports no migration changes. Commit as `chore(api): configure Redis auth rate limiting`.

### Task 5: Record final evidence

**Files:**
- Create: `docs/testing/auth-rate-limiting-evidence.md`

**Interfaces:**
- Consumes: observed CI/local results from Tasks 1–4.
- Produces: evidence for policy limits, multi-instance atomicity, outage behavior, and readiness.

- [x] **Step 1: Record actual commands and observed results**

  Include Redis version/tag, environment, per-suite results, 429/Retry-After behavior, two-client concurrency, TTL reset, Redis outage, spoofed proxy header, and schema-parity output. Do not substitute expected results for observed results.

- [x] **Step 2: Commit evidence**

  Commit as `docs(testing): record auth rate-limit evidence`.
