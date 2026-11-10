# Desktop Buyer Wrapper (T140–T145) Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task by task. Keep the work sequential on one feature branch. Each task is independently reviewable.

**Goal:** Deliver a Windows-only Tauri 2 buyer demo that reuses the local storefront UI and session behavior.

**Architecture:** The Tauri window loads the local storefront at `http://localhost:3000` in Windows WebView2. It bundles no Next.js server or buyer UI, exposes no Tauri commands, and blocks navigation outside the local origin. The existing WEB client keeps access tokens in memory and uses the HttpOnly refresh cookie and CSRF flow. A Windows-only workflow runs Node/Rust checks without packaging an installer.

**Tech Stack:** Tauri 2 and Rust; Node 24, pnpm 12 and Turbo 2; Next.js 16, React 19; GitHub Actions; Windows WebView2.

**Spec:** specs/001-marketplace-mvp/spec.md, specs/001-marketplace-mvp/plan.md, specs/001-marketplace-mvp/tasks.md (T140–T145).

## Global Constraints

- Desktop is a Tauri 2 wrapper around the same responsive storefront. Do not implement separate buyer screens or embed a Next.js server.
- No production storefront URL is required. `desktop:dev` defaults to `http://localhost:3000` and accepts only that local origin.
- Permit top-level navigation only to the local demo origin. Reject public hosts, lookalike hosts, unexpected ports, and untrusted redirect targets.
- Do not expose Tauri commands, plugins, filesystem access, shell access, or remote IPC to the storefront webview. Keep the capability set empty.
- Continue using the existing WEB session contract: access token in memory, refresh token in the HttpOnly Secure cookie, CSRF cookie/header, credentials included, and server-side logout revocation. Do not add native refresh-token storage or plaintext token persistence.
- The desktop webview has its own cookie jar. The acceptance requirement is that the buyer can sign in to the same account and see the same server-backed data as on Web; it does not require sharing a browser's login cookie.
- The local storefront keeps its web origin. Configure API CORS with the exact localhost origin. Do not add tauri://localhost or wildcard origins.
- Keep the local storefront and API on localhost so the current SameSite=Lax refresh cookie works on credentialed API requests. Do not change the cookie policy for this demo.
- Enforce CSP in the storefront HTTP response. The demo loads the local development server, so its CSP comes from the storefront response.
- A nonce CSP in Next.js 16 makes matched pages dynamically rendered and reduces static/CDN caching. Measure the effect in the existing performance work (T147).
- Add no generic build script to the desktop workspace. The current root Turbo build runs on Linux and must not start a Rust desktop build.
- Demo target: Windows with WebView2. Record the actual Windows and WebView2 versions; do not claim installer or production support.
- Do not produce installer artifacts, checksums, app store releases, or GitHub releases. The Windows check workflow uses read-only repository access and no signing secrets.
- T145 is accepted from the running local Windows demo and recorded buyer-flow evidence; an installed package is outside this demo scope.
- Implement T140 through T145 sequentially on one feature branch, then update or open one PR after the evidence and final checks are complete.

## Approaches Considered

1. **Local storefront in a Tauri webview — selected for the demo.** Reuses the current Next.js app, routes, API client, and WEB session. It uses the local development server and rejects external origins.
2. **Bundle a static storefront inside Tauri.** Rejected because the storefront is a Next.js server app, and an embedded origin would add a second deployment/session/CORS path.
3. **Build native buyer screens.** Rejected because it duplicates the specified storefront UI and creates separate behavior to maintain.

## Current Repository Findings

- `apps/desktop` is a Tauri workspace package included by the existing `apps/*` workspace glob.
- The buyer app creates WebSession in apps/storefront/src/lib/session.ts. packages/api-client/src/transport.ts sends credentials and CSRF headers; the API sets HttpOnly Secure SameSite=Lax refresh cookies and checks configured browser origins.
- The current CI workflow runs on Ubuntu. A separate Windows check workflow keeps the Rust and WebView toolchain out of the default workspace build.
- The storefront has a nonce-based CSP; the Tauri demo uses its local response and does not bundle a Next.js server.
- `.env.example` no longer needs a desktop URL; the launcher defaults to localhost.
- No public storefront/API deployment is required for the local demo.

