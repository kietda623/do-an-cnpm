# Authentication Rate Limiting Design

**Status:** Approved
**Target baseline:** GitHub `main` at `44abf5aaf40eb4ffcf49feb67fc5b5637cdb39a1`. The current workspace branch is an ancestor of that baseline and must be synced before implementation.

## Intent

Make registration, login, and refresh throttling bounded and consistent across API instances, while preventing one user or session from consuming a global refresh allowance.

## Current behavior

`AuthService` keeps counters in a process-local `Map`. Registration and login keys are derived from caller-supplied email, so changing the email creates new buckets, and expired keys are never swept. Refresh uses one key (`refresh`) for every user, so the 31st refresh in a minute is rejected for all clients in that process. Separate API instances do not share these counters.

## Goals

- Use Redis as the shared limiter store across API instances.
- Apply atomic, expiring buckets per client IP and per normalized account identity for registration/login.
- Apply refresh limits per client IP and per session family, replacing the process-wide refresh cap.
- Keep email addresses and refresh tokens out of Redis keys by using keyed digests.
- Return the existing `429 RATE_LIMITED` error shape and a `Retry-After` header.
- Fail closed with `503` on auth mutation endpoints when Redis is unavailable; do not silently fall back to per-process counters.
- Keep test Redis keys namespaced; tests must not flush a shared Redis database.

## Non-goals

- Do not add CAPTCHA, account lockout, email verification, password reset, or a general API gateway.
- Do not change login/session semantics or refresh-token rotation.
- Do not impose a global per-process or global per-Redis 30-request refresh ceiling.

## Approaches

1. **Keep an in-memory limiter and add cleanup.** Lowest setup cost, but counters remain bypassable across processes and are not shared after restarts.
2. **Enforce limits only at an edge proxy.** Useful as an outer guard, but this project has no managed gateway configuration and an IP-only rule cannot enforce account/session buckets.
3. **Add a Redis-backed limiter in the API.** Shared state and atomic windows without coupling domain logic to an external gateway. **Selected by the user.**

## Approved policy

Use fixed 60-second windows with atomic Redis operations and expiration. Preserve the current per-identity allowances and add coarse IP budgets:

| Operation | Per identity | Per IP |
| --- | ---: | ---: |
| Register | 5 requests/minute per normalized email | 60 requests/minute |
| Login | 10 requests/minute per normalized email | 180 requests/minute |
| Refresh | 30 requests/minute per session family | 300 requests/minute |

The user approved these defaults: register 5 per normalized email and 60 per IP; login 10 per normalized email and 180 per IP; refresh 30 per session family and 300 per IP, each in a fixed 60-second window. Thresholds remain configurable, but production must not disable the limiter. Count requests consistently so successful authentication requests consume the same allowance as failed requests.

## Design

Add a small `RateLimitStore` boundary in the API and a Redis adapter owned by the identity module. Use a Lua script (or an equivalent single atomic operation) to increment each bucket, set expiry on first use, and return the remaining window for `Retry-After`. Use HMAC-derived keys with a dedicated `RATE_LIMIT_KEY_SECRET` so Redis does not contain plain email addresses or refresh credentials. Keep this secret independent from `JWT_SIGNING_SECRET`; JWT key rotation must not rename rate-limit buckets.

Pass the resolved client IP from `AuthController` to `AuthService`. Configure Express trusted-proxy behavior explicitly (default to no trusted proxy); never trust a raw `X-Forwarded-For` value from an untrusted client. For refresh, apply the IP bucket before authentication work, resolve the persisted session family from the refresh-token hash, then apply the family bucket before running the existing rotation transaction. Keep all database session checks and rotation behavior unchanged.

Add Redis configuration to local Compose and CI, a namespaced integration suite that proves two API providers share counters and independent session families do not block each other, and an API error contract assertion for `Retry-After`. Health/readiness must report Redis unavailable so an outage is visible.

## Acceptance criteria

- Repeated registration/login attempts for one normalized email share a bucket across casing/whitespace variants and API instances.
- Many distinct emails from one IP hit the IP bucket; creating new keys does not grow a local unbounded map.
- One session family reaching its refresh allowance does not block another family.
- Redis expiry resets a bucket; simultaneous increments cannot exceed the configured allowance.
- Forged forwarding headers do not alter client identity unless the connection comes through an explicitly trusted proxy.
- Redis outage produces the documented fail-closed response and unhealthy readiness, with no memory-limiter fallback.
- Rate-limited responses keep the standard error envelope and include `Retry-After`.

## Calls left to the implementer

- Use the official `redis` Node client with an exact dependency pin consistent with the workspace lockfile policy.
- Require `RATE_LIMIT_KEY_SECRET` in production and document it in the environment examples; keep it separate from JWT signing keys.
- Keep the Redis connection lifecycle in a Nest provider and close it during application shutdown.
- Extend the existing auth controller/service and contract/integration test seams; do not extract unrelated auth logic.
