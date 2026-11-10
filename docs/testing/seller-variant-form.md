# Seller variant form verification

The product-creation JSON textarea is replaced by controlled, labeled fields. The existing creation endpoint and `variants` payload (`sku`, `attributes`, string VND `price`, numeric `stock`, boolean `selling`) remain unchanged. Product metadata editing and versioned inventory adjustment retain their existing handlers.

## Checks completed

- TDD: the basic-variant journey initially failed because the new labeled variant group did not exist; the implemented editor passes it.
- Catalog browser suite: **8/8 passed**. Covers a basic product without attributes; multiple variants and attributes; removing a row without losing remaining data; duplicate SKU/attribute combinations before upload; zero price, fractional stock, incomplete attributes and no active variants; form preservation after a rejected write; existing publishing/editing/stock-conflict journey; rejected image upload; responsive/theme rendering.
- Visual rerun after narrowing the screenshot region: **1/1 passed**, six screenshots at 1440/768/390px in light and dark modes. No page overflow or truncated placeholders. Screenshots show test fixtures and unsubmitted form data, not current database records.
- Seller production build, typecheck and lint passed. Test/config ESLint passed.
- Independent source review: no blockers or actionable correctness findings.

## Running again

`pnpm test:e2e:catalog` starts the Seller and Admin test servers at 3101/3102. To use already-running servers, set `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_ADMIN_URL` to their origins. Browser tests intercept API requests; they do not seed/reset or mutate the user's database.

Screenshots are retained under `test-results/seller-variant-form-varian-c31c8-et-and-phone-in-both-themes/`. Generated Next type-reference changes are excluded from this feature.

## CI font-build follow-up

The initial push workflow (`42764863022`) failed during the Storefront production build, with six Space Grotesk virtual-font resolution errors: `next/font/google queries have exactly one entry`. The PR workflow for the same commit (`42764939608`) passed, confirming the failure was intermittent rather than a variant-form type or test failure.

An initial Webpack workaround passed all three local production builds, but PR workflow `42766577356` then exposed another Google-font loader failure (`Cannot read properties of null (reading '1')` in the remote font URL-extension parser). Changing the bundler alone did not remove the external font dependency.

The final fix ships the same seven font files through `@marketplace/ui-web/fonts` and `next/font/local`. Licensed, unmodified files are stored once in `packages/design-tokens/fonts`, with the official source commit, SHA-256 provenance and complete SIL licenses. All three layouts retain the same CSS variables and font-display behavior. Default `next build`/Turbopack commands are restored; neither development nor production needs Google Fonts responses.

Final local verification: all three default production builds passed (3/3 uncached tasks), including compilation, TypeScript and prerendering. Shared UI typecheck/lint passed. Font checks verified every SHA-256 digest and Vietnamese glyph coverage in all seven faces. Runtime source contains no Google Fonts imports. JSON formatting and `git diff --check` passed.