## File Map

- Create apps/desktop/package.json for the workspace package, pinned Tauri CLI, and explicit desktop:dev and desktop:test commands.
- Create apps/desktop/src-tauri/Cargo.toml, Cargo.lock, build.rs, src/main.rs, src/navigation.rs, and tauri.conf.json for the small native shell and exact-origin navigation policy.
- Create apps/desktop/src-tauri/icons/app-icon.svg and generated Windows demo icons (PNG, ICO).
- Create apps/desktop/scripts/run-tauri.mjs to default to and validate the local storefront origin. Create apps/desktop/README.md for Windows demo setup.
- Create apps/desktop/scripts/run-tauri.test.mjs for URL and config validation tests.
- Create apps/storefront/src/proxy.ts for production CSP response headers and a focused Playwright security-header test under tests/e2e/.
- Create apps/storefront/src/lib/csp-policy.mjs, its csp-policy.d.mts type declaration, and csp-policy.test.mjs for production/development CSP policy tests.
- Modify apps/storefront/src/app/layout.tsx to pass the Proxy nonce to the existing inline theme script.
- Modify apps/storefront/next.config.ts to permit both supported loopback hostnames in local development.
- Modify apps/storefront/package.json to expose the CSP policy test through the workspace test command.
- Modify playwright.config.ts to include the focused storefront security-header test.
- Modify .env.example to document local CORS origins. Extend apps/api/test/http/cors-csrf.spec.ts to cover the exact storefront origin and rejected origins.
- Create .github/workflows/desktop-demo.yml for Windows Node/Rust checks only. Keep permissions read-only and pin actions to commit SHAs, following the existing CI policy.
- Create docs/testing/desktop-evidence.md to record Windows local launch, session, navigation, and buyer-flow evidence.
- Do not add a generic build task to turbo.json or apps/desktop/package.json. The existing pnpm workspace glob discovers the new package.

## Review Focus

1. Any non-local URL, unexpected port, credentials, or lookalike host must fail before launch; in-app navigation to an unapproved origin must be cancelled. Cover with Node URL-validation tests and Rust navigation unit tests in T140.
2. The storefront response must receive the configured CSP and only the API, image, and font origins it needs. Cover the response header and nonce behavior with the storefront security-header test in T140.
3. Credentialed refresh and logout must work from the exact storefront origin while an unrelated or tauri://localhost origin remains rejected. Cover the CORS/CSRF contract in T141 and confirm it in the Windows local WebView2 demo.
4. A reload must restore the buyer session from the HttpOnly cookie; the access token must not appear in localStorage, sessionStorage, or the refresh request body. Logout must revoke the desktop session. Cover with existing WebSession tests plus the desktop smoke evidence in T141 and T145.
5. Record the Windows/WebView2 versions used for the demo and the observed cookie, CSP, and navigation behavior.

## Implementation Tasks

### Task 1: T140 — Build the minimal Tauri shell and web security policy

**Files**

- Create: apps/desktop/package.json
- Create: apps/desktop/src-tauri/Cargo.toml
- Create: apps/desktop/src-tauri/Cargo.lock
- Create: apps/desktop/src-tauri/build.rs
- Create: apps/desktop/src-tauri/src/main.rs
- Create: apps/desktop/src-tauri/src/navigation.rs
- Create: apps/desktop/src-tauri/tauri.conf.json
- Create: apps/desktop/src-tauri/icons/app-icon.svg and generated desktop icons
- Create: apps/desktop/scripts/run-tauri.mjs
- Create: apps/desktop/scripts/run-tauri.test.mjs
- Create: apps/desktop/README.md
- Create: apps/storefront/src/proxy.ts
- Create: apps/storefront/src/lib/csp-policy.mjs
- Create: apps/storefront/src/lib/csp-policy.d.mts
- Create: apps/storefront/src/lib/csp-policy.test.mjs
- Modify: apps/storefront/src/app/layout.tsx
- Modify: apps/storefront/next.config.ts
- Modify: apps/storefront/package.json
- Modify: playwright.config.ts
- Create: tests/e2e/storefront-security-headers.spec.ts
- Modify: .env.example

