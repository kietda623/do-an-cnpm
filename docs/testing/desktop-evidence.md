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

### T143 cart, checkout, and account checks

| Check               | Result                                                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web regressions     | `pnpm test:e2e:checkout` passed 3/3; `pnpm test:e2e:fulfillment` passed 1/1 against the disposable PostgreSQL/Redis services.                                                                                                                                              |
| Cross-client state  | A cart item and default address created on Web appeared in the Tauri cart and checkout. The Web-created MOCK and COD orders appeared in Tauri order history after reload.                                                                                                  |
| Cart and quote      | Tauri showed `Demo Product 01-001 × 1`, the Web-created default address, and a 10.000₫ price/inventory quote.                                                                                                                                                              |
| MOCK payment        | Tauri simulated success for `ORD-MW9A49GU-B1F986BC`; the order showed paid 10.000₫ and a successful mock transaction.                                                                                                                                                      |
| COD cancellation    | Tauri cancelled `ORD-MW9A4E7K-90CC98DA` with the disposable reason `T143 test hủy đơn COD`; the order list showed it as cancelled.                                                                                                                                         |
| Tracking and review | `DEMO-COMPLETED-COD-001` showed the `DEMO-TRACK-DEMO-COMPLETED-COD-001` delivery event and review form entry.                                                                                                                                                              |
| COD receipt         | Tauri-created `ORD-MW9AG931-A36E4620` was confirmed, packed, tracked through pickup/transit/delivery in the seller UI, and marked COD-collected. Tauri then confirmed receipt; the order changed to complete, retained its shipment timeline, and exposed the review form. |
| Account and session | Tauri displayed the Web-created default address. The app remained at the same `http://localhost:3000` origin; T141 storage inspection found no access or refresh token in local/session storage, and the shell exposes no native commands/plugins.                         |

The fulfillment run initially stopped at API readiness because the local process lacked `RATE_LIMIT_KEY_SECRET` and `RATE_LIMIT_KEY_PREFIX`. Supplying the disposable test values resolved readiness; the rerun passed. The runs logged non-fatal Next.js view-transition `AbortError: Transition was skipped` warnings.

## T144 Windows local demo

| Item                 | Observed value |
| -------------------- | -------------- |
| Storefront origin    | `http://localhost:3000` |
| URL setup            | None; launcher defaults to localhost |
| OS / architecture    | Windows 11 Home Single Language, build 26200, x64 |
| Runtime              | WebView2 `157.0.4341.42`; Node.js `v24.21.0`; pnpm `12.14.0`; Rust/Cargo `1.94.1` |
| Tauri                | CLI `2.12.4`; Rust crate `2.12.5` |
| Package              | None; demo runs from the development launcher |
| Desktop tests        | `corepack pnpm --filter @marketplace/desktop desktop:test` — 2 Node tests and 3 Rust tests passed after the local-only scope change |

The launcher opens the local storefront without `DESKTOP_STOREFRONT_URL` and rejects any non-local origin. The workflow runs desktop checks on Windows only. An earlier MSI packaging experiment is outside this demo scope and is not used as acceptance evidence.

## T145 SC-009 demo acceptance

The T141–T143 Windows smoke above demonstrates the buyer session and commerce flows against the local API: Web-created cart/address/order data appeared in Tauri, checkout and MOCK/COD flows completed, state remained visible after reload, and logout revoked the session. The demo uses the same local storefront and server-backed account; it does not require a public deployment or installer.

SC-009 is accepted for the scoped Windows local demo. This evidence does not claim production deployment, installer support, or a packaged release.
