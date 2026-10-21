# Test plan và acceptance matrix

**Trạng thái:** Kế hoạch, chưa chạy test ứng dụng. FR/SC gốc tại [spec](../../specs/001-marketplace-mvp/spec.md); negative data tại [fixture design](fixture-design.md). Mỗi test ghi expected và observed riêng; chỉ observed thực có log/evidence mới được đánh PASS.

## Phân lớp kiểm thử

| Lớp | Bao phủ | Môi trường/evidence |
| --- | --- | --- |
| Contract | OpenAPI schema, DTO validation, auth/errors/examples, generated clients | Schema validation + consumer examples; 400/401/403/404/409/422; drift reviewed. |
| Unit | Money decimal, policies/ownership, state transition, aggregate totals, DTO validation | Không thay DB constraints bằng mock; branch tests deterministic. |
| Integration | PostgreSQL FK/unique/check/partial indexes, transaction, locks, migrations, session, idempotency | PostgreSQL disposable; fresh/upgrade; barriers/fault injection; không mock DB cho integrity. |
| E2E | Guest→Buyer→shops→catalog→multi-shop checkout→payment→delivery/review | Real API + PostgreSQL; fixture isolated; no manual DB mutation. |
| Security | Buyer IDOR, seller cross-shop, role spoof, locked session, price/state spoof, CSRF, upload, logs | Requests as each role; assert no read/write side effect and redaction. |
| Concurrency | Last stock, duplicate checkout/payment/cancel/refund, expiry/callback/order races | Real PostgreSQL; 20 parallel requests/stock 5; replay 10; persist rows/totals. |
| UI/usability | L/E/X/S/unauthorized, keyboard, 360/1280, five-line/two-shop checkout | Browser/device observations and screen captures when appropriate; 5 participants for SC-005. |
| Performance | Product list/search demo fixture | 1,000 products / 10 shops / 20 concurrent users / 100 observations; record host/network and each latency. |
| Native/recovery | Buyer Android/iOS; Seller Windows/macOS; reload, restart, restore | Record per OS/device, app/API SHA, tool versions, exact flow; restore database copy isolated. |

## Functional coverage index

Mỗi range là mã FR đầy đủ, không phải sampling. Scenario IDs phân rã thành test cases cụ thể khi viết contract/integration/E2E task.

| Requirement | Test scenarios | Positive check | Negative/security check |
| --- | --- | --- | --- |
| FR-01–06 | ID-01–08 | Register, login, profile, address/default, password change/logout | Duplicate normalized email, invalid credentials, CSRF, session reuse, wrong owner/shop scope |
| FR-07–10, FR-48 | SHOP-01–08 | Pending registration, approve/reject/resubmit, shop settings, active state | Duplicate slug, decision wrong status, unauthorized admin, suspended purchase denied |
| FR-11–15, FR-49 | CAT-01–10 | Category tree, product CRUD, variant, image, publish/stop/hide | Cycle, invalid asset, duplicate SKU, cross-shop write, admin-hidden bypass, snapshot mutation |
| FR-16–20 | DISC-01–07 | Detail/list/search/filter/sort/public shop | Hidden/inactive data leak, invalid range, pagination instability, private fields exposed |
| FR-21–24 | CART-01–08 | Add/update/delete/select/group and quote validation | Wrong buyer cart, invalid quantity, stale price/category/shop/variant, unselected line mutation |
| FR-25–28 | CHECK-01–12 | Quote/confirm, split two shops, snapshot, stock decrement/restore | Price spoof, foreign address, stock race, partial commit, duplicate restore |
| FR-29–32, FR-44, FR-50 | ORDER-01–12 | Buyer/Seller/Admin permitted views, order state and transitions | Cross-buyer/cross-shop IDOR, illegal transition, aggregate mismatch, Admin arbitrary patch |
| FR-33–36 | PAY-01–14 | COD collect, mock success/fail/cancel/retry/expiry | Duplicate callback, wrong amount/order, late success, success-vs-cancel race, refund duplicate |
| FR-37–39 | SHIP-01–08 | Shipment creation/events, pickup/transit/delivered/fail/retry | Illegal order, duplicate shipment, unauthorized tracker, early stock return |
| FR-40–42 | REV-01–05 | Review completed own item, public read | Wrong buyer, incomplete order, rating bounds, duplicate item review |
| FR-43–46 | STAT-01–08 | Seller/system counts, day/month revenue and marketplace totals | Cross-shop leakage, cancelled/unpaid included, aggregate/parts double count, timezone edge |
| FR-47 | ADMIN-01–05 | Account search/lock/unlock with audit | Non-admin denial, missing reason, lock session still accepted, sensitive field leakage |
| FR-01–50 platform presentation | UI-01–06 | All mapped screens handle L/E/X/S and saved data reload | Unauthorized state, stale cache after user/shop switch, keyboard/native accessibility gaps |