**Interfaces**

- DESKTOP_STOREFRONT_URL is optional and defaults to http://localhost:3000. run-tauri.mjs validates it and exports the value to the Rust build; non-local values are rejected.
- navigation::is_allowed_navigation(candidate: &url::Url, storefront_origin: &url::Url, is_dev: bool) -> bool compares the complete origin. The Tauri window uses it for top-level navigation and blocks new windows.
- The native shell exposes no commands to the webview. No plugin dependency is added.
- The production CSP is returned by the storefront Proxy with a fresh nonce. It allows the exact storefront/API origins and only observed asset origins; production script-src does not use unsafe-inline or unsafe-eval.
- The existing inline theme script in the root layout receives the request nonce explicitly through Next.js headers; framework-generated scripts continue to use Next.js nonce extraction.

- [x] Add Rust unit tests for the exact-origin policy: same HTTPS origin and paths pass; HTTP, another host, a lookalike suffix, another port, user-info URLs, loopback aliases, and non-HTTP schemes fail. Add Node tests for URL input validation, including local-only HTTP in development.
- [x] Run the URL and navigation tests before implementation; the deny-all Rust stub failed the valid-origin cases, and the URL suite initially failed until the validator module existed.
- [x] Add unit coverage for strict production CSP versus development-only eval, origin scoping, and configured asset origins. Add the Playwright test for the response CSP, fresh nonce, rendered storefront page, and inline theme-script nonce matching the CSP nonce. Include it in playwright.config.ts. The Playwright browser was installed after its initial missing-browser prerequisite; the completed E2E then passed.
- [x] Implement the Tauri window from the validated local URL. Keep capabilities empty, add no Tauri commands/plugins, and allow only the localhost demo origin.
- [x] Add the Next.js 16 Proxy response CSP with a per-request nonce. Set connect-src to the configured API origin and img-src/font-src to the exact origins required by the existing storefront. Do not set a permissive production script policy.
- [x] Read the request nonce in the server root layout with Next.js headers() and set it on the existing theme script. Run: pnpm --filter @marketplace/desktop desktop:test; pnpm --filter @marketplace/storefront test; pnpm --filter @marketplace/storefront typecheck; pnpm --filter @marketplace/storefront build; pnpm exec playwright test tests/e2e/storefront-security-headers.spec.ts --config=playwright.config.ts.
- [x] Confirm the desktop package has no build script and the existing root command still works: pnpm build.
- [x] Commit this task on the same feature branch with message: feat(desktop): add secure remote storefront shell.

**Expected result:** Tauri opens only the validated storefront origin; the storefront response carries the enforceable CSP; no second UI or native access is introduced.

### Task 2: T141 — Preserve the existing web cookie and CSRF session

**Files**

- Modify: apps/api/test/http/cors-csrf.spec.ts
- Modify: apps/api/test/integration/refresh-errors.integration.spec.ts
- Modify: .env.example
- Modify: apps/desktop/README.md
- Reuse: packages/api-client/test/web-session.test.ts
- Reuse: apps/api/src/modules/identity/identity.controller.ts

**Interfaces**

- The desktop page continues to instantiate WebSession and send clientPlatform WEB.
- Local CORS_ORIGINS contains the storefront origin. The current API refresh cookie remains HttpOnly, Secure, SameSite=Lax, and server logout continues to revoke the session.
- The desktop demo needs no URL variable; signing keys remain server-only.

