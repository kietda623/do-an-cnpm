# Cyan redesign verification

Direction approved on 2026-11-09: light neutral + cyan. Keep current database contents and honest empty states. No seed, reset or invented catalog material.

## Evidence boundaries

- Before: 54 screenshots from the real running API at 1440 and 390px, stored in `%TEMP%/cnpm-design-survey-20261109`.
- After: the read-only utility `node scripts/capture-cyan-real.mjs buyer|seller|admin` captures 1440, 768 and 390px into `%TEMP%/cnpm-cyan-after`. It signs in using existing local environment credentials and never writes them into reports.
- Populated product/order journeys in Playwright use mocked API responses. These prove regression behavior, not current production content. They are not design screenshots or database seed data.
- `node scripts/presentation-invariants.mjs` compares 79 source files against the immutable pre-redesign inventory: non-JSX logic, protected interactive attributes and JSX expressions. Layout font metadata is explicitly presentation-only; the session initialization script is still compared.

## Shared foundation

- Shared UI unit tests: 15 passed.
- API client tests: 32 passed.
- Shared UI typecheck and lint: passed.
- Browser-canvas conversion of actual OKLCH colors: primary/white 5.68:1; foreground/surface 16.15:1; muted/surface 6.68:1; dark accent/foreground 9.79:1; dark muted/surface 8.08:1.
- Only transform and opacity transitions remain; skeleton shimmer moves a pseudo-element rather than animating background position. Reduced-motion alternatives remain in place.
- PostCSS inspection of every shared stylesheet found no animated keyframe properties outside transform/opacity.

## Buyer

- Production build: passed, all existing routes retained.
- Typecheck and lint: passed.
- Initial real-data run: 27 screenshots, zero page errors and zero page overflow. Review identified that capture timing could include loading/scroll restoration; the utility now waits for settled content and resets scroll/focus before the final evidence run.
- Initial Hallmark kept inventory: links 28/28, fields 18/18, handlers 70/70, headings 1/1.
- Independent finish review found missing default button dimensions on plain link-buttons. Shared button defaults now provide a 44px target.
- The old contrast regression parsed computed OKLCH channels as RGB. The test now converts CSS colors through a browser canvas, retaining its existing 4.5:1 threshold.
- Buyer Playwright run: 29 passed initially; the three failed cases were rerun separately and all passed (account journey, corrected contrast measurement and multi-shop checkout). All 32 cases have passing evidence; this is not represented as a single clean first run.
- Final real-data capture: 27 screenshots, no page errors or horizontal overflow; independent finish review: ship.
- Final Hallmark inventory remains 28/28 links, 18/18 fields, 70/70 handlers, 1/1 headings. Two static findings remain contextual: original punctuation and mutually exclusive sticky shells.
- Impeccable URL detector at 390×844 returned no findings. Taste consistency ran at 1440/768/390 and reported 35 failures/22 warnings, largely marketing-page assumptions (full-screen hero, obligatory imagery, English skip-link recognition, a theme button mistaken for a menu, and framework dev overlay). These are not a clean pass. Its legitimate mobile target-size observations were applied to brand, search and footer links. Application functional/reduced-motion tests are recorded separately because Taste quick mode does not exercise those flows.

## Detector interpretation

The shared stylesheet contains a shopping header and an operations topbar. They are rendered by separate shells and never coexist, so Hallmark's static “two sticky top:0” result needs contextual dismissal, rather than an offset that breaks a real layout. Existing checkout punctuation is retained under the higher-priority content-preservation requirement. Detector success alone is not a visual-quality claim.

Final app-specific results and any remaining limitations are recorded after the corresponding checks complete.

## Seller

- Production build, typecheck and lint passed; all existing routes remain.
- Playwright: 14/14 passed, including shop switching, catalog filters, order transitions, keyboard-trapped mobile navigation and themes.
- Final real-data capture: 27 images, zero page errors and no horizontal overflow. Earlier attempts caught intermittent API login/refresh `500` responses; a direct real API login later returned `200`. The final capture waits for the membership redirect and navigates through the actual mobile drawer to retain the session.
- Hallmark: links 25/25, fields 19/19, handlers 66/66 and headings 2/2 retained. One static sticky-shell finding is the same mutually exclusive-shell false positive described above.
- Impeccable mobile login detector: no primary findings; one advisory paragraph wrap. Desktop density is retained while mobile small buttons and panel action links have 44px targets.
- Taste consistency: 30 failures/8 warnings on the login surface, mainly marketing-page structure expectations; its focus finding belongs to the Next development overlay. These results are retained without claiming a clean detector run. The current saved shop logo URL does not render; this existing data/asset condition is kept separate from the presentation changes and is not replaced with invented imagery.

## Admin

- Production build, typecheck and lint passed. The build was rerun after the user-table width correction.
- Playwright: 11/11 passed, covering filtering/pagination, account lock, moderation, order inspection, return confirmation, polling and themes.
- Final real-data capture: 27 images, no page errors or horizontal overflow. The user table now preserves readable identity columns and scrolls locally at 390/768px.
- Independent finish review: ship after the table correction.
- Hallmark kept: links 19/19, fields 19/19, handlers 75/75, headings 2/2. Three contextual static findings remain: the separate sticky shells and retained original punctuation/metadata separators.
- Impeccable mobile login detector: no findings. Taste consistency reported 35 failures/8 warnings; marketing structure and development-overlay findings remain explicitly separate from application verification.

## Final result and practical limits

- Three web production builds passed. `pnpm typecheck`, `pnpm lint:workspaces`, `pnpm test`, and ESLint for the new verification utilities passed. Turbo reused unchanged API/API-client task results where valid; shared UI tests ran afresh.
- All 57 unique browser cases have passing evidence: Buyer 32 (29 initial plus 3 successful reruns), Seller 14, Admin 11. These browser journeys use fixtures and do not submit moderation or purchase writes to the current database.
- Final real API screenshots total 81: 27 per app at 1440/768/390px, no page errors, no page overflow and no API `5xx` in those final captures. Authentication-only `401` responses before sign-in are expected.
- The 79-file presentation invariant remains unchanged. All three independent app finish reviews concluded ship after the recorded presentation corrections.
- Final Impeccable anonymous mobile scans returned no findings on Buyer catalog, Seller login and Admin login; the Seller paragraph-wrap advisory was resolved with `text-wrap: pretty`. Protected screens were reviewed through the real-data captures and functional tests, not through those anonymous detector scans.
- Raw detector summaries, findings and screenshot filenames are retained in [cyan-design-checks.json](cyan-design-checks.json). Hallmark retains 6 contextual static findings across the three app scans; Taste's landing-page-oriented results are not represented as clean passes. No synthetic fullscreen hero, fake photos or new application controls were added to satisfy those unrelated marketing rules.
- Before/after gallery: `%TEMP%/cnpm-cyan-after/index.html`. Captures and detector browser outputs stay local and are ignored by Git. The current shop-logo asset URL remains a pre-existing content issue.
- Browser evidence uses Chromium at emulated widths and synthesized keyboard interaction. Physical touch devices, Safari, and database-reset integration suites are outside this presentation-only verification.
- A final targeted rerun against the committed `playwright.presentation.config.ts` passed 10/10 layout, placeholder, contrast, reduced-motion, Seller drawer and Admin theme cases after the shared polish. The full configuration lists the same 57 existing cases used by the per-app runs.
- Route inventory remains 33 files: Buyer 12, Seller 10 and Admin 11, including redirects and dynamic detail routes. Empty current data limits populated detail screenshots; fixture-backed detail journeys are identified as such above.