Specific test IDs preserve one-to-one traceability for each functional requirement:

| FR | Test IDs |
| --- | --- |
| FR-01 | ID-01 register valid; ID-02 duplicate normalized email |
| FR-02 | ID-03 login success; ID-04 invalid credentials/rate limit |
| FR-03 | ID-05 logout revokes session and refresh |
| FR-04 | ID-06 profile/avatar/password owner and validation |
| FR-05 | ID-07 address CRUD/default; concurrent default race |
| FR-06 | SEC-01 role and resource-scope authorization |
| FR-07 | SHOP-01 create pending shop and owner membership |
| FR-08 | SHOP-02 queue/approve/reject reason and visibility |
| FR-09 | SHOP-03 authorized profile/assets and public projection |
| FR-10 | SHOP-04 suspend blocks new purchase, existing order policy |
| FR-11 | CAT-01 parent/child CRUD; CAT-02 self/descendant cycle reject |
| FR-12 | CAT-03 create product in authorized shop with valid asset/category |
| FR-13 | CAT-04 variant SKU/attributes/price/stock uniqueness |
| FR-14 | CAT-05 edit catalog and prove order snapshot unchanged |
| FR-15 | CAT-06 seller stop/admin hide; public list and checkout denied |
| FR-16 | DISC-01 detail projection, variant price/availability/review |
| FR-17 | DISC-02 eligible product listing and pagination |
| FR-18 | DISC-03 guest/buyer query terms and category search |
| FR-19 | DISC-04 price/category filters and three sort orders |
| FR-20 | DISC-05 active public shop and private fields excluded |
| FR-21 | CART-01 add valid variant and quantity |
| FR-22 | CART-02 update/delete/select exact cart lines |
| FR-23 | CART-03 group item lines by owning shop |
| FR-24 | CART-04 revalidate active state/current price/current stock |
| FR-25 | CHECK-01 quote and confirm using owned address/payment method |
| FR-26 | CHECK-02 one parent order/two seller orders; scoped seller reads |
| FR-27 | CHECK-03 snapshot name/SKU/attributes/price/quantity/image |
| FR-28 | CHECK-04 last-stock, rollback, one-time return movements |
| FR-29 | ORDER-01 buyer history/detail/payment/shipment ownership |
| FR-30 | ORDER-02 seller confirm/pack/fulfill own seller order |
| FR-31 | ORDER-03 buyer/seller cancellation permission/state table |
| FR-32 | ORDER-04 allowed transition and aggregate derivation |
| FR-33 | PAY-01 COD collection per delivered seller order once |
| FR-34 | PAY-02 mock success/failure/cancel has no real-money path |
| FR-35 | PAY-03 provider event and payment attempt uniqueness/replay |
| FR-36 | PAY-04 retry, expiry, late compensation and inventory consistency |
| FR-37 | SHIP-01 exactly one shipment per eligible seller order |
| FR-38 | SHIP-02 allowed shipment events, failures and retries |
| FR-39 | SHIP-03 buyer/seller scoped tracking and order-state consistency |
| FR-40 | REV-01 eligible buyer creates valid 1–5 review |
| FR-41 | REV-02 public product review list projection |
| FR-42 | REV-03 unique review per order item under concurrency |
| FR-43 | STAT-01 shop dashboard counts and shop-key isolation |
| FR-44 | ORDER-05 seller status filter and order detail scope |
| FR-45 | STAT-02 seller day/month revenue aggregation and timezone |
| FR-46 | STAT-03 marketplace totals and no parent/part double count |
| FR-47 | ADMIN-01 search/lock/unlock, reason, session revoke/audit |
| FR-48 | SHOP-05 duplicate/stale approval decision conflict |
| FR-49 | CAT-07 moderation hide reason; seller cannot unhide |
| FR-50 | ORDER-06 admin inquiry/history, guarded recovery actions |