- [x] Add CORS/CSRF tests for an allowed HTTPS storefront origin, an unrelated HTTPS origin, and tauri://localhost. Confirm only the configured storefront origin receives credentialed CORS permission.
- [x] Add WEB logout integration coverage for the HttpOnly Secure SameSite=Lax refresh cookie, omitted response refresh token, cookie clearing, and stale-cookie replay rejection.
- [x] Run the focused API unit suite: pnpm --filter @marketplace/api test. Run the session package suite through pnpm test and API integration suite through pnpm --filter @marketplace/api test:integration.
- [x] Run the local Tauri shell against http://localhost:3000 and the local API. Sign in, reload, make an authenticated request, log out, and confirm the revoked session cannot refresh. Inspect storage to confirm access tokens are not persisted.
- [x] Keep the existing cookie policy and local same-site storefront/API setup. No production origin is needed for this demo.
- [x] Commit this task on the same feature branch with message: test(desktop): preserve web cookie session contract.

**Expected result:** Desktop uses the same web authentication implementation and server session rules. No API auth behavior is forked for the wrapper.

### Task 3: T142 — Verify discovery and product-page parity

**Files**

- Reuse: apps/storefront/src/app/page.tsx
- Reuse: apps/storefront/src/app/products/page.tsx
- Reuse: apps/storefront/src/app/products/[productId]/page.tsx
- Reuse: apps/storefront/src/app/shops/[shopId]/page.tsx
- Create or update: docs/testing/desktop-evidence.md

**Interfaces**

- The Tauri shell serves the same storefront routes. No desktop-only route or page is added.
- Existing search, filters, gallery, variants, shop, and public review behavior remains owned by the storefront.

- [x] Run the existing Web regression: pnpm test:e2e:discovery and pnpm exec playwright test tests/e2e/storefront-shell.spec.ts --config=playwright.config.ts.
- [x] Launch the debug Tauri app on Windows. Verify home, search/filter, product gallery/variant, shop, and public review screens load from the same local `http://localhost:3000` origin.
- [x] Record build URL, OS/WebView version, route results, and any failures in docs/testing/desktop-evidence.md. Do not create a separate discovery UI or a new executable automation framework; T160 remains an unapproved follow-up.
- [x] Commit this task on the same feature branch with message: test(desktop): verify buyer discovery parity.

**Expected result:** Buyer discovery screens are the existing web screens inside the desktop window and retain their saved server data after reload.

### Task 4: T143 — Verify cart, checkout, orders, and account parity

**Files**

- Reuse: apps/storefront/src/app/cart/page.tsx
- Reuse: apps/storefront/src/app/checkout/page.tsx
- Reuse: apps/storefront/src/app/orders/page.tsx
- Reuse: apps/storefront/src/app/orders/[orderId]/page.tsx
- Reuse: apps/storefront/src/app/account/page.tsx
- Reuse: apps/storefront/src/app/account/addresses/page.tsx
- Update: docs/testing/desktop-evidence.md

**Interfaces**

- All requests use existing DTOs, validation, WebSession transport, and idempotency behavior from the storefront.
- Cart, checkout, payment, order, tracking, cancel, receive, account, and review routes remain on the web app.

- [x] Run existing Web regressions: pnpm test:e2e:checkout and pnpm test:e2e:fulfillment.
- [x] In the Tauri app, verify cart/quote, mock payment and COD, order history/detail, tracking, cancel/receive, account, addresses, and review entry. Check that no flow calls a native command or stores credentials locally.
- [x] Create or update a buyer cart/order on Web, reload Desktop, and confirm both clients show the same server state. Record results and environment in docs/testing/desktop-evidence.md.
- [x] Commit this task on the same feature branch with message: test(desktop): verify buyer commerce parity.

**Expected result:** The wrapper presents the existing checkout and account flows, and Web and Desktop show the same server-backed buyer data.

### Task 5: T144 — Run the Windows local demo checks

**Files**

- Update: .github/workflows/desktop-demo.yml
- Modify: apps/desktop/package.json
- Modify: apps/desktop/scripts/run-tauri.mjs and apps/desktop/scripts/run-tauri.test.mjs
- Modify: apps/desktop/src-tauri/src/navigation.rs and apps/desktop/src-tauri/tauri.conf.json
- Modify: apps/desktop/README.md
- Modify: turbo.json for API unit-test environment propagation

