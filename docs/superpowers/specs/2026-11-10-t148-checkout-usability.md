# T148 Checkout Usability Design

## Intent

Run one Playwright UI walkthrough of the existing multi-shop checkout, then remove only core UX friction demonstrated by that run or the manual review. This is technical demo acceptance for the storefront, not human usability research.

## Goals

- Run one timed Playwright UI walkthrough with a valid cart containing five selected lines from two shops and a saved address.
- Meet the scoped SC-005 demo criterion: the UI reaches order detail within three minutes.
- Check the flow at 360px and 1280px and by keyboard in Playwright; inspect named controls and visible keyboard focus in the actual Windows Tauri shell. Cover applicable loading, empty, error, success, and unauthorized states with the route-mocked Playwright fixture.
- Record anonymized observations and exact outcomes in `docs/testing/usability-evidence.md`.
- Make only small, evidence-backed fixes to the core flow after the baseline sessions.

## Non-goals

- No new checkout behavior, payment provider, public deployment, installer, or additional desktop target.
- No fabricated or simulated user results.
- No collection of personal details or recordings.
- No claim that the automated walkthrough represents a broader user population or verifies a complete Tauri checkout.
- No implementation changes before the baseline UI run, unless the local demo cannot be run safely.

## Constraints

- Buyer desktop is the existing Tauri wrapper around the storefront and local API, supported for this demo on Windows.
- The automated run begins with a prepared, valid cart and saved address; account creation and fixture setup are outside the timed interval.
- Use a fictional, route-mocked API fixture. Never access or seed a shared database for the automated run.
- Record elapsed time, errors, and observed friction; identify all results as automated evidence.
- Keep product, shop, quantity, address, payment method, and starting route fixed for the walkthrough.

## Approaches

1. **Exercise the real storefront with Playwright (chosen).** Keep the Next.js UI real, mock only its remote API, measure the five-line flow, then fix only blockers visible in the run or manual review. This avoids needing shared services and avoids speculative redesign.
2. **Rely on code review only.** This is faster but cannot verify that the actual cart and checkout components render and complete the scenario.
3. **Test only the Tauri shell.** The local API and desktop window are currently unavailable, so this would block progress without testing the UI behavior.

## Design

Use a complete, non-persistent API fixture for the five-line cart and saved address. Start at `/cart`, exercise checkout with Playwright keyboard and pointer actions, start the timer when the cart is visible, and stop when the order detail page appears. Record the run as automated evidence. Record the Tauri runtime status separately; do not infer it from browser evidence.

Record the automated outcome, elapsed time, visible errors, and observed friction. After the walkthrough, map any high-impact friction to a minimal change and a focused regression check. If checkout needs a material design change, create a short follow-up plan from that evidence before changing code.

The Playwright run checks the cart and checkout at 360px and 1280px, accessible names, keyboard activation, and applicable route-mocked states. Separately launch the actual Windows Tauri wrapper to inspect shell labels and visible focus; record that a live checkout is not tested if the API is unavailable. Automated results are not human usability evidence.

## Owner setup checks

- Confirm the route fixture uses only fictional data and does not contact a shared database.
- Run the Tauri Windows check only when the local shell and required services are available; do not imply it passed from browser-only evidence.
