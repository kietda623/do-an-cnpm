# Marketplace commerce redesign — verification

Date: 2026-11-09. Approved design: `docs/superpowers/specs/2026-11-09-shopee-marketplace-redesign.md`. Baseline `e5f6d60`; branch `codex/shopee-marketplace-redesign`.

## Delivered scope

The former Signal Dispatch layer is replaced, not recolored in place. Shared tokens and controls now support an orange/white shopping system with neutral dark mode, compact radii, sans headings/prices and restrained motion. Shared CSS is an ordered entry point plus foundation/common/Buyer/Seller/Admin ownership files. Space Grotesk is no longer downloaded by the three layouts; metadata colors and Tailwind mappings match the new system.

Buyer has a wide search masthead, compact shopping entry, real category links, dense square-image cards, a catalog filter sidebar and two phone columns. The former multi-shop explainer is retained below merchandise. Seller prioritizes pending/processing work with genuine linked KPIs; Admin leads with the approval queue. All existing auth, account, cart, checkout, order, management and moderation components inherit the new controls and surfaces.

## All-route inventory

| App | Routes reviewed in source |
| --- | --- |
| Buyer — 12 | `/`, `/login`, `/register`, `/products`, `/products/[productId]`, `/shops/[shopId]`, `/cart`, `/checkout`, `/account`, `/account/addresses`, `/orders`, `/orders/[orderId]` |
| Seller — 10 | `/`, `/login`, `/register`, `/shops`, `/shops/[shopId]/dashboard`, `/shops/[shopId]/orders`, `/shops/[shopId]/products`, `/shops/[shopId]/analytics`, `/shops/[shopId]/reviews`, `/shops/[shopId]/settings` |
| Admin — 11 | `/`, `/login`, `/users`, `/shops`, `/products`, `/categories`, `/orders`, `/orders/[orderId]`, `/orders/returns`, `/audit`, `/shipments` |

Seller `/` still redirects according to membership; Admin `/shipments` still redirects to returns. No route, API contract, endpoint, permission, migration or purchase flow was removed or replaced. Source coverage is not a claim that every mutation on every route was independently executed.

## Browser evidence

- The combined browser run covered **51 existing tests** across Buyer, Seller and Admin, all passing. It also included the two new layout tests: the phone test passed; the desktop test encountered a transient null bounding box as auth restoration refetched the list. The new test now retries its unchanged geometry assertions after fonts settle. Its isolated rerun passed.
- **Three new commerce tests passed** together: merchandise in the first 900px desktop viewport with compact card width; two readable phone columns without page overflow; AA text contrast for primary/destructive controls in light/dark, normal/hover states.
- Before implementation, the layout regressions failed on the actual old UI: first product at approximately y=1043 and a single phone column. During implementation they caught a real cascade bug (83.5px cards), which was fixed by matching catalog selector specificity at phone widths.
- Existing browser coverage includes registration/profile/address/password/avatar, auth redirects, discovery/product detail/public shop, cart/quote/checkout, payment/receipt/cancellation/reviews, polling, Seller onboarding/queue/catalog/dashboard/sidebar, and Admin moderation/filtering/pagination/returns/audit. These suites use mocked API responses.
- Rendered checks passed for all three primary screens at **1440, 1024, 768px light and 390px dark** (12 screenshots): correct resolved theme, no uncaught page errors and no whole-page overflow. Existing theme suites additionally verify 360px and reduced motion.

Artifacts are under `test-results/shopee-redesign/`: `before/`, `after/`, `compare.html`, browser traces, and rendered audit output. Screenshots use explicit fixture data, including the missing-product-image state. They are not production inventory or revenue.

## Skill audits and review

Hallmark 2.0 and Taste 2.5.1 were read and used from their official source repositories. The reference orange was extracted from the fetched Shopee homepage; `.hallmark/brand-spec.md` and `preflight.json` record material and scope. `DESIGN.md` records the approved new system.

Hallmark static and rendered checks ran on the seven shared CSS sources and the three running web entries (Buyer home, Seller login, Admin login), producing 15 official-render screenshots. Its actual focus-ring failure on the masthead search was fixed and rerun. The final report has one static gate 56 finding: `.mp-header` and `.mp-console__topbar` are both sticky at zero in a shared stylesheet, but they belong to different apps and never coexist. This is a documented false positive; the report is not described as zero findings.

Taste's browser checker ran at 1440/1024/768/390. Its landing-page expectations (one full-screen section, a large photographic hero, repeated marketing CTA, English copy heuristics) conflict with the approved dense commerce screens and the empty live catalog. Its focus report helped identify the same masthead ring defect. The Next.js developer overlay is not an application menu or hidden app control. These limitations are not represented as passing all Taste heuristics.

Independent page/whole-branch reviews found and led to fixes for tablet Seller date controls, wrapped action icons and dark destructive-button contrast. The reviewer confirmed the semantic danger foreground/hover fix. No other blocking source or rendered layout issues remained in that review.

## Command and data boundaries

- `pnpm test`: **139 passed** (92 API, 32 API client, 15 UI; unchanged suites may use Turbo cache).
- `pnpm typecheck` and `pnpm lint:workspaces`: passed across all workspaces.
- `pnpm exec turbo run build --concurrency=1`: all four build tasks passed (API plus three web apps).
- `git diff --check`: passed.
- Local real API: ready, public products and categories returned HTTP 200; public catalog and categories were empty. No database reset, seed or real application-data mutation was performed for this redesign. No fake inventory, discounts, sold counts or revenue were added.

Browser geometry/behavior is checked with fixtures; backend transaction correctness is covered by existing backend tests, not inferred from screenshots. No new push, PR or merge is part of this change.