## Success criteria coverage

| SC | Evidence to collect | Expected threshold |
| --- | --- | --- |
| SC-001 | Redacted end-to-end records/screens: guest, account, shop approval, publish, 2-shop order, mock payment, delivery, review | Entire demo via supported UI/API; no manual transaction edits |
| SC-002 | FR acceptance matrix and release defect report | All 50 FR accepted; no open correctness/security blocker in rights, price, stock or history |
| SC-003 | Barrier concurrency log + DB before/after + movement rows | 20 requests, stock 5: 5 commits, 15 out-of-stock, final stock 0 |
| SC-004 | Same-key replay results for checkout/payment/cancel and row/totals diff | 10 requests per operation, one business effect; exact amount/order/stock match |
| SC-005 | Five independent timed usability runs with 5 valid lines/2 shops/address ready | At least 4 of 5 complete within 3 minutes without guidance |
| SC-006 | 100 raw search/list latencies, fixture and host/network description | At least 95 results <=2s under 20 concurrent users, 1,000 products/10 shops |
| SC-007 | Role-based read/write attack matrix and persisted-state diff | All wrong-owner/shop/admin requests denied; zero unauthorized data or mutation |
| SC-008 | Reproducible known-ledger fixture and day/month/system reports | Exact match for complete/cancel/unpaid/refunded values; no order double count |
| SC-009 | Per target OS/device record, flows and cross-client reload evidence | Buyer Web/Android/iOS and Seller Web/Windows/macOS flows succeed and data persists across clients |
| SC-010 | Clean clone setup timed from prerequisites ready | New member completes demo <=30 minutes without undocumented setup or data edits |

## Required race/failure cases

Use fixtures in `fixture-design.md`. Run 20 concurrent checkout calls against quantity 5; run idempotent checkout/payment/cancel 10 times; interleave cancellation and payment success in both commit orders; process expiry at/after the fixed 15-minute deadline; inject failure before transaction commit and after network response loss; retry shipment after FAILED; restart scheduler and recheck overdue orders. Verify PostgreSQL rows, final availability, movements, allocations, refunds, audit and response replay, not only HTTP status.

## Platform evidence matrix

| Platform | Minimum flow evidence | Sensitive data check |
| --- | --- | --- |
| Buyer Web | Register/login → search/detail → cart → multi-shop checkout → order/pay/delivery/review | Cookie flags, CSRF, no refresh token in JS storage/logs |
| Android | Login → token refresh → product list; later search/cart/checkout/order/review | Refresh only SecureStore, access in memory, no plaintext on disk/log |
| iOS | Same Buyer flow on simulator or device, plus reload/session restore | Same secure storage review and OS/tool version record |
| Seller Web | Create/manage shop/product/stock/order/stats/review | Cross-shop requests denied by server |
| Windows Desktop | Seller flow in packaged Tauri WebView | Stronghold user unlock, CSP/permissions, no unrestricted shell |
| macOS Desktop | Seller flow in target macOS build | Vault/session/logout and shop scope; record Mac/Xcode version |

## Reporting template

For each case record: test ID and FR/SC, code SHA, environment/OS/device, fixture version, command or user action, expected, observed, exit/result, sanitized log/artifact link, defect and reviewer. Missing Mac/device/bucket records BLOCKED with owner/date; never convert missing evidence into PASS.
