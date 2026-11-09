# Design system — Marketplace Commerce

Approved direction: Shopee-like shopping storefront and Seller Centre-like operations, as specified in docs/superpowers/specs/2026-11-09-shopee-marketplace-redesign.md. This replaces the previous Signal Dispatch visual system across Buyer, Seller and Admin.

## Identity and hierarchy

Marketplace retains its own name and existing functions. The dominant identity is commerce orange on white, a light neutral page canvas, dense merchandise, compact controls and straightforward Vietnamese typography. Do not add rival logos, unsupported promotions, fabricated sold counts, or invented service promises.

Buyer prioritizes finding products, comparing prices and checking out. Seller prioritizes pending orders and catalog maintenance. Admin prioritizes approvals, returns and moderation. Every route shares the same semantic component foundation; console screens do not use a marketing hero.

## Color and typography

All colors and fonts come from packages/design-tokens/src/styles.css. Brand orange #EE4D2D was observed in source fetched from https://shopee.vn on 2026-11-09. It is a reference for decorative identity. Accessible action/masthead orange #C9361B is used when paired with small white text; hover/link orange is #A72D17. Light canvas #F5F5F5, surface white, primary text #252525, secondary #666666, separators #E4E4E4. Controls have a stronger border than decorative separators.

Be Vietnam Pro is used for body, headings, tables and prices. Body 14–16px; page headings 22–28px; panel headings 16–18px. Money and table numbers use tabular numerals, not instrumentation-style monospace. IBM Plex Mono is available for code/SKU values only. No tracked capitals or ornamental eyebrows. Labels are readable Vietnamese sentence case.

Dark mode uses neutral charcoal surfaces with warm-orange actions; never the old green-tinted background. Existing light/dark/system preference, prepaint script, localStorage key marketplace-theme, accessible toggle labels and reduced-motion behavior remain. Persisted mode restoration does not animate; explicit clicks can use the native theme transition with rejected ready promises handled.

## Layout and shape

Buyer container max 1280px with equal gutters. Orange masthead combines brand, wide white search and cart/account actions; smaller navigation follows the search. On phones search gets its own row. Home begins with a compact shopping entry and categories; merchandise appears in the first desktop viewport. The multi-shop guide follows the catalog rather than occupying the entire opening screen.

Home grid: six desktop tracks where space permits. Catalog grid: five desktop tracks beside filters. Tablet reduces to three/four and phone to two. Track minimums use minmax(0, 1fr); photos are square and contained, names two lines, prices prominent. Long names and currency strings must not cause page overflow. Public product data supplies photos, prices, availability, rating and shop; missing photographs get an explicit neutral state.

Console sidebar is 224px at desktop and an accessible drawer below 1050px. Header is 64px; content max 1440px; page gutters 24px desktop and 12–16px phone. Navigation groups align to the top and do not stretch links to fill the sidebar. Tables scroll inside their own container. Queue actions and filters are grouped above the corresponding list.

Spacing: 4px base; controls/forms 8–16px gaps; panels 16–20px padding; section gaps 16–24px. Control radius 4px and panel radius 6px. Shadows are subtle, used mainly for overlays/auth cards; no colored glow or large decorative radial gradients.

## Shared components and states

Button primary is accessible orange, secondary a bordered surface, danger retains semantic red. Targets remain at least 44px where touch interaction applies. Fields keep visible labels, input/hint/error relationships and instantaneous focus rings. Dialogs retain focus trapping, Escape and focus return. Sidebar, account menus, pagination, filters, selected variants and checkout preserve existing handlers, URL state and test hooks.

Tables retain semantic headers, captions/labels, pagination metadata and row action names. Empty states name a real next action. Loading skeletons reserve the relevant layout. Failures remain distinguishable from empty data, include retry where supported, and keep form content. Mutations disable duplicate submission and only show success after API confirmation.

Order Rail is a functional progress component for actual orders and the retained buying guide, not the visual theme. It maps existing order statuses and never invents progress. Revenue charts and KPIs use API figures; simulated data retains its explicit label.

Auth pages use a restrained warm-tint entry panel and clear white form with existing login/register/recovery links. Buyer account/address/orders and Seller onboarding/settings retain all existing fields and validation.

## CSS ownership

packages/ui-web/src/styles.css is an ordered import entry point:

1. base.css — established component semantics and state layouts.
2. commerce-common.css — shared compact controls, console, auth, functional rail and restrained motion.
3. commerce-storefront.css — shopping masthead, catalog, product and Buyer composition.
4. commerce-seller.css — scoped Seller operational hierarchy.
5. commerce-admin.css — scoped Admin operational hierarchy.

Change the owning file rather than appending another redesign layer. App metadata theme colors and Tailwind font mappings match these tokens. Root layouts import tokens and shared CSS exactly once.

## Motion and accessibility

Linked merchandise can lift 2px and its image can zoom gently within the frame. Buttons have a restrained press state. Page movement never starts content at opacity zero. No scroll-driven hiding of products or giant stagger sequence. Reduced motion disables nonessential movement. Keyboard focus is immediately visible, headings wrap, menus/dialogs remain operable without hover, and html/body clip horizontal page overflow while tables own their local scrolling.

Check text and action contrast, including masthead links in both themes. Do not copy an inaccessible reference color pair to achieve visual similarity. Preserve all permissions and unauthorized redirects.

## Verification

Inventory all 33 route files, including the Seller root membership redirect and Admin shipments redirect. Review shopping/auth/detail/cart/checkout/account/order and console data/form screens at 1440, 1024, 768, 390 and critical 360px layouts. Run unit, typecheck, lint, production build and browser regressions. Browser fixtures are labeled verification data and are not written to the user's database. Record real API versus fixture verification separately.
