# Marketplace Desktop

This is a Tauri 2 shell for the existing buyer storefront. It loads the configured remote storefront in the system webview; it does not bundle a second storefront or expose native commands to the page.

## Local development

1. Start the API and storefront using the repository's normal development commands.
2. Set `DESKTOP_STOREFRONT_URL=http://localhost:3000` (or `http://127.0.0.1:3000`) in the environment or repository-root `.env` file.
3. Run `pnpm --filter @marketplace/desktop desktop:dev`.

The launcher rejects a missing URL, non-local HTTP URLs, nonstandard ports, URL credentials, queries, and fragments. An HTTPS storefront may be used in development as well.

## Production configuration

- Set `DESKTOP_STOREFRONT_URL` to the exact public HTTPS origin used by the buyer storefront, including its port only when it is the standard HTTPS port. This value is public build configuration.
- Add that same exact storefront origin to the API's `CORS_ORIGINS`. Do not add `tauri://localhost`; the desktop page keeps the storefront's web origin.
- Keep the storefront and API on the same site (the same registrable domain) so the existing `SameSite=Lax` refresh cookie works for credentialed API requests. The refresh cookie remains `HttpOnly`, `Secure`, and `SameSite=Lax`; desktop uses its own webview cookie jar and can sign in to the same account.
- Keep signing keys and API credentials on the API server. `DESKTOP_STOREFRONT_URL`, `CORS_ORIGINS`, and other public URL settings are not secrets.

## Acceptance builds

Set `DESKTOP_STOREFRONT_URL` to the reachable HTTPS storefront before a release build. Run `pnpm --filter @marketplace/desktop desktop:build` on the target OS: Windows creates an MSI, and macOS creates a DMG. The workflow's unsigned artifacts are for internal acceptance only; this project does not sign, publish, or create releases.

The initial support floor is Windows 10 version 1803 with WebView2 and macOS 10.15. The macOS bundle declares its minimum system version as 10.15. Acceptance artifacts currently target Windows x64 and macOS ARM64; do not infer support for other architectures.

## Native prerequisites

- Windows: Rust's MSVC toolchain and the Microsoft C++ Build Tools, plus the WebView2 Runtime.
- macOS: Rust and Xcode Command Line Tools.

Build configuration such as `DESKTOP_STOREFRONT_URL`, `NEXT_PUBLIC_API_URL`, and `S3_PUBLIC_READ_BASE` is public URL information, not a secret. Server signing keys and API credentials belong only on the API server.
