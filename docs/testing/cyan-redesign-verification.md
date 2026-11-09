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

## Buyer

- Production build: passed, all existing routes retained.
- Typecheck and lint: passed.
- Initial real-data run: 27 screenshots, zero page errors and zero page overflow. Review identified that capture timing could include loading/scroll restoration; the utility now waits for settled content and resets scroll/focus before the final evidence run.
- Initial Hallmark kept inventory: links 28/28, fields 18/18, handlers 70/70, headings 1/1.
- Independent finish review found missing default button dimensions on plain link-buttons. Shared button defaults now provide a 44px target.
- The old contrast regression parsed computed OKLCH channels as RGB. The test now converts CSS colors through a browser canvas, retaining its existing 4.5:1 threshold.

## Detector interpretation

The shared stylesheet contains a shopping header and an operations topbar. They are rendered by separate shells and never coexist, so Hallmark's static “two sticky top:0” result needs contextual dismissal, rather than an offset that breaks a real layout. Existing checkout punctuation is retained under the higher-priority content-preservation requirement. Detector success alone is not a visual-quality claim.

Final app-specific results and any remaining limitations are recorded after the corresponding checks complete.
