# T148 Checkout UI Walkthrough Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to carry out the walkthrough and evidence-backed UX changes task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the current five-line, two-shop checkout through the real storefront UI and collect technical evidence for minimal core UX fixes.

**Architecture:** Keep the Next.js storefront components real and mock only the external API boundary with a complete, fictional fixture. Exercise the cart and checkout in Playwright, record browser results separately from Tauri runtime checks, and fix only blockers confirmed by the run or manual review.

**Tech Stack:** Next.js 16 storefront, Playwright 1.64.1, route-mocked API fixture; Windows Tauri runtime is checked separately when available.

**Spec:** `docs/superpowers/specs/2026-11-10-t148-checkout-usability.md`; acceptance source: `specs/001-marketplace-mvp/spec.md` scoped SC-005 and `specs/001-marketplace-mvp/tasks.md` T148.

## Global Constraints

- Scoped SC-005 uses five selected lines across two shops and one saved address; Playwright must reach order detail within three minutes.
- This automated UI result is technical demo evidence only; it is not a human usability study and does not verify a complete Tauri checkout. Record the actual Windows shell labels/focus separately.
- Review 360px and 1280px layouts, keyboard activation, accessible names, and applicable loading, empty, error, success, and unauthorized states.
- Fix core UX only; do not add a feature.
- The desktop buyer is a Windows local demo; a public URL, production HTTPS, and installer are outside acceptance.
- Use fictional route fixtures only; do not contact or seed a shared database.

## Review Focus

- Five selected lines across two shops: the cart and checkout must retain all lines and the correct total; assert five rendered rows, two shop groups, five quote IDs, and one order.
- No selected lines: the user must not be silently sent into a valid-looking checkout; exercise zero selection and keyboard activation if applicable.
- Stale price or stock: the UI must show the invalid quote and its recovery path without implying order creation; use the existing issue response path if covered.
- Bootstrap error or unauthorized session: the page must show retry or login return behavior without losing the checkout route; use existing checkout bootstrap coverage.
- Narrow viewport and keyboard: primary controls remain reachable/named at 360px and 1280px; assert no page overflow and keyboard activation of checkout.

---

### Task 1: Add a dedicated five-line walkthrough fixture

**Files:**
- Create: `tests/e2e/t148-checkout-walkthrough.spec.ts`
- Modify: `playwright.checkout.config.ts`

**Interfaces:**
- Consumes: Existing storefront UI and a route-mocked authenticated session, cart, address, quote, and order response.
- Produces: One complete scenario with four selected quantity-one lines under Demo Shop 01 and one under Demo Shop 02.

- [x] **Step 1: Define literal item and shop fixtures**

  Use five distinct item, product, and variant IDs; quantity one; selected and purchasable true; unit price `250000`. Group four items under Demo Shop 01 and one under Demo Shop 02. Use total `1250000`.

- [x] **Step 2: Make the quote and order responses match all five lines**

  Return five quote lines. Return one order with two seller orders: four items totaling `1000000` for Demo Shop 01 and one item totaling `250000` for Demo Shop 02.

- [x] **Step 3: Assert observable cart and request behavior**

  Assert five cart rows, two shop groups, five named selection/quantity controls, all five selected IDs in the quote request, one idempotency-keyed checkout, and the resulting order detail page.

### Task 2: Exercise responsive and keyboard behavior and record timing

**Files:**
- Modify: `tests/e2e/t148-checkout-walkthrough.spec.ts`
- Modify: `docs/testing/usability-evidence.md`

**Interfaces:**
- Consumes: The five-line fixture and existing role-based cart/checkout controls.
- Produces: A timed Playwright UI run, viewport/overflow observations, and accessible-name evidence.

- [x] **Step 1: Check the cart at 360px**

  Set the viewport to 360×844; assert the page has no horizontal overflow, all five product links render, and the checkout link is visible.

- [x] **Step 2: Activate checkout with the keyboard**

  Focus the checkout link and press Enter. Verify the checkout page, selected-line count, address field, payment control, quote action, and order confirmation controls by accessible role/name.

- [x] **Step 3: Check the checkout at 1280px and time the flow**

  Set the viewport to 1280×900 before requesting a quote. Start timing when the cart first renders, stop at order detail, and record the exact duration. Expected: order detail within 180,000ms.

### Task 3: Run checkout regressions and distinguish the evidence

**Files:**
- Modify: `docs/testing/usability-evidence.md`
- Inspect: `tests/e2e/storefront-checkout-bootstrap.spec.ts`

**Interfaces:**
- Consumes: Focused Playwright checkout configuration and current checkout error/unauthorized scenarios.
- Produces: Test output, scoped SC-005 result, and an explicit pending/observed status for Tauri and UI states not exercised.

- [x] **Step 1: Run the checkout Playwright suite**

  Run: `corepack pnpm test:e2e:checkout`

  Expected: all selected checkout E2E cases pass, including the five-line two-shop walkthrough. Record the exact count and runtime from output.

- [x] **Step 2: Record the Tauri runtime separately**

  Launched the actual Windows Tauri dev window against the local storefront. Verified named navigation/search/cart controls in the WebView2 accessibility tree and a visible keyboard focus outline on the session-recovery button. The API is unavailable, so the desktop checkout itself remains untested; do not infer it from browser evidence.

- [x] **Step 3: Record UI states by evidence source**

  Mark each loading, empty, error, success, expired-quote, and unauthorized state as covered by a named E2E test, manually inspected, or still pending. Do not infer untested states.

### Task 4: Make the demonstrated core UX fix

**Files:**
- Modify: `apps/storefront/src/app/cart/page.tsx`
- Modify: `tests/e2e/t148-checkout-walkthrough.spec.ts`
- Modify: `docs/testing/usability-evidence.md`

**Interfaces:**
- Consumes: Completed test output, viewport and keyboard observations, and any state-path defects.
- Produces: A test-backed disabled cart CTA when selected total is zero; broader design changes still require a focused plan.

- [x] **Step 1: Rank confirmed findings by task impact**

  For each issue, record route/control, expected behavior, observed behavior, evidence type, and whether it blocks completion.

- [x] **Step 2: Fix only the narrow behavior covered by the failing regression test**

  Keep the CTA as a link when a cart line is selected; render a native disabled button when selected total is zero. Do not add features or redesign unaffected screens.

## Execution Handoff

The Playwright checkout suite passed 11/11; the latest five-line walkthrough reached order detail in 5,206ms. The run found and fixed the zero-selection cart CTA. The Windows Tauri/WebView2 window opened and its home-screen labels and keyboard focus were checked. The API on localhost:4000 was unavailable, so a real Tauri checkout was not attempted and no persistent demo data was created.
