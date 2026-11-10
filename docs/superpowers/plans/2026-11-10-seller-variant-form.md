# Seller variant form

Replace the product-creation JSON textarea with ordinary, labeled fields in the existing sopi design system. The screenshot identifies `ProductCreateForm`; the current product-edit form already uses ordinary fields and inventory changes have a dedicated versioned action.

1. Write browser coverage for a single variant, multiple variants, add/remove stability, duplicate/invalid values, API failure preservation and responsive layout. Run a representative test red before implementation.
2. Add a focused draft-to-payload validator and a controlled variant editor alongside the existing catalog forms. Start with one empty variant; allow up to the API's 100 variants. Each has SKU, integer VND price, initial stock, selling and optional attribute name/value pairs. No sample values are submitted by default.
3. Wire the editor into creation, validate before image upload, keep the current product endpoint/payload and reset only after a successful API response. Preserve failed submissions for manual retry. Leave product metadata editing and versioned inventory actions intact.
4. Update existing publishing journeys to enter variants through the visible controls. Verify creation, existing editing and stock-conflict handling, plus typecheck/lint/build. Inspect real form layouts at desktop/tablet/phone in both themes without writing to the user's database.

Files: catalog `variant-draft.ts`, `variant-editor.tsx`, `product-create-form.tsx`; owning `commerce-seller.css`; publishing/variant Playwright coverage and catalog test configuration. No endpoint, migration or dependency changes.

Completed. Verification: 8/8 browser cases, six responsive/theme screenshots, Seller build/typecheck/lint and independent review. Details: [seller-variant-form.md](../../testing/seller-variant-form.md).
