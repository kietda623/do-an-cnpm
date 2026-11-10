# Commerce motion and UI finish

Date: 2026-11-09. Baseline: `f746ef4`. Scope: shared interaction finish across Buyer, Seller and Admin, retaining the approved Shopee-style commerce direction and readable filter sizes.

## Changes

- Added an explicitly owned `commerce-motion.css` after the component/composition imports. Product hover depth and image zoom, button press wave, native-details popovers, dialog/backdrop entrances, selected navigation and interaction feedback are finite and use transform/opacity rather than animating layout dimensions.
- Improved welcome surface hierarchy, category touch targets, field focus labels, filter identity and console selection marker. No API, route, permission, data or form behavior changed.
- Route transitions no longer force a synchronous layout read. Two cancellable animation frames restart the route class, the 320ms timer is scheduled after entry, and cleanup cancels both frames/timer and removes the class. Reduced motion skips the choreography entirely.
- Reduced motion disables new decorative effects and the previous instantaneous product-card hover displacement. Focus rings remain immediate. Content and controls remain visible during motion.

## Evidence

- Mobile menu regression failed before implementation (`animation-name: none`), then passed with the new finite popover animation and usable links; reduced mode has no popover animation.
- The strengthened reduced-motion test reproduced the former `translateY(-2px)` product hover. After the override and refreshing the shared CSS import entry, it verifies `transform: none`. The development server initially served an older CSS dependency snapshot; the actual CSSOM was inspected rather than weakening the assertion.
- Combined fixture browser suite: **57 passed**, covering Buyer shopping/account/order, Seller onboarding/catalog/queue, Admin moderation/audit/returns, polling, themes and responsive commerce controls.
- Final focused commerce/theme suite also checks full placeholders at 1440/1024/768/390/360, two phone product columns, action contrast, native menus and reduced motion after the hover correction.
- Rendered inspection: three apps at 1440/1024/768 light and 390 dark, 12 screenshots; three render suites passed, with no uncaught page errors or whole-page overflow. Artifacts remain in `test-results/shopee-redesign/after/`.
- UI package typecheck and lint, the changed browser spec's ESLint check, 15 UI unit tests, and `git diff --check` passed. Production build verifies all three web applications and API.
- Independent read-only review found no blocking issues; its pre-existing reduced-hover observation was addressed and covered by the strengthened test.

Browser screenshots/flows use explicitly mocked API data and do not establish live backend transaction correctness. No seed, database reset, real inventory mutation, push, PR or merge was performed.