**Interfaces**

- The workflow is path-filtered for desktop changes, supports workflow_dispatch, and runs Node/Rust checks on a Windows runner with read-only repository permissions.
- The local demo defaults to http://localhost:3000; no GitHub variable, public URL, installer, or checksum is needed.
- Keep the desktop workspace out of the root build task and do not add publishing jobs or signing secrets.

- [x] Remove the production packaging path and default the demo launcher to the local storefront; reject remote origins.
- [x] Keep Tauri bundling disabled and add the Windows-only Node/Rust check workflow.
- [x] Record the Windows local demo launch and runtime evidence in docs/testing/desktop-evidence.md.
- [x] Run pnpm --filter @marketplace/desktop desktop:test.

**Evidence update 2026-11-09:** The desktop Node and Rust checks pass. The recorded Windows Tauri demo uses http://localhost:3000; no installer or public URL is part of acceptance.

**Expected result:** The Windows local demo starts without URL setup, and its Node/Rust checks run in a separate Windows workflow.

### Task 6: T145 — Accept SC-009 from the Windows local demo

**Files**

- Create or update: docs/testing/desktop-evidence.md
- Update: specs/001-marketplace-mvp/tasks.md
- Update: specs/001-marketplace-mvp/quickstart.md

**Interfaces**

- Evidence records Windows version/architecture, WebView2 version, Tauri/Rust versions, local storefront/API origins, launch result, test fixture, and observed session/navigation results.
- SC-009 desktop demo passes when the Windows local app can use the same buyer account and server data, preserve cart/order state after reload, complete the buyer flow, and revoke the session on logout.

- [x] Run the Web baseline for buyer and seller, then run the Windows Desktop buyer demo: login, discovery, persisted cart/order after reload, checkout/order visibility, and logout revocation.
- [x] Verify an unapproved origin cannot navigate in-app and the local page has no Tauri IPC/capability access. Check browser storage and auth requests for token handling.
- [x] Record actual commands, versions, local environment, passed/failed outcomes, and remaining limitations. No inferred results or CI-only evidence.
- [x] Update T145 and SC-009 status only from the recorded evidence. Keep T160 unchecked because executable desktop journeys remain a proposed follow-up.
- [x] Run final desktop checks: node --test apps/desktop/scripts/run-tauri.test.mjs; cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml; verify root CI test environment passthrough through Turbo's dry-run report.
- [x] Commit the recorded evidence and task status on the same feature branch. Create/update the single PR only after all six tasks and required evidence are complete.

**Expected result:** SC-009 accurately reflects the tested Web and Windows local desktop demo behavior.

**Evidence update 2026-11-09:** SC-009 is accepted for the Windows local demo from the recorded T141–T143 session and commerce flows. The MSI experiment is outside the agreed scope; no production deployment or installer support is claimed. See [desktop-evidence.md](../../testing/desktop-evidence.md) and [tasks.md](../../../specs/001-marketplace-mvp/tasks.md).

## Dependencies and Gates

- T140 precedes T141–T145.
- T141 must pass before buyer flow parity is accepted.
- T142 and T143 run sequentially after T141; both are prerequisites for T144/T145 demo acceptance.
- T144 validates the Windows launcher and desktop checks; T145 records the buyer flow against local storefront/API services.
- T146 security review and T147 performance measurement remain the project-wide release gates for CSP/security impact; this plan does not mark them complete.

## Official References

- Tauri external frontend URL and configuration merge: [Tauri configuration reference](https://v2.tauri.app/reference/config/) and [Tauri CLI reference](https://v2.tauri.app/reference/cli/).
- Tauri CSP and remote capability security: [CSP](https://v2.tauri.app/security/csp/) and [Capabilities](https://v2.tauri.app/security/capabilities/).
- Navigation filtering: [Tauri WebviewWindowBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html).
- Windows prerequisites: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).
- Next.js 16 nonce-based CSP and Proxy: [Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy) and [Proxy convention](https://nextjs.org/docs/app/getting-started/proxy).
