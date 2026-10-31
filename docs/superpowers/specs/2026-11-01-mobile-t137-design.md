# T137 Buyer commerce mobile — design

## Intent

Implement the Buyer purchase lifecycle screens B07–B10 in the existing Expo app: cart, quote and checkout, order history, and order detail with payment, shipment, cancellation, and receive actions. The goal is to replace the current T137 placeholders with contract-driven screens that recover from network errors and app foregrounding without duplicating writes.

## Current state

- The `(buyer)` route group is already guarded by the existing `SessionProvider` and Expo Router layout. `cart.tsx`, `checkout.tsx`, and `orders/index.tsx` are placeholders; there is no Buyer order-detail route yet.
- `@tanstack/react-query` 5.104.5 and a memory-only `mobileQueryClient` already exist. It retries network/5xx queries only, does not retry mutations, cancels old queries on logout, and resumes focus after the session check. T134 is still open pending Android resume evidence; this work may be implemented, but T137 must remain unchecked while that dependency is open.
- `useSession()` exposes the existing `ExpoSession.api`. `ApiPath` and generated OpenAPI `components` are available from `@marketplace/api-client`; the mobile feature will use those types rather than handwritten response DTOs.
- The API contract and B07–B10 screen flows define account-scoped cart data, server quotes, one all-or-none checkout, aggregate order summaries, per-seller-order states, payments, shipment tracking, cancellation, and receive.
- COD collection is a seller/admin action. Buyer Mobile displays COD as unpaid until the server reports collection; it does not call the COD collection endpoint.
- The checkout implementation and integration test return `409 PRICE_CHANGED` without a replacement quote. The project owner previously directed the sequence to show only that 409 and require an explicit new quote action; Mobile will follow that decision.

## Goals

- Replace the B07–B10 placeholders with Buyer-facing native screens backed by the existing API client.
- Keep cart, order list, order detail, and payment queries scoped by the current `user.id`; consume React Query `AbortSignal`s and refetch after app foregrounding through the existing T134 focus/resume integration.
- Treat server DTOs as authoritative for amounts, totals, statuses, deadlines, address snapshots, refunds, and allowed actions.
- Preserve the same in-memory idempotency key and request body for a retry of the same write while the JavaScript process is alive. On app process restart, perform fresh reads and reconcile server state before exposing any action; never blindly replay a write.
- Give the user loading, empty, error/retry, forbidden, quote-expiry, conflict, and success feedback where applicable.
- Add executable component and helper tests for the new flows; update the T137 TODOs only where implemented behavior is covered.

## Non-goals

- Do not implement Seller/Admin COD collection or shipment commands.
- Do not change backend, contracts, OpenAPI, migrations, React Native/Expo versions, query-cache policy, or auth/session behavior.
- Do not persist query data or write-intent keys. Do not add AsyncStorage, MMKV, a query persister, or SecureStore use beyond the existing refresh-token adapter.
- Do not implement B13 reviews, Desktop, iOS, or device/emulator acceptance. Those remain outside this work or under later tasks.
- Do not use a replacement quote from `PRICE_CHANGED`; the API currently returns only the conflict code.

## Approaches considered

1. **One React Query vertical slice with RAM-only write intents — selected.** Build B07–B10 using the existing QueryClient, generated schemas, route guard, and a small in-memory intent module. This keeps data refresh and cache invalidation consistent, adds no dependency or persistence, and follows the owner's choice. A killed process loses a pending key; a cold start refetches and reconciles authoritative state instead of replaying.
2. **Per-screen `useEffect`/local-state API calls.** This could imitate the older Web implementation, but repeats loading/error/refetch and idempotency handling and would bypass the existing focus refetch behavior. It is not selected.
3. **Persist pending write intents for cold-start replay.** This could restore the exact key and payload after process death, but requires storage outside the approved RAM-only choice and conflicts with the existing no-persistence T134 policy. It is not selected.

## Proposed design

### Query and mutation modules

- Add a focused `features/commerce` module for typed query keys, server reads, and mutation intent handling. Keep route files as thin Expo Router entries and put screen composition in focused Cart, Checkout, Order List, and Order Detail screens.
- Query keys include `user.id` and the relevant route/filter identifiers. Query functions pass the React Query signal to `session.api.request`. Cart writes invalidate the buyer cart; checkout invalidates cart and orders; order actions invalidate the exact order, order list, and payment history as needed.
- Read `Cart`, `Address`, `CheckoutQuote`, `OrderSummary`, `Order`, `SellerOrder`, `Payment`, and `Shipment` from generated `components["schemas"]`. Keep URL paths typed as `ApiPath`.

