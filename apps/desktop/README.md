# Marketplace Desktop

This is a Tauri 2 shell for the existing buyer storefront. It loads the configured remote storefront in the system webview; it does not bundle a second storefront or expose native commands to the page.

## Local development

1. Start the API and storefront using the repository's normal development commands.
2. Set `DESKTOP_STOREFRONT_URL=http://localhost:3000` (or `http://127.0.0.1:3000`) in the environment or repository-root `.env` file.
3. Run `pnpm --filter @marketplace/desktop desktop:dev`.

The launcher rejects a missing URL, non-local HTTP URLs, nonstandard ports, URL credentials, queries, and fragments. An HTTPS storefront may be used in development as well.

## Native prerequisites

- Windows: Rust's MSVC toolchain and the Microsoft C++ Build Tools, plus the WebView2 Runtime.
- macOS: Rust and Xcode Command Line Tools.

Build configuration such as `DESKTOP_STOREFRONT_URL`, `NEXT_PUBLIC_API_URL`, and `S3_PUBLIC_READ_BASE` is public URL information, not a secret. Server signing keys and API credentials belong only on the API server.
