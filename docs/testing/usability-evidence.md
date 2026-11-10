# T148 Checkout UI Evidence

## Scoped acceptance

The project owner waived the five-person study for this demo. Codex runs one timed Playwright UI walkthrough with a valid cart containing five selected lines across two shops and a saved address. The UI must reach order detail within 180 seconds (scoped SC-005).

This is automated technical evidence, not a human usability study. It does not establish typical user completion time or verify a complete Tauri/WebView2 checkout.

**Status:** Playwright walkthrough passed; Windows Tauri/WebView2 opened and its visible controls and keyboard focus were checked. A live Tauri checkout remains untested because the local API is unavailable.

## Safety and privacy

- Use a route-mocked fictional API fixture only; the test must not connect to a database, Redis, or remote service.
- Do not record personal names, email addresses, phone numbers, or screenshots containing personal data.
- The automated UI result must not be represented as a real user's experience.
- Do not run reset commands or remove order/inventory history for this test.

## Automated fixture

The test begins at `/cart` with:

- Five selected, purchasable, quantity-one cart lines.
- Four lines under `Demo Shop 01` and one under `Demo Shop 02`.
- Unit price `250000` VND and selected total `1250000` VND.
- One saved fictional default address and COD payment.
- One valid quote and one order detail response containing the same five lines.

No live demo account or local API is needed for this test. The Windows Tauri shell labels/focus check is recorded separately and is not inferred from browser evidence.

## Automated run

- **Command:** `corepack pnpm test:e2e:checkout`
- **Runner:** Codex / Playwright on Windows
- **Viewport checks:** 360×844 and 1280×900
- **Timer:** Starts when `/cart` renders; stops when order detail appears. Next.js startup is excluded.

| Order detail reached? | Duration (ms) | Five lines / two shops | Keyboard and accessible names | Test result |
| --- | ---: | --- | --- | --- |
| Yes | 5,206 | Yes; one order with 4+1 lines | Enter activation and named roles passed; Tauri shell focus is visible | 11/11 checkout E2E passed |

- **Scoped SC-005:** Pass; 5,206ms to order detail, below 180,000ms.
**Evidence limit:** One route-mocked browser run; no human usability or complete Tauri checkout claim.

The run prints a non-failing Node warning that `NO_COLOR` is ignored when `FORCE_COLOR` is set.

## UI, keyboard, and state checklist

| Area | Result | Evidence / observation |
| --- | --- | --- |
| 360px cart: no page-level overflow; all five item controls reachable | Pass | Playwright: five lines, checkbox/quantity/remove names, no horizontal overflow |
| 360px checkout: address, products, payment, and primary actions readable; no horizontal overflow | Pass | Playwright: address, five-line count, payment and checkout controls visible |
| 1280px cart and checkout: no horizontal overflow; summaries/actions visible | Pass | Playwright viewport assertions |
| Keyboard activation of checkout | Pass | Focused checkout link, Enter navigated to checkout |
| Visible focus styling | Pass | In the Windows Tauri/WebView2 window, pressing Tab visibly outlined the “Thử lại khôi phục phiên” button. |
| Accessible names for selection, quantity, remove, address, payment, quote, and confirm | Pass | Playwright role locators and button names |
| Windows Tauri/WebView2 labels and focus | Pass | Launched the actual Tauri dev window at `http://localhost:3000`; the accessibility tree exposed named navigation links, search, cart, error alerts, and retry buttons. Tab produced a visible focus outline on the session-recovery button. |
| Tauri checkout through order detail | Not tested | API on localhost:4000 was not running. The real desktop showed the expected connection/retry error, so no login, order, or persistent test data was created. The full checkout flow is covered by the route-mocked Playwright run above. |
| Loading state | Pass | Delayed cart response shows `aria-busy` and live status |
| Empty cart / no selected lines / no saved address | Pass | Empty cart CTA, disabled checkout button, and missing-address guidance |
| Bootstrap and mutation error, including retry | Pass | Existing bootstrap retry case; cart mutation failure preserves quantity and announces error |
| Invalid quote for stock issue | Pass | Invalid quote announces issue and disables order confirmation |
| Pending quote and order submission | Pass | Deferred responses keep each submit button disabled while pending |
| Expired quote | Pass | Expired quote alert appears and order confirmation is disabled |
| Successful order and order detail navigation | Pass | Five-line walkthrough reaches order detail with both shop groups and all five items |
| Unauthorized session / login return path | Pass | Existing checkout bootstrap E2E redirects rejected session to login |

## Findings and follow-up

### Finding: checkout CTA with no selected lines

- **Expected:** With selected total `0`, checkout cannot be opened from the cart using keyboard or pointer.
- **Observed before fix:** The CTA remained an anchor with `href="/checkout"`; `aria-disabled` and `pointer-events:none` did not prevent keyboard activation.
- **Fix:** Render a native disabled button when selected total is zero; keep the link for a positive total.
- **Regression evidence:** The new zero-selection test failed before the fix because no disabled button existed, then passed after the fix.

No other blocker appeared in the automated browser checks. Windows Tauri/WebView2 labels and visible keyboard focus were verified on the home screen. A live desktop checkout remains unverified because the API was unavailable; the observed connection alert exposed a named retry action.