### In-memory write intents

- Provide one small module-scoped store, keyed by buyer, HTTP method, canonical route, and logical action. Its record contains a generated UUID idempotency key, a canonical request-body fingerprint, and a stable `eventId` when a payment-result event needs one.
- A repeat with the same scope and body reuses the same key and event ID. A changed body or expected version starts a new intent. Network/timeout errors retain the intent for an explicit retry; a successful server response clears it. Queries are never persisted.
- On app foreground, rely on the existing session check to finish before React Query refetches. After a cold process start, load current cart/order/payment state first and derive available actions from those server responses. Do not automatically replay a prior write or assert that a lost in-memory key is recoverable.

### Buyer flow

- **B07 Cart:** fetch `/cart`; render per-shop groups and selected totals; update quantity/selection with `PATCH /cart/items/{id}` and remove with `DELETE`; handle unavailable lines and empty-cart browsing.
- **B08 Checkout:** load owned addresses and selected cart lines; request `/checkout/quotes` with only selected cart item IDs, address ID, and `COD|MOCK`; display server totals, issues, shipping, and `expiresAt`. Any changed input discards the displayed quote. Confirm only a valid, unexpired quote using `/checkout` plus a same-intent idempotency key. `PRICE_CHANGED`/`QUOTE_EXPIRED` show a conflict and an explicit action to request and review a fresh quote; there is no automatic price acceptance.
- **B09 Order list:** fetch `/orders` with server-supported status/payment/date/page filters. Show aggregate order status, partial-cancellation indicator, amount still due, and payment status; paginate by server results.
- **B10 Order detail:** fetch `/orders/{id}` and `/payments?orderId=...`; display parent totals and each SellerOrder snapshot/tracking timeline. For MOCK, create an attempt and submit a result using the order version, event ID, and idempotency key; show retry only when the server state allows it. For COD, display the server's unpaid/collected state. Offer whole-order cancel only when all live parts are eligible, partial cancel for eligible PENDING parts, and receive only for DELIVERED and paid/collected parts. Show blocking seller parts from the 409 error details and refetch before enabling a new action.

### Error and lifecycle rules

- Keep the existing query retry policy and mutation `retry: false`; retry is an explicit user action.
- A transient mutation failure keeps its current in-memory intent and key. A 409/version conflict triggers an authoritative refetch and a fresh user decision; do not replay a different body with the old key.
- Logout/account change behavior remains owned by `SessionProvider`: cancel old queries, clear cache, and use user-scoped query keys so prior account data cannot appear for the next Buyer.
- No device/emulator run is planned in this task. Automated component tests and workspace checks are software evidence only, not Android acceptance.

## Test plan outline

- Unit-test the intent store: same scope/body reuses IDs; changed body/scope gets new IDs; failures retain the intent; success clears it; account scopes do not share keys.
- Add mobile component journeys for B07–B10 using generated DTO fixtures and an API mock: grouped/empty cart and updates; server quote/invalid lines/expiry/explicit refresh; idempotent checkout retry and navigation; order filters/pagination; order detail/payment history/tracking; mock retry; COD display; whole/partial cancellation with blocker feedback; receive guard; focus refetch and cold-start reconciliation.
- Remove only the four T137 B07–B10 TODO entries that the tests now cover. Keep B13 TODO. Run the Mobile Jest suite plus workspace lint/typecheck/test/build. Do not run Android/iOS device verification.

## Constraints and status

- Base: latest `origin/main` at `7ec9867797e595736e9b4cc92e6b46cd34ac1df7` after PR #31 merged.
- Target branch: `codex/mobile-t137`.
- No new dependency is planned.
- T134 is an open dependency. T137 code/evidence may be reviewed, but its checkbox remains open until T134 closes. No iOS or Desktop work will be done.

## Reviewer focus

- Ensure quote and amount values always come from the server and all-or-none checkout is preserved.
- Verify same-intent key/body reuse on transient retries, and that cold start refetches before any action rather than blindly replaying.
- Check all cancellation, mock-result, and receive actions use the correct parent or seller-order `expectedVersion`, ID, and idempotency scope.
- Ensure COD display does not imply the Buyer collected payment; check query scope and invalidation across accounts.
