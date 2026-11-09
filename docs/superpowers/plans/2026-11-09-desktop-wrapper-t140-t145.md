# Desktop Buyer Wrapper (T140–T145) Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this plan task by task. Keep the work sequential on one feature branch. Each task is independently reviewable.

**Goal:** Deliver a Tauri 2 desktop shell for the buyer storefront on Windows and macOS, with the existing web UI and session behavior.

**Architecture:** The Tauri window loads the deployed storefront URL in its system webview. It bundles no Next.js server or buyer UI, grants no Tauri commands to remote content, and blocks navigation outside one validated origin. The storefront serves a nonce-based CSP; the existing WEB client continues to keep access tokens in memory and use the HttpOnly refresh cookie and CSRF flow. A separate optional CI workflow builds test artifacts and checksums without publishing a release.

**Tech Stack:** Tauri 2 and Rust; Node 24, pnpm 12 and Turbo 2; Next.js 16, React 19; GitHub Actions; Windows WebView2 and macOS WKWebView.

**Spec:** specs/001-marketplace-mvp/spec.md, specs/001-marketplace-mvp/plan.md, specs/001-marketplace-mvp/tasks.md (T140–T145).

## Global Constraints

- Desktop is a Tauri 2 wrapper around the same responsive storefront. Do not implement separate buyer screens or embed a Next.js server.
- Production builds require DESKTOP_STOREFRONT_URL to be an exact HTTPS URL. Development may use the configured localhost storefront URL only.
- Permit top-level navigation only to the exact configured origin. Reject HTTP in production, lookalike hosts, unexpected ports, and untrusted redirect targets.
- Do not expose Tauri commands, plugins, filesystem access, shell access, or remote IPC to the storefront webview. Keep the capability set empty.
- Continue using the existing WEB session contract: access token in memory, refresh token in the HttpOnly Secure cookie, CSRF cookie/header, credentials included, and server-side logout revocation. Do not add native refresh-token storage or plaintext token persistence.
- The desktop webview has its own cookie jar. The acceptance requirement is that the buyer can sign in to the same account and see the same server-backed data as on Web; it does not require sharing a browser's login cookie.
- The remote storefront URL keeps the web origin. Configure API CORS with the exact storefront origin. Do not add tauri://localhost or wildcard origins for this remote-URL design.
- Keep the storefront and API HTTPS origins same-site so the current SameSite=Lax refresh cookie works on credentialed API requests. If deployment places them on different registrable domains, stop T141 and record an architecture decision before changing cookie policy.
- Enforce CSP in the storefront HTTP response. Tauri's configured CSP protects bundled assets; this design loads a remote page, so its CSP must come from the storefront host.
- A nonce CSP in Next.js 16 makes matched pages dynamically rendered and reduces static/CDN caching. Measure the effect in the existing performance work (T147).
- Add no generic build script to the desktop workspace. The current root Turbo build runs on Linux and must not start a Rust desktop build.
- Initial test matrix: Windows 10 version 1803 or later with WebView2, and macOS 10.15 or later. Confirm these floors against the exact pinned Tauri toolchain when implementing. Do not claim support for untested architectures.
- Produce Windows MSI and macOS DMG test artifacts with SHA-256 checksums. Do not publish to app stores or create a GitHub release. Build jobs need read-only repository access and no signing secrets.
- Keep T145 BLOCKED until the packaged app has been installed and its buyer flow has been observed on both target operating systems. CI compilation alone is not runtime evidence.
- Implement T140 through T145 sequentially on one feature branch, then update or open one PR after the evidence and final checks are complete.

## Approaches Considered

1. **Remote storefront in a Tauri webview — selected by the existing spec.** Reuses the current Next.js app, routes, API client, and WEB session. It needs a stable HTTPS URL and careful origin/navigation/CSP configuration.
2. **Bundle a static storefront inside Tauri.** Rejected because the storefront is a Next.js server app, and an embedded origin would add a second deployment/session/CORS path.
3. **Build native buyer screens.** Rejected because it duplicates the specified storefront UI and creates separate behavior to maintain.

## Current Repository Findings

