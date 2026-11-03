# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Buyer** — browses the multi-vendor catalog, keeps a cart across shops, checks out with COD or MOCK payment, tracks orders, cancels per shop, confirms receipt, and reviews purchased items.
- **Shop Owner / Manager** — acts through `ShopMember` (`OWNER` / `MANAGER`); runs one or more shops: onboarding, catalog and inventory, order fulfillment, revenue, reviews, and shop profile.
- **Admin** — platform operator with the `ADMIN` system role: user lock/unlock, shop approval and suspension, categories, product moderation, order inquiry and recovery, return confirmation, and the audit log.

## Product Purpose

A multi-vendor marketplace MVP for the Vietnamese market. It makes listing, buying, paying (COD/MOCK), fulfilling, cancelling, refunding, and reviewing possible in one system with consistent inventory and payment settlement. Success means every actor can complete their job against real API data without leaving the surface.

## Positioning

The differentiator is the settlement and fulfillment model: multi-shop orders, 15-minute price/stock quotes, per-shop cancellation with idempotent stock restore and late compensation, and an auditable admin recovery path. Surfaces must make those rules legible instead of hiding them behind generic e-commerce chrome.

## Operating Context

- Vietnamese-language UI; VND amounts; Asia/Saigon timezone for operator range filters.
- Three web surfaces share one identity/session: storefront, seller console, admin console.
- Seller access is membership-based, not a `SELLER` system role.
- Operators act on lists: pending shops, pending orders, moderation queue, returns, audit.

## Capabilities and Constraints

- Payments are `COD` and `MOCK` only; simulated revenue and stats are returned with `simulated: true` and must be labelled.
- Real endpoints only. No backend, contract, or generated-client changes in UI work.
- No voucher engine, no monthly GMV series, no rating-distribution endpoint. Do not fabricate them.
- Writes use `Idempotency-Key` and `expectedVersion`; 409 means reload before retry.
- Existing Playwright specs select by Vietnamese accessible name; keep one consistent copy set and update specs with it.
- Mobile (`apps/mobile`) and desktop (`apps/desktop`) are out of scope.

## Brand Commitments

- Product name shown in UI: **Marketplace** (seller console: Seller Center; admin console: Marketplace Admin).
- Voice: direct, calm Vietnamese; verbs name the action; errors name the problem and the recovery.
- No invented brand claims, testimonials, benchmarks, or demo imagery.

## Evidence on Hand

- Functional API with OpenAPI contract and generated client.
- Existing screens for all three actors (visually thin, behaviorally wired).
- Structural wireframes in `docs/design/screen-flows.md` (B01–B13, S01–S11, A01–A07) and component intents in `specs/001-marketplace-mvp/ui-plan.md`.
- Playwright journeys in `tests/e2e/` for discovery, account, checkout, fulfillment, seller, admin.

## Product Principles

1. Show the real state of the marketplace; never dress a missing capability as working UI.
2. One design system, two densities: storefront for deciding and buying, consoles for scanning and acting.
3. Every async surface has loading, empty, error, and unauthorized states.
4. Money and order changes are explicit, reversible where the domain allows, and never double-applied.
5. Operator controls prefer tables, filters, and a single clear action over decorative dashboards.

## Accessibility & Inclusion

- WCAG AA contrast; visible 3px focus ring; native landmarks and heading order.
- Inputs always have labels; async notices use `role="status"`, errors use `role="alert"`.
- Dialogs are native `<dialog>` with focus return; all flows keyboard-operable.
- Minimum 44px touch targets; layouts hold at 360px wide.
