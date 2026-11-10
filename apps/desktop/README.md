# Marketplace Desktop Demo

This is a Windows-only Tauri 2 demo for the existing buyer storefront. It opens the local storefront in WebView2; it does not bundle a second storefront, require a public URL, or expose native commands to the page.

## Run the demo

1. Start PostgreSQL, Redis, the API, and the storefront using the repository quickstart.
2. Run `pnpm --filter @marketplace/desktop desktop:dev`.

The launcher defaults to `http://localhost:3000` and permits navigation only on that local origin. It rejects remote hosts, other ports, credentials, queries, and fragments. Do not set `DESKTOP_STOREFRONT_URL` for the standard demo.

## Checks and prerequisites

- Run `pnpm --filter @marketplace/desktop desktop:test` for the Node and Rust checks.
- Windows requires Rust's MSVC toolchain, Microsoft C++ Build Tools, and the WebView2 Runtime.
- The API uses its existing WEB session flow: access tokens remain in memory, refresh cookies are HttpOnly, and CSRF protection remains enabled.
- The demo does not build an installer or publish a release. Server signing keys and API credentials stay on the API server.