- apps/desktop does not exist. pnpm-workspace.yaml already includes apps/*.
- The buyer app creates WebSession in apps/storefront/src/lib/session.ts. packages/api-client/src/transport.ts sends credentials and CSRF headers; the API sets HttpOnly Secure SameSite=Lax refresh cookies and checks configured browser origins.
- The current CI workflow runs on Ubuntu. A separate Windows/macOS workflow keeps the Rust and WebView toolchain out of the default workspace build.
- apps/storefront has no Proxy file or configured response CSP. The Tauri window uses a remote URL, so a CSP set only in tauri.conf.json would not protect the returned storefront page.
- .env.example currently says a future desktop build adds a Tauri origin. That note must be corrected for the remote storefront-origin design.
- The public production storefront URL is not currently configured in the repository. DESKTOP_STOREFRONT_URL will be a public build input, not a secret. T145 remains blocked until an HTTPS environment using the intended storefront and API origins is available.

## File Map

- Create apps/desktop/package.json for the workspace package, pinned Tauri CLI, and explicit desktop:dev, desktop:test, and desktop:build commands.
- Create apps/desktop/src-tauri/Cargo.toml, Cargo.lock, build.rs, src/main.rs, src/navigation.rs, and tauri.conf.json for the small native shell and exact-origin navigation policy.
- Create apps/desktop/src-tauri/icons/app-icon.svg and generated desktop icons (PNG, ICO, ICNS); Tauri's Windows resource build requires icon.ico even for Rust unit tests.
- Create apps/desktop/scripts/run-tauri.mjs to validate DESKTOP_STOREFRONT_URL and pass the remote URL to Tauri as a config override. Create apps/desktop/README.md for local setup and the public build variable.
- Create apps/desktop/scripts/run-tauri.test.mjs for URL and config validation tests.
- Create apps/storefront/src/proxy.ts for production CSP response headers and a focused Playwright security-header test under tests/e2e/.
- Create apps/storefront/src/lib/csp-policy.mjs, its csp-policy.d.mts type declaration, and csp-policy.test.mjs for production/development CSP policy tests.
- Modify apps/storefront/src/app/layout.tsx to pass the Proxy nonce to the existing inline theme script.
- Modify apps/storefront/next.config.ts to permit both supported loopback hostnames in local development.
- Modify apps/storefront/package.json to expose the CSP policy test through the workspace test command.
- Modify playwright.config.ts to include the focused storefront security-header test.
- Modify .env.example to document the local desktop URL and correct the CORS origin note. Extend apps/api/test/http/cors-csrf.spec.ts to cover the exact storefront origin and rejected origins.
- Create .github/workflows/desktop-build.yml for optional Windows/macOS builds, checksums, and uploaded workflow artifacts. Keep permissions read-only and pin actions to commit SHAs, following the existing CI policy.
- Create docs/testing/desktop-evidence.md to record Windows and macOS install, session, navigation, and buyer-flow evidence.
- Do not add a generic build task to turbo.json or apps/desktop/package.json. The existing pnpm workspace glob discovers the new package.

## Review Focus

1. A production URL with HTTP, credentials, a different port, or a lookalike host must fail before packaging; in-app navigation to an unapproved origin must be cancelled. Cover with Node URL-validation tests and Rust navigation unit tests in T140.
2. A remote page must receive an enforced production CSP with a fresh nonce and only the API, image, and font origins the storefront needs. Cover the response header and nonce behavior with the storefront security-header test in T140.
3. Credentialed refresh and logout must work from the exact storefront origin while an unrelated or tauri://localhost origin remains rejected. Cover the CORS/CSRF contract in T141 and confirm it in the installed webview.
4. A reload must restore the buyer session from the HttpOnly cookie; the access token must not appear in localStorage, sessionStorage, or the refresh request body. Logout must revoke the desktop session. Cover with existing WebSession tests plus the desktop smoke evidence in T141 and T145.
5. Windows WebView2 and macOS WKWebView may differ in cookie, CSP, installer, and certificate behavior. Record versions and observed results separately; T145 needs evidence for each OS.

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

- DESKTOP_STOREFRONT_URL is the only URL input. run-tauri.mjs validates and normalizes it, passes it to the Tauri config as build.frontendDist, and exports the same value to the Rust build. The app fails closed if it is missing or invalid.
- navigation::is_allowed_navigation(candidate: &url::Url, storefront_origin: &url::Url, is_dev: bool) -> bool compares the complete origin. The Tauri window uses it for top-level navigation and blocks new windows.
- The native shell exposes no commands to the webview. No plugin dependency is added.
- The production CSP is returned by the storefront Proxy with a fresh nonce. It allows the exact storefront/API origins and only observed asset origins; production script-src does not use unsafe-inline or unsafe-eval.
- The existing inline theme script in the root layout receives the request nonce explicitly through Next.js headers; framework-generated scripts continue to use Next.js nonce extraction.

- [x] Add Rust unit tests for the exact-origin policy: same HTTPS origin and paths pass; HTTP, another host, a lookalike suffix, another port, user-info URLs, loopback aliases, and non-HTTP schemes fail. Add Node tests for URL input validation, including local-only HTTP in development.
- [x] Run the URL and navigation tests before implementation; the deny-all Rust stub failed the valid-origin cases, and the URL suite initially failed until the validator module existed.
- [x] Add unit coverage for strict production CSP versus development-only eval, origin scoping, and configured asset origins. Add the Playwright test for the response CSP, fresh nonce, rendered storefront page, and inline theme-script nonce matching the CSP nonce. Include it in playwright.config.ts. The Playwright browser was installed after its initial missing-browser prerequisite; the completed E2E then passed.
- [x] Implement the Tauri window from the validated external URL. Keep capabilities empty, add no Tauri commands/plugins, and allow localhost only for the explicit development configuration.
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
- Production CORS_ORIGINS contains the storefront HTTPS origin. The current API refresh cookie remains HttpOnly, Secure, SameSite=Lax, and server logout continues to revoke the session.
- Document that DESKTOP_STOREFRONT_URL and CORS_ORIGINS are public configuration values; signing keys remain server-only.

- [x] Add CORS/CSRF tests for an allowed HTTPS storefront origin, an unrelated HTTPS origin, and tauri://localhost. Confirm only the configured storefront origin receives credentialed CORS permission.
- [x] Add WEB logout integration coverage for the HttpOnly Secure SameSite=Lax refresh cookie, omitted response refresh token, cookie clearing, and stale-cookie replay rejection.
- [x] Run the focused API unit suite: pnpm --filter @marketplace/api test. Run the session package suite through pnpm test and API integration suite through pnpm --filter @marketplace/api test:integration.
- [x] Run the local Tauri shell against http://localhost:3000 and the local API. Sign in, reload, make an authenticated request, log out, and confirm the revoked session cannot refresh. Inspect storage to confirm access tokens are not persisted.
- [x] Production storefront/API origins are not configured here. Document the same-site requirement and preserve the existing cookie policy; T145 remains gated on HTTPS deployment evidence.
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
- [x] Install and launch the debug Tauri app on the available target OS. Verify home, search/filter, product gallery/variant, shop, and public review screens load in the same remote origin.
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

### Task 5: T144 — Build and checksum Windows/macOS artifacts

**Files**

- Create: .github/workflows/desktop-build.yml
- Modify: apps/desktop/package.json
- Create: apps/desktop/scripts/write-checksums.mjs
- Create: apps/desktop/scripts/write-checksums.test.mjs
- Modify: apps/desktop/README.md
- Update: pnpm-lock.yaml and apps/desktop/src-tauri/Cargo.lock

**Interfaces**

- The workflow is path-filtered for desktop/storefront security changes and supports workflow_dispatch. It runs on Windows and macOS runners with read-only repository permissions.
- The workflow uses a repository variable DESKTOP_STOREFRONT_URL. It fails before building when the value is absent or not HTTPS.
- The package exposes desktop:build, not build. Artifacts are a Windows MSI and macOS DMG with a SHA256SUMS file.
- Upload results as workflow artifacts only. Do not create tags, releases, or publish jobs. Do not pass signing secrets to pull-request jobs.

- [ ] Add a checksum script test with a known fixture so the same SHA-256 format is produced on Windows and macOS.
- [ ] Configure exact Tauri 2 CLI/Rust crate versions and lockfiles. Add the selected Windows and macOS bundle targets and app identifier. Reuse the original icon source and generated platform icons created in T140. Keep the minimum OS values from the Global Constraints.
- [ ] Add the optional workflow with the repository's pinned-action policy, Node 24, pnpm 12.14.0, Rust toolchain, and target platform dependencies.
- [ ] Build on both runners with pnpm --filter @marketplace/desktop desktop:build. Generate checksums, verify every uploaded artifact has a matching checksum, and confirm the workflow never writes a release.
- [ ] Install each artifact on its matching OS and record installer result, runtime version, and checksum in docs/testing/desktop-evidence.md. macOS artifacts are internal acceptance builds; do not describe unsigned builds as ready for public distribution.
- [ ] Commit this task on the same feature branch with message: ci(desktop): build platform test artifacts.

**Expected result:** Both OS artifacts build and install for acceptance, with reproducible checksums and no publishing permissions.

### Task 6: T145 — Close SC-009 only with Windows and macOS evidence

**Files**

- Create or update: docs/testing/desktop-evidence.md
- Update: specs/001-marketplace-mvp/tasks.md
- Update: specs/001-marketplace-mvp/quickstart.md

**Interfaces**

- Evidence records OS version, architecture, WebView version, Tauri/Rust versions, storefront/API origins, artifact filename and SHA-256, install/launch result, test account fixture, and the observed session/navigation results.
- SC-009 desktop passes only when the same acceptance matrix is observed on Windows and macOS. Keep the status BLOCKED if either platform, HTTPS environment, or evidence is unavailable.

- [ ] Run the Web baseline for buyer and seller, then run the Desktop buyer smoke on Windows and macOS: login, discovery, persisted cart/order after reload, checkout/order visibility, and logout revocation.
- [ ] Verify an unapproved origin cannot navigate in-app and the remote page has no Tauri IPC/capability access. Check browser storage and auth requests for token handling.
- [ ] Record actual commands, versions, checksums, environment, passed/failed outcomes, and remaining blockers for each OS. No inferred results or CI-build-only evidence.
- [ ] Update T145 and SC-009 status only from the recorded evidence. Keep T160 unchecked because executable desktop journeys remain a proposed follow-up.
- [ ] Run final checks: pnpm lint:workspaces; pnpm typecheck; pnpm test; pnpm test:contracts; pnpm build; pnpm --filter @marketplace/api test:integration; pnpm test:e2e:discovery; pnpm test:e2e:checkout; pnpm test:e2e:fulfillment; pnpm --filter @marketplace/desktop desktop:test; pnpm --filter @marketplace/desktop desktop:build on both OS runners.
- [ ] Commit evidence and task status on the same feature branch. Create/update the single PR only after all six tasks and required evidence are complete.

**Expected result:** SC-009 accurately reflects tested Web and Desktop behavior, with separate observed evidence for Windows and macOS.

## Dependencies and Gates

- T140 precedes T141–T145.
- T141 must pass before buyer flow parity is accepted.
- T142 and T143 run sequentially after T141; both are prerequisites for packaging T144.
- T144 must produce and installable artifacts before T145 can start.
- T145 depends on a reachable HTTPS storefront/API environment whose origins satisfy the existing cookie and CORS policy. If this environment is missing, implementation can finish through T144, while T145 remains BLOCKED.
- T146 security review and T147 performance measurement remain the project-wide release gates for CSP/security impact; this plan does not mark them complete.

## Official References

- Tauri external frontend URL and configuration merge: [Tauri configuration reference](https://v2.tauri.app/reference/config/) and [Tauri CLI reference](https://v2.tauri.app/reference/cli/).
- Tauri CSP and remote capability security: [CSP](https://v2.tauri.app/security/csp/) and [Capabilities](https://v2.tauri.app/security/capabilities/).
- Navigation filtering: [Tauri WebviewWindowBuilder](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html).
- Platform prerequisites and installers: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/), [Windows installer](https://v2.tauri.app/distribute/windows-installer/), and [macOS distribution](https://v2.tauri.app/distribute/macos-application-bundle/).
- Next.js 16 nonce-based CSP and Proxy: [Content Security Policy guide](https://nextjs.org/docs/app/guides/content-security-policy) and [Proxy convention](https://nextjs.org/docs/app/getting-started/proxy).
