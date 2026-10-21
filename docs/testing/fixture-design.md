# Test fixtures và expected totals

Fixtures là dữ liệu disposable dùng trong PostgreSQL test namespace riêng. Chúng mô tả expected results; chưa seed hoặc chạy trên DB nào. Không dùng user/token thật, không reset database chia sẻ.

## Danh tính và shop

| Alias | Vai trò/trạng thái | Mục đích |
| --- | --- | --- |
| U-ADMIN | ADMIN / ACTIVE | Shop approval, moderation, user actions, aggregate inquiry. |
| U-A | BUYER / ACTIVE; OWNER shop A | Mua hàng và seller ownership A. |
| U-B | BUYER / ACTIVE; OWNER shop B | Mua hàng và seller ownership B. |
| U-GUEST | Không có session | Public browse và protected endpoint denial. |
| U-LOCKED | BUYER / LOCKED | Session/account access rejection. |
| U-MANAGER-A | BUYER + MANAGER shop A | Membership scope tests, no owner-only action if policy requires OWNER. |
| U-OTHER | BUYER / ACTIVE, không membership | IDOR/cross-shop denial. |

Shop A/B đều ACTIVE, có category chung VISIBLE, product/variant ACTIVE, asset VERIFIED. Negative twins: shop PENDING, REJECTED, SUSPENDED; hidden category/ancestor; `admin_hidden=true`, DISCONTINUED product/variant; asset pending/rejected, foreign uploader/shop. Seller B không được quản lý dữ liệu A dù đổi shopId trong URL/body.

## Known-price multi-shop order (V05)

Buyer `U-A` có địa chỉ `ADDR-A` sẵn có và chọn năm dòng từ hai shop. Mỗi item tồn đủ; shipping 0; không discount/tax/currency conversion.

| Dòng | Shop | Variant | Đơn giá VND | Qty | Thành tiền |
| --- | --- | --- | ---: | ---: | ---: |
| L1 | A | A-RED | 120000 | 2 | 240000 |
| L2 | A | A-BLUE | 80000 | 1 | 80000 |
| L3 | B | B-SMALL | 250000 | 1 | 250000 |
| L4 | B | B-LARGE | 75000 | 2 | 150000 |
| L5 | B | B-ACCESSORY | 90000 | 1 | 90000 |
| **Tổng** |  |  |  | **7 units / 5 lines** | **810000** |

Expected: one MarketplaceOrder 810000; SellerOrder A=320000, SellerOrder B=490000; snapshots store confirmed values; all five selected cart lines removed in same commit; unselected cart line remains. COD starts unpaid. For MOCK successful prepayment, captured=810000. Cancel B while eligible restores B quantities once, refunds 490000 once, leaves A part amount 320000. If cancellation is before settlement, no refund row is created. A COD order cancelled before collection restores stock but has zero collected/refund.

## Stock concurrency fixture (SC-003)

Variant `RACE-01`: available quantity 5, price 10000 VND; 20 independent Buyer requests each try to buy one using distinct valid keys. A single barrier releases all requests against PostgreSQL. Expected exactly 5 committed orders/items, 15 explicit out-of-stock conflicts, final available quantity 0, five SALE movements of -1, movement sum -5, no cart/order partial writes on failed requests. Repeat after reset only in disposable test DB to establish repeatability.

## Idempotency fixture (SC-004)

For checkout, payment result and cancellation, send 10 identical payloads concurrently and sequentially with the same actor/operation/key. Expected one resource/effect and stable replay response/resource ID; order/amount/stock/movement/refund counts are unchanged by retries. Reuse same key with a different canonical payload → conflict and no mutation. Use a different key for a different intentional operation and verify state rules decide it independently.

## Negative fixture families

| Family | Invalid input/state | Expected outcome |
| --- | --- | --- |
| Identity | Duplicate normalized email, malformed email, weak/out-of-range password, revoked/reused refresh, locked user | Validation/conflict/auth denial; no duplicate user/session or continued access |
| Ownership | Foreign address/avatar/cart/order/review or Seller B product/order from A | 403/404 by resource-disclosure policy; no data mutation |
| Shop/catalog | Pending/suspended shop, hidden ancestor, admin-hidden/discontinued product, foreign/unverified asset, duplicate SKU/variant attrs | Publish/list/checkout denied or hidden; no orphan or cross-shop association |
| Cart/checkout | Quantity <=0, unselected line, foreign address, expired quote, changed price, unavailable stock, malformed key | Validation/conflict; entire checkout rolls back and cart remains consistent |
| Payment/cancel | Duplicate callback/event, same key changed payload, callback after cancellation/deadline, cancel after disallowed state | One normal settlement or compensation; no duplicate collection/refund/restore; no reopen |
| Shipping/review | Illegal transition, duplicate shipment/event, collect COD before delivered, review before complete/second review | Conflict; no state/ledger change |
| Admin/report | Non-admin calls admin route, action missing reason, conflicting version, mixed aggregate/part fixture | Denied or 409; audit for valid changes; exact totals/no double count |
| Upload/security | Spoofed MIME, oversized file (>5 MiB), invalid signature, CSRF, untrusted origin, token-like log metadata | Reject/redact; no public Asset or secret exposure |

## Finance/reporting fixture

Use small deterministic orders with known parts: completed paid A=320000; completed COD collected B=490000; fully cancelled uncollected C=200000; partially cancelled order D with active completed 100000 and cancelled/refunded 50000; unpaid active E=125000. Seller A sees only its own SellerOrders. Marketplace report must count each SellerOrder once for seller-level revenue, one MarketplaceOrder once for order count, distinguish gross collected/refunded/net/outstanding/cancelled, and label mock revenue as simulated. Exact date buckets use Asia/Saigon including an event near 00:00 boundary. Data-model’s paid/refund definitions govern totals; this fixture must be reconciled to its final aggregation queries before implementation.
