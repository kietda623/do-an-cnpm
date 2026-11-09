# Signal Dispatch redesign verification

Date: 2026-11-09. Scope: all three existing web applications; no mobile app or new business endpoints.

The redesign is in merge commit `44abf5a` (PR #38). PR #40 contains the follow-up shared-style audit. This record distinguishes source coverage, browser regression tests, rendered inspection and build checks.

## Design sources and implementation

- [Hallmark](https://github.com/Nutlope/hallmark), `skills/hallmark/SKILL.md` and `references/redesign.md`: preserve routes, data, handlers and the locked design system; inspect app screens inside their working shell.
- [Taste](https://www.tasteskill.dev/) / [source](https://github.com/Leonxlnx/taste-skill): consistent gutters, typography, controls, responsive rendering and keyboard interaction.
- `DESIGN.md` locks Signal Dispatch: teal/ink with orange signals, Space Grotesk / Be Vietnam Pro / IBM Plex Mono, Order Rail, shared tokens, storefront navigation and console navigation.
- Each application's root layout imports `@marketplace/design-tokens/styles.css` and `@marketplace/ui-web/styles.css`. All 33 route files use this system, including screens whose page logic did not need changing. No screen-specific legacy color literals remain in app TSX; viewport theme colors match the tokens.
- Existing API contracts, destinations, permissions and forms are retained. Dashboard figures come from API responses; simulated values retain their labels. Product fixtures without images display an explicit missing-image state.

## Route inventory and evidence

`[id]` denotes the existing dynamic route. Browser suites below use mocked API responses, not a live database. A source review is not represented as a browser test.

| App | Routes | Evidence |
| --- | --- | --- |
| Buyer | `/` | Rendered desktop/light and phone/dark; discovery, shell and theme suites |
| Buyer | `/login`, `/register` | Shared auth layout; buyer-account suite exercises registration, errors and authentication redirects |
| Buyer | `/account`, `/account/addresses` | buyer-account suite: save, upload, password, address, empty state, logout and failures |
| Buyer | `/products`, `/products/[productId]`, `/shops/[shopId]` | discovery, multi-shop-checkout and us8-storefront suites: search, pagination, unavailable product, detail and review |
| Buyer | `/cart`, `/checkout` | multi-shop-checkout and storefront-checkout-bootstrap: quote, placement and failed-load recovery |
| Buyer | `/orders`, `/orders/[orderId]` | fulfillment-buyer, polling-buyer and us8-storefront: progress, cancellation, simulated payment, receipt and review |
| Seller | `/` | Source review: retains membership-based redirect to dashboard or shops |
| Seller | `/login`, `/register` | Source review of shared console auth layout, registration API and `/shops` destination; shop-onboarding exercises login |
| Seller | `/shops` | shop-onboarding and polling-seller: application form and pending status |
| Seller | `/shops/[shopId]/dashboard` | Rendered desktop/light and phone/dark; seller-dashboard, polling-seller, seller-shell and theme-seller |
| Seller | `/shops/[shopId]/orders`, `/shops/[shopId]/products` | seller-orders-split and seller-product-filters: queue, rejection reason, filters and pagination |
| Seller | `/shops/[shopId]/analytics`, `/shops/[shopId]/reviews` | Shared dashboard range/revenue components; us8-seller exercises statistics and review filtering; analytics source reviewed |
| Seller | `/shops/[shopId]/settings` | Source reviewed: shared PageHeader/Panel/profile form/status controls and silent refresh; shell destination retained |
| Admin | `/` | Rendered desktop/light and phone/dark; admin-dashboard, polling-admin and theme-admin |
| Admin | `/login` | Shared console auth layout; admin-operations exercises login |
| Admin | `/users`, `/shops`, `/products`, `/audit` | admin-operations, admin-filters-pagination and polling-admin: moderation, dialogs, pagination, audit detail and refresh |
| Admin | `/categories` | Source review: shared category editor, fields, dialog and table; existing create/update handlers retained |
| Admin | `/orders`, `/orders/[orderId]`, `/orders/returns` | admin-operations and admin-return-confirmation: search, detail and return confirmation |
| Admin | `/shipments` | Source review: existing redirect to `/orders/returns`, no separate screen |

## Browser and skill checks

The combined regression run selected 50 existing tests from the Buyer, Seller and Admin suites above, with one worker and the running apps at ports 3000–3002: **50 passed**. It excluded destructive/live-database fulfillment suites. This proves browser behavior against fixtures, not backend transaction correctness.

The rendered inspection uses the existing discovery/dashboard fixtures, at 1440px/light and 390px/dark. It checks the actual resolved theme, page width and uncaught page errors before saving screenshots under `test-results/design-final/`. Images are local test artifacts, not shipped product assets. Existing theme tests additionally cover 360px, reduced motion, persisted mode and operating-system preference.

Hallmark static audit of the shared CSS fell from 96 floor findings to one. The remaining gate 56 combines unrelated sticky selectors from the shared stylesheet: the Buyer header, console topbar and table headers inside their own overflow containers. Buyer and console headers do not coexist; table headers scroll inside `.mp-table-wrap`. This is recorded as a static false positive, not a zero-findings claim.

Taste's browser audit also reports marketing-page assumptions (full-screen hero, one repeated CTA and English copy heuristics). These do not define the marketplace's task screens or Vietnamese copy. Its hidden-focus report targets the Next.js development overlay. The header search has a real accessible label; its visually hidden treatment is intentional within the compact search bar. None of those reports justifies adding invented sales claims or removing functional controls.

## Theme animation regression

Rendered inspection exposed uncaught `Transition was skipped. New ViewTransition started` errors. Theme restoration and the React effect both started animations, while clicking started another transition. The fix applies restored/system themes immediately, waits for persisted-mode initialization, animates only explicit toggle clicks, and handles the native transition's rejected `ready` promise.

A new `theme-storefront.spec.ts` regression stubs a skipped browser transition. Before the fix it observed three transitions during restoration instead of zero. After the fix it verifies zero restoration transitions, exactly one click transition, the selected dark theme and no uncaught errors. The three-test Buyer theme suite passed after the fix.

## Check boundaries

The pre-follow-up tree passed `pnpm test` (139 tests). After the animation fix, the 15 UI unit tests, three Buyer theme browser tests, three rendered suites (six screenshots), full workspace typecheck and lint passed. `pnpm exec turbo run build --concurrency=1` passed all four build tasks (API and the three web apps). An initial Admin build failed while resolving Google font queries; recreating its generated build cache resolved it without changing fonts, dependencies or application configuration. `git diff --check` passed.

An independent review of the shared-style diff, theme fix, regression and all six screenshots found no blocking issues. The deterministic skipped-transition test does not claim to measure native reveal timing. Source-reviewed routes above are not claimed to have every mutation independently exercised. No database reset or application data mutation was needed for this visual audit.
