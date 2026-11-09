# Desktop buyer evidence

## Windows development smoke

| Item              | Observed value                                                               |
| ----------------- | ---------------------------------------------------------------------------- |
| Storefront origin | `http://localhost:3000`                                                      |
| API base URL      | `http://localhost:4000/api/v1`                                               |
| OS                | Windows 11 Home Single Language, build 26200, x64                            |
| WebView2 runtime  | `157.0.4341.42`                                                              |
| Node.js / pnpm    | `v24.21.0` / `12.14.0`                                                       |
| Rust / Cargo      | `rustc 1.94.1` / `cargo 1.94.1`                                              |
| Tauri             | CLI `2.12.4`, Rust crate `2.12.5`                                            |
| Fixture services  | Disposable PostgreSQL `17.11` and Redis `8.10.3`, without persistent volumes |

The debug Tauri window opened the same storefront at `http://localhost:3000`; navigation did not switch to a `tauri://` origin. The local API used the existing WEB session contract.

### T141 authentication checks

- WEB sign-in succeeded, reload refreshed the session, and `/users/me` loaded while authenticated.
- Logout revoked the session; replaying the stale refresh cookie was rejected.
- WebView local and session storage contained no access or refresh token.
- API integration assertions cover the HttpOnly, Secure, SameSite=Lax refresh cookie, the omitted JSON refresh token, and cookie clearing at `/api/v1/auth` with `Max-Age=0`.

### T142 discovery and product checks

| Route / flow                                                           | Result                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Home `/`                                                               | Rendered in the Tauri window                                                   |
| Product discovery `/products`                                          | Rendered 1,000 demo catalog records                                            |
| Search `Demo Product 01-001`                                           | Query and page state rendered; one matching product opened                     |
| Product detail                                                         | Gallery region, variant selector, inventory, and public review region rendered |
| Shop `/shops/1b396143-9e47-51ae-9fe6-baf0afeed396`                     | `Demo Shop 01` and its 100 products rendered                                   |
| Public review fixture `/products/88888888-8888-4888-8888-000000000001` | Review by `US8 Buyer`, rating 5/5, rendered                                    |

The demo seed provides image metadata but no image files. The product detail therefore showed a broken image for the seeded product; the gallery region and variant control still loaded. The public review fixture also has no product image. This is a fixture limitation, not evidence of image delivery from a packaged or production environment.

### Automated checks

| Command                                                                                               | Result   |
| ----------------------------------------------------------------------------------------------------- | -------- |
| `corepack pnpm --filter @marketplace/storefront test`                                                 | 4 passed |
| `corepack pnpm test:e2e:discovery`                                                                    | 5 passed |
| `corepack pnpm exec playwright test tests/e2e/storefront-shell.spec.ts --config=playwright.config.ts` | 2 passed |

Playwright emitted non-fatal Next.js view-transition `AbortError: Transition was skipped` console warnings; all assertions passed. The discovery run required stopping the previous smoke-test dev server so Playwright could start a fresh server.

The discovery run exposed a development-only CSP mismatch: the API client normalized `localhost` to `127.0.0.1`, while the dev policy allowed only the configured loopback spelling. Development `connect-src` now allows both loopback spellings when the storefront and API use loopback hosts. The root Playwright config also now includes `storefront-shell.spec.ts`, which its explicit test match had omitted.

## Release evidence still required

Production HTTPS storefront/API origins are not configured in this environment, and no macOS runner or packaged macOS app was available. T145 production and macOS checks remain gated; this document records Windows development evidence only.
