# Marketplace commerce redesign implementation

Approved spec: `docs/superpowers/specs/2026-11-09-shopee-marketplace-redesign.md`.
Execution: implement now in the existing dedicated `codex/shopee-marketplace-redesign` branch. Root owns shared styles/tokens; isolated page ownership follows Hallmark's multi-page workflow. No push or PR requested for this new change.

1. **Shared foundation.** Replace Signal Dispatch palette with commerce orange/white and neutral dark tokens. Keep accessible primary colors, theme persistence, reduced motion and keyboard focus. Replace the old redesign override section with focused commerce stylesheets; preserve established class names and base component state styles. Update DESIGN.md and theme-color metadata. Verify typecheck/lint and contrast.
2. **Buyer composition.** Recompose home into compact shopping entry, category navigation and merchandise. Make header search prominent, cards dense with square imagery and price emphasis; responsive two-column phone grid. Preserve query/URL pagination, API data and all purchase/account routes. Add a browser regression asserting products reachable near first viewport, two phone columns and no page overflow; show it failing before styles/composition change.
3. **Seller composition.** Update Seller shell context and dashboard hierarchy; compact actionable queue/KPIs, forms, catalog, analytics/reviews/settings and auth. Preserve API calls, membership and form semantics. Existing Seller suites cover queue, publishing/filtering, shop onboarding, polling and theme.
4. **Admin composition.** Compact dashboard and operational navigation, emphasize pending approvals/returns, align tables/filters/dialogs across all Admin screens. Keep permissions and all actions. Existing Admin suites cover moderation, pagination, audits, returns and theme.
5. **Verification and handoff.** Inventory all 33 routes (including redirects), inspect screenshots at 1440/1024/768/390 plus 360px controls, inspect light/dark and errors/empty/loading. Use labeled API fixtures for populated screenshots because local public catalog is empty. Run full unit/typecheck/lint/build and relevant Playwright suites. Run Hallmark/Taste scripts and distinguish app-context false positives. Obtain independent final review, fix defects, record evidence and leave branch local.

## Review focus

- Orange header/menu text and primary buttons need AA contrast rather than copying inaccessible color pairs.
- Compact mobile grid must not overflow on long Vietnamese names/prices.
- Search URL, filter state and pagination metadata must survive composition changes.
- Sidebar drawers, account menus and dialogs must retain keyboard behavior.
- Current API has no public inventory: do not invent discounts, sold counts or write sample data into the user's database.
