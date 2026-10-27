# Marketplace REST contract v1

Status: hợp đồng API chuẩn; runtime được hiện thực hóa theo từng module. Nguồn nghiệp vụ:
`../spec.md` FR-01–50, BR-01–10; dữ liệu: `../data-model.md`.

## Quy ước dùng chung

- Base path `/api/v1`; TLS ở môi trường chia sẻ. JSON UTF-8; UUID cho mọi ID,
  thời gian RFC3339 UTC; báo cáo quy đổi `Asia/Saigon`.
- Money là chuỗi số nguyên VND (`"150000"`), không dùng JSON float; giá > 0;
  tổng/phí/hoàn >= 0. `currency: "VND"`; phí giao = `"0"`.
- Order/SellerOrder status enum `PENDING|CONFIRMED|PACKING|SHIPPING|DELIVERED|COMPLETED|CANCELLED`;
  paymentStatus enum `UNPAID|PARTIALLY_PAID|PAID|PARTIALLY_REFUNDED|REFUNDED`.
  Entity DTO nhận `expectedVersion` trong action phải trả `version` integer>=0
  ở management projection (gồm User, Product, Payment ngoài những DTO đã ghi rõ).
- Thành công `{data: DTO, meta?: {requestId, page, pageSize, total}}`;
  danh sách `data: DTO[]`. Mặc định GET/PATCH/action 200; tạo mới 201;
  DELETE 204 không body. Status ghi rõ tại bảng endpoint được ưu tiên (register trả201
  Tokens; logout/password-change trả204; cart-add có thể merge vẫn trả201 theo contract).
- Lỗi `{error:{code,message,details?:[{field,code,message}],requestId}}`.
  400 sai cấu trúc; 401 thiếu/hết phiên; 403 thiếu quyền/tài khoản khóa;
  404 không tồn tại hoặc không có quyền đọc tài nguyên riêng; 409 xung đột trạng thái,
  unique/version/idempotency; 422 vi phạm nghiệp vụ; 413 ảnh quá lớn; 415 sai ảnh;
  429 giới hạn tần suất. Không có stack/passwordHash/token trong DTO tài nguyên.
- Unknown fields bị từ chối; các trường PATCH được gửi mới thay đổi, không cho đổi ID/owner.
  `null` chỉ hợp lệ ở trường có `?` ghi nullable; trường không bắt buộc là `optional`.
- Query danh sách: `page` mặc định 1, `pageSize` mặc định 20, tối đa 100;
  whitelist sort; mọi sort thêm `id` làm tie-break. Date filter `from` inclusive,
  `to` exclusive RFC3339, `from < to`; `q` tối đa 200 ký tự.
- Ghi nhạy cảm yêu cầu `Idempotency-Key` UUID: checkout, cancel, seller-order
  confirm/pack/reject (gồm Admin recovery), payment attempt/result, shipment
  events/retry/return, COD collection, inventory adjustment, nhận hàng và Admin
  user lock/unlock, product hide.
  Phạm vi unique = actor + method + canonical route + key; lưu hash nội dung chuẩn hóa,
  status/body và resource ID. Cùng key/body trả đúng kết quả cũ; khác body trả 409
  `IDEMPOTENCY_CONFLICT`. Checkout/payment lưu liên kết bền vững, không tự hết hiệu lực
  trước khi đơn kết thúc; UI mất kết nối tra cứu đơn rồi gửi lại cùng key.
- `expectedVersion` integer >= 0 bắt buộc với inventory và chuyển trạng thái; conflict 409.
  Transaction phải kiểm tra lại quyền, trạng thái, giá và tồn; client không quyết định tiền.
- Seller/Admin commands trên SellerOrder (confirm, pack, reject, cod-collection) dùng
  `expectedVersion = SellerOrder.version`. Buyer `POST /payments/{id}/mock-result` dùng
  `expectedVersion = MarketplaceOrder.version`: Buyer đọc được Order tổng, còn Seller chỉ nhận
  SellerOrder projection và không được cấp version của Order cha.
- Role ký hiệu: G = public, U = authenticated user, B = owner Buyer,
  S = active user có membership shop tương ứng, A = Admin. S cũng có quyền Buyer.
  Shop SUSPENDED chỉ cấm giao dịch/sản phẩm mới; S vẫn xử lý đơn cũ.
  Tài khoản khóa bị thu hồi phiên; A dùng action xử lý đơn cũ được ghi nhật ký.

## Authentication và nền tảng

Access JWT 10 phút, giữ trong memory; refresh token hết hạn sau 7 ngày,
rotation với family/session revocation (research decision R04).
`clientPlatform` enum `WEB|ANDROID|IOS|WINDOWS|MACOS` phục vụ lựa chọn adapter,
không phải chứng cứ cấp quyền. Server cấu hình client/origin allowlist riêng.
Web refresh cookie HttpOnly Secure SameSite=Lax path `/api/v1/auth`; body response
không chứa refresh token. `/auth/csrf` cấp token gắn session/pre-session; web gửi
`X-CSRF-Token` và Origin hợp lệ khi login/register/refresh/logout hay cookie mutation.
API nghiệp vụ dùng Bearer token, không tự dùng cookie như danh tính nghiệp vụ.
Native gửi refresh token chỉ ở endpoint refresh/logout, lưu trong Expo SecureStore (Mobile)
hoặc Tauri Stronghold mã hóa, mở khóa bằng mật khẩu riêng do người dùng nhập (Desktop).
Không hardcode khóa Stronghold, không localStorage, không log token. Quên mật khẩu vault
thì xóa vault cục bộ và đăng nhập lại, không ảnh hưởng giao dịch phía server.
Native token response là ngoại lệ có chủ đích của quy tắc không lộ dữ liệu nhạy cảm.
Refresh cũ tái sử dụng thu hồi family, 401 `SESSION_REVOKED`; logout lặp 204.

## DTO dictionary

Tất cả field dưới đây bắt buộc trừ field ghi `optional`; `?` cho phép null.
Read DTO có `id`, `createdAt`, `updatedAt` trừ projection/command ghi khác.

| DTO | Fields / constraints |
| --- | --- |
| Register | email normalized trim/lowercase valid max254; password 12–128 chars including spaces; fullName trimmed 1–120; clientPlatform |
| Login | email; password; clientPlatform |
| Tokens | accessToken; expiresIn:600; user:User; sessionId; refreshToken optional native only |
| Refresh | refreshToken optional native only; clientPlatform |
| User | id; email; fullName; phone?; avatar:Asset?; roles:`BUYER|ADMIN`[]; status:`ACTIVE|LOCKED`; version (auth_version); timestamps |
| ProfilePatch | fullName optional 1–120; phone optional 8–20; avatarAssetId optional UUID nullable |
| PasswordChange | currentPassword; newPassword 12–128 |
| AddressWrite | recipientName 1–120; phone 8–20; line1 1–250; ward 1–120; district 1–120; province 1–120; country:`VN`; isDefault boolean |
| Address | AddressWrite + id,timestamps; ownership implicit in `/users/me` |
| Asset | id; url; mimeType:`image/jpeg|image/png|image/webp`; byteSize <=5242880; width; height |
| Upload | multipart file exactly1; purpose:`AVATAR|SHOP_LOGO|SHOP_BANNER|PRODUCT_IMAGE`; shopId optional required for existing shop/banner/product purposes; new-shop logo may be unbound but belongs to uploader until ShopCreate binds it |
| ShopWrite | name 1–150; slug lowercase `[a-z0-9]+(-[a-z0-9]+)*` 3–80 unique; description 1–5000; logoAssetId; contactAddress 1–500; phone 8–20 |
| ShopPatch | editable ShopWrite fields optional; slug allowed only before first approval; bannerAssetId optional nullable |
| Shop | id; ShopWrite fields; logo:Asset; banner:Asset?; status:`PENDING|ACTIVE|REJECTED|SUSPENDED`; rejectionReason?; version; timestamps |
| Membership | shopId; shopName; shopStatus; role:`OWNER|MANAGER` (seed memberships, no invitation UI in MVP) |
| ReasonVersion | reason 1–500; expectedVersion |
| CategoryWrite | name 1–120; parentId? UUID; visible boolean |
| Category | id; name; parentId?; visible; timestamps |
| VariantCreate | sku 1–80 unique per shop; attributes map string->string max10 entries, keys<=50 values<=100; price money >0; stock integer >=0; selling boolean |
| ProductCreate | name 1–200; description 1–20000; categoryId; imageAssetIds UUID[] length1–10; selling boolean; variants VariantCreate[] length1–100 |
| ProductPatch | name,description,categoryId,imageAssetIds,selling optional; no shop reassignment |
| VariantPatch | sku,attributes,price,selling optional; no stock field; use inventory action |
| Variant | id; productId; sku; attributes; price; availableQuantity integer>=0; selling; version; timestamps |
| Product | id; shopId; categoryId; name; description; images:Asset[]; selling; adminHidden; hiddenReason string?; minimumPrice money?; variants:Variant[]; ratingAverage decimal string?; ratingCount; timestamps |
| ProductSummary | id; shopId; name; image:Asset?; minimumPrice money; available boolean; ratingAverage?; ratingCount; createdAt |
| InventoryAdjust | delta nonzero integer; reason 1–500; expectedVersion; resulting available must be>=0 |
| Inventory | variantId; availableQuantity; version; updatedAt |
| CartAdd | variantId; quantity integer1–999; merge same variant by adding, total<=999 |
| CartPatch | quantity optional1–999; selected optional boolean; at least one |
| CartItem | id; variantId; productId; shopId; productName; sku; attributes; image?; currentUnitPrice money; quantity; selected; availableQuantity; purchasable; unavailableReason? |
| Cart | id; groups:{shopId,shopName,items:CartItem[],selectedSubtotal}[]; selectedTotal money; currency; updatedAt |
| CheckoutQuoteRequest | cartItemIds unique UUID[] length1–100; addressId; paymentMethod:`COD|MOCK` |
| CheckoutQuote | quoteId; expiresAt; lines:{cartItemId,variantId,shopId,quantity,unitPrice,lineTotal}[]; groups:{shopId,subtotal,shippingFee,total}[]; addressSnapshot:AddressWrite; total; currency; valid boolean; issues:{cartItemId?,code,message}[] |
| CheckoutCreate | quoteId; no price/address/owner override; selected quantities and address bound into quote |
| OrderItem | id; productId; variantId; productName; sku; attributes; imageUrl?; unitPrice; quantity; lineTotal; reviewId?; review?:{rating,comment,createdAt} read-only; immutable snapshots |
| SellerOrder | id; orderId; shopId; shopNameSnapshot; status; items:OrderItem[]; originalTotal; cancelledAmount; capturedAmount; refundedAmount; outstandingAmount; currency; addressSnapshot; shipment:Shipment?; version; completedAt?; cancelledAt?; cancelReason?; timestamps |
| Order | id; buyerId; orderNumber; sellerOrders:SellerOrder[]; status; partiallyCancelled boolean; originalTotal; cancelledAmount; capturedAmount; refundedAmount; outstandingAmount; paymentMethod; paymentStatus; currency; paymentDeadline?; payments:Payment[]; version; timestamps |
| OrderSummary | id; orderNumber; status; partiallyCancelled; originalTotal; outstandingAmount; paymentStatus; createdAt |
| PaymentAttemptCreate | orderId |
| Payment | id; orderId; transactionCode; method:`COD|MOCK`; status:`PENDING|SUCCEEDED|FAILED|CANCELLED`; settlementKind:`NORMAL|LATE_COMPENSATION`; originalAttemptId optional UUID (late compensation); amount; currency; allocations:{sellerOrderId,amount}[]; refunds:{id,sellerOrderId,amount,reason,createdAt}[]; createdAt; resolvedAt? |
| MockResult | eventId UUID; outcome:`SUCCEEDED|FAILED|CANCELLED`; expectedVersion = MarketplaceOrder.version |
| Shipment | id; sellerOrderId; status:`WAITING_PICKUP|PICKED_UP|IN_TRANSIT|DELIVERED|FAILED`; trackingCode; attemptNumber; version; history:{id,event,status,actorId,reason?,createdAt}[]; timestamps |
| ShipmentEvent | eventId UUID; event:`PICKED_UP|IN_TRANSIT|DELIVERED|FAILED`; reason optional required FAILED; expectedVersion |
| CodCollection | eventId UUID; expectedVersion = SellerOrder.version; amount comes from seller order, never client input |
| ReviewCreate | orderItemId; rating integer1–5; comment trimmed1–2000 |
| Review | id; productId; shopId; orderItemId; buyerDisplayName; rating; comment; createdAt; no email/address |
| SellerStats | shopId; productCount; pendingCount; processingCount; completedCount; completedRevenue; currency; simulated:true; from; to; timezone:`Asia/Saigon` |
| RevenueSeries | shopId; groupBy:`DAY|MONTH`; points:{period,completedCount,revenue}[]; totalRevenue; currency; simulated:true; timezone |
| AdminStats | userCount; shopCount; productCount; orderCount; countsByStatus map; completedSellerOrderValue; currency; simulated:true; from; to; timezone |
| Audit | id; actorId; action; resourceType; resourceId; reason?; createdAt; requestId; sanitized metadata |
| ActionResult | affectedResourceIds UUID[]; resultingOrder:Order; replay boolean |

## Endpoint inventory

Every endpoint inherits validation/auth/error rules above. `S(shopId)` always checks membership
on the database, including nested product/order/shipment ownership; hidden IDs never bypass it.
Empty request = no body. Queries are optional unless noted. `List<T>` uses pagination envelope.

### Identity — Sprint 2, FR-01–06

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /auth/csrf | none | {csrfToken} | G, browser Origin allowlist | disallowed Origin 403; token/session match |
| POST /auth/register | Register | Tokens 201 | G | 409 EMAIL_TAKEN; email case dedup; invalid password; no admin role input |
| POST /auth/login | Login | Tokens | G | 401 INVALID_CREDENTIALS generic; locked 403; throttled 429 |
| POST /auth/refresh | Refresh | Tokens | refresh credential | rotation/reuse/expiry; never log credential |
| POST /auth/logout | Refresh | 204 | session/refresh credential | revoked replay 204; old access rejected |
| GET /users/me | none | User | U | own user only |
| PATCH /users/me | ProfilePatch | User | U | foreign asset 404; wrong mime 415 |
| POST /users/me/password | PasswordChange | 204 | U | current password wrong 422; other sessions revoked |
| GET /users/me/addresses | none | List<Address> | U | no other-user address |
| POST /users/me/addresses | AddressWrite | Address 201 | U | concurrent default: one winner/default |
| PATCH /users/me/addresses/{id} | partial AddressWrite | Address | B | only one default; owner validation |
| DELETE /users/me/addresses/{id} | none | 204 | B | deleting default leaves none, does not mutate order |
| GET /users/me/shops | none | List<Membership> | U | multi-shop isolation |
| POST /users/me/assets | Upload | Asset 201 | U; S(shopId) if shop bound | Sprint3; magic-byte/type/size/ownership checks, malicious uploads rejected; only uploader may bind initial logo |

### Shops/categories — Sprint 3, FR-07–11,20,48

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| POST /shops | ShopWrite | Shop 201 | U | unique slug 409; owner membership atomically created |
| GET /shops/{id} | none | public Shop projection | G | only ACTIVE; omit contactAddress/private phone/rejectionReason/version |
| GET /shops/{id}/management | none | Shop | S | PENDING/REJECTED visible owner only |
| PATCH /shops/{id} | ShopPatch + expectedVersion | Shop | S | approved slug immutable; invalid asset/category; version conflict |
| POST /shops/{id}/resubmit | {expectedVersion} | Shop | S | only REJECTED -> PENDING |
| GET /shops/{id}/products | product query | List<ProductSummary> | G | only publicly sellable products |
| GET /categories | {parentId?,tree?:boolean} | List<Category> or tree nodes | G | hidden category excluded; deterministic tree |
| GET /admin/categories | — | Full category tree including hidden entries | A | deterministic tree; enables restore after hide |
| POST /admin/categories | CategoryWrite | Category 201 | A | parent invalid/hidden 422; cycle 409 |
| PATCH /admin/categories/{id} | partial CategoryWrite | Category | A | parent self/descendant 409; hide prevents new sale |

### Catalog/inventory — Sprint 3; discovery Sprint 4, FR-12–19,28

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /products | q,categoryId,shopId,minPrice,maxPrice,sort:`PRICE_ASC|PRICE_DESC|NEWEST`,page,pageSize | List<ProductSummary> | G | bad range 400; min active variant price; hidden shop/category excluded |
| GET /products/{id} | none | public Product | G | hidden/not selling 404; out of stock visible; omit admin fields/version |
| GET /shops/{shopId}/management/products | q,selling,adminHidden,page,pageSize | List<Product> | S | includes own hidden/stopped for management |
| POST /shops/{shopId}/products | ProductCreate | Product 201 | S | ACTIVE required; SKU conflict 409; all variants/images atomic |
| GET /shops/{shopId}/products/{id}/management | none | Product | S | cross-shop 404 |
| PATCH /shops/{shopId}/products/{id} | ProductPatch + expectedVersion | Product | S | immutable order snapshots; stopped product stays in history |
| POST /shops/{shopId}/products/{id}/variants | VariantCreate | Variant 201 | S | SKU conflict; product wrong shop 404 |
| PATCH /shops/{shopId}/variants/{id} | VariantPatch + expectedVersion | Variant | S | no arbitrary absolute-stock overwrite |
| GET /shops/{shopId}/variants/{id}/inventory | none | Inventory | S | other shop 404 |
| POST /shops/{shopId}/variants/{id}/inventory-adjustments | InventoryAdjust | Inventory | S | 409 stale version/insufficient remaining stock; exactly once delta |

### Cart/checkout — Sprint 4–5, FR-21–28

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /cart | none | Cart | U | account scoped, grouped; invalid old lines annotated |
| POST /cart/items | CartAdd | Cart 201 | U | 422 unavailable/insufficient stock; existing variant merges quantity |
| PATCH /cart/items/{id} | CartPatch | Cart | B | positive integer; other buyer 404 |
| DELETE /cart/items/{id} | none | 204 | B | no order deletion; other buyer 404 |
| POST /checkout/quotes | CheckoutQuoteRequest | CheckoutQuote 201 | U | owned lines/address; return full per-line issues, no stock hold |
| POST /checkout | CheckoutCreate + Idempotency-Key | Order 201 | U | quote expires after5min; stale price 409 PRICE_CHANGED with fresh quote; all-or-none; competing last stock; no price from request |

Quote stores canonical lines, quantity, address snapshot, method and price fingerprints.
Commit revalidates every line and quote ownership; it never silently accepts changed prices.
Expired quote returns 409 `QUOTE_EXPIRED`, new quote requires explicit Buyer confirmation.
Same successful checkout key replays original Order even though quote/cart lines are consumed.
Only purchased lines leave cart, transaction includes all seller orders/items and stock deduction.

### Orders — Sprint 5, FR-29–32,44,50

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /orders | status,paymentStatus,from,to,page,pageSize | List<OrderSummary> | U | own orders only |
| GET /orders/{id} | none | Order | B | no other-buyer disclosure |
| POST /orders/{id}/cancel | ReasonVersion | ActionResult | B | all noncancelled parts PENDING or 409 with blocking IDs; atomic all parts |
| POST /orders/{id}/seller-orders/{sellerOrderId}/cancel | ReasonVersion | ActionResult | B | only own PENDING part; rest unchanged |
| POST /orders/{id}/seller-orders/{sellerOrderId}/receive | {expectedVersion} | SellerOrder | B | only DELIVERED and paid/collected; review becomes eligible |
| GET /shops/{shopId}/orders | status,from,to,page,pageSize | List<SellerOrder> | S | only shop parts, no other shop/payment credential |
| GET /shops/{shopId}/orders/{id} | none | SellerOrder | S | id is SellerOrder ID; cross-shop 404 |
| POST /shops/{shopId}/orders/{id}/confirm | {expectedVersion} | SellerOrder | S | expectedVersion = SellerOrder.version; PENDING only; MOCK must be paid; COD allowed unpaid |
| POST /shops/{shopId}/orders/{id}/pack | {expectedVersion} | SellerOrder | S | expectedVersion = SellerOrder.version; CONFIRMED only; activates WAITING_PICKUP shipment |
| POST /shops/{shopId}/orders/{id}/reject | ReasonVersion | SellerOrder | S | expectedVersion = SellerOrder.version; PENDING or CONFIRMED only; restore/refund once |

Order status is derived by BR-08, never accepted as PATCH. Seller may not receive whole
multi-shop Order. SUSPENDED shop can fulfill old orders; locked user cannot authenticate.
All order cancellation/refund/inventory writes occur atomically with audit and idempotency.

### Payments — Sprint 5, FR-33–36

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /payments?orderId={id} | owned orderId required | List<Payment> | B or A | no cross-buyer records |
| POST /payments/mock-attempts | PaymentAttemptCreate | Payment 201 | B | 409 ORDER_EXPIRED/ALREADY_PAID; serializes concurrent attempts |
| POST /payments/{id}/mock-result | MockResult | Payment | B owning attempt, mock mode only | expectedVersion = MarketplaceOrder.version because Buyer can read Order while Seller receives only SellerOrder; 409 on mismatch/conflicting result; repeated event no double capture; late success refunded |
| POST /payments/seller-orders/{id}/cod-collection | CodCollection | Payment | S(owner shop) or A | COD only; DELIVERED required; expectedVersion = SellerOrder.version (409 on mismatch); exactly once amount server-calculated |

MOCK attempt pays sum of noncancelled parts. Cancelling a seller part invalidates an existing
PENDING mock attempt to CANCELLED; a retry snapshots only remaining live parts. Only one
unresolved attempt per Order; starting
another while pending returns its existing ID (same key) or 409 `ATTEMPT_IN_PROGRESS`.
Cancel/failure marks attempt terminal but leaves order PENDING and stock deducted until15min
deadline. Retry creates a new attempt ID, never another Order. Success locks Order before
capture and fixes allocations; one NORMAL accepted capture per Order. Success arriving after
cancel/deadline is an immutable event linked to the original attempt. It creates a separate
SUCCEEDED PaymentAttempt with `settlementKind:LATE_COMPENSATION`, originalAttemptId and
snapshot allocations; equal full simulated refunds are created in the same transaction.
It never resurrects an old CANCELLED/FAILED attempt, never fulfills an order, and never
deducts stock. Database unique `compensates_event_id` links the source event and makes
retries return the same compensation.
The response to a late event returns the compensation Payment DTO, retaining the original
attempt ID in originalAttemptId; history queries expose both records for audit.
Repeated event ID must match same body; conflicting outcome cannot overwrite terminal success.
Cancellation after capture refunds seller allocation, never changes original payment amount.
Aggregate: gross captures C, refunds R, net N=C-R, live amount L=sum of noncancelled
SellerOrder original amounts. If C=0 => UNPAID; if R=C>0 => REFUNDED;
if 0<R<C => PARTIALLY_REFUNDED; otherwise N<L => PARTIALLY_PAID, else PAID.
Outstanding = max(0, noncancelled original amounts - net allocations to live parts).
No card fields, provider webhook, payout/settlement or real money endpoint in MVP.

### Shipments — Sprint 5, FR-37–39

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /shipments/{id} | none | Shipment | B(order owner), S(shop), A | unrelated user 404 |
| POST /shipments/{id}/events | ShipmentEvent | Shipment | S(shop) or A | invalid step 409; immutable event history |
| POST /shipments/{id}/retry | ReasonVersion | Shipment | S(shop) or A | FAILED only; WAITING_PICKUP new attempt; no stock deduction |
| POST /admin/shipments/{id}/return-confirmation | ReasonVersion | ActionResult | A | Sprint5 W037; FAILED only; proof-by-reason audit; cancel/restore/refund once |

Shipment is null before PACKING. Transition to PACKING creates exactly one shipment for
the SellerOrder in WAITING_PICKUP state within the same transaction; no inactive row exists.
PICKED_UP event hands over and sets SellerOrder SHIPPING;
then IN_TRANSIT -> DELIVERED or FAILED. FAILED retains SellerOrder SHIPPING. Retry pickup
does not move SellerOrder backward. DELIVERED sets SellerOrder DELIVERED; COD collection is
a separate simulated action; Buyer receive requires collection/payment before COMPLETED.
Admin acts through explicit actions, never arbitrary state override or mutation of completed order.

### Reviews/statistics — Sprint 6, FR-40–46

Shop reviews, stats và revenue cho phép tài khoản ACTIVE có membership ACTIVE của shop
ACTIVE hoặc SUSPENDED; shop PENDING/REJECTED bị từ chối.
Stats và revenue đều bắt buộc `from` và `to` (RFC3339 UTC, `from` inclusive,
`to` exclusive, `from < to`); revenue còn bắt buộc `groupBy`. Không giới hạn độ dài
khoảng thời gian. Giao diện có thể chọn mặc định 30 ngày, API không tự điền.

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| POST /reviews | ReviewCreate | Review 201 | B(order item owner) | COMPLETED required 422; unique orderItem 409; range1–5 |
| GET /products/{id}/reviews | rating,page,pageSize | List<Review> | G | only public product; safe buyer projection |
| GET /shops/{id}/reviews | productId,rating,page,pageSize | List<Review> | S | cross-shop product filter rejected |
| GET /shops/{id}/stats | from,to required | SellerStats | S | count definitions BR-10; no hidden revenue from other shop |
| GET /shops/{id}/revenue | from,to,groupBy all required | RevenueSeries | S | day/month at Asia/Saigon completion instant; simulate label |

### Admin — Sprint 3 / 6, FR-08,10,15,46–50

| Method/path | Request | Response | Auth | Extra errors / tests |
| --- | --- | --- | --- | --- |
| GET /admin/users | q,status,page,pageSize | List<User> | A | Sprint6; no hashes/refresh/session secrets |
| POST /admin/users/{id}/lock | ReasonVersion + Idempotency-Key | User | A | expectedVersion = User.version (auth_version); Sprint6; revoke sessions; old tokens rejected; self-lock forbidden |
| POST /admin/users/{id}/unlock | ReasonVersion + Idempotency-Key | User | A | expectedVersion = User.version (auth_version); Sprint6; does not revive revoked sessions |
| GET /admin/shops | q,status,page,pageSize | List<Shop> | A | Sprint3; PENDING queue |
| POST /admin/shops/{id}/approve | {expectedVersion} | Shop | A | Sprint3; PENDING->ACTIVE only |
| POST /admin/shops/{id}/reject | ReasonVersion | Shop | A | Sprint3; PENDING->REJECTED; reason required |
| POST /admin/shops/{id}/suspend | ReasonVersion | Shop | A | Sprint3 W018; ACTIVE->SUSPENDED; new checkout blocked |
| POST /admin/shops/{id}/resume | ReasonVersion | Shop | A | Sprint3 W018; SUSPENDED->ACTIVE only |
| GET /admin/products | q,shopId,adminHidden,page,pageSize | List<Product> | A | Sprint6; all moderation states |
| POST /admin/products/{id}/hide | ReasonVersion + Idempotency-Key | Product | A | expectedVersion = Product.version; Sprint6; hide blocks purchases, snapshots intact |
| GET /admin/orders | q,buyerId,shopId,status,from,to,page,pageSize | List<OrderSummary> | A | Sprint6; shop filter searches parent with matching part |
| GET /admin/orders/{id} | none | Order + audit reference IDs | A | Sprint6; read-only completed transactions |
| GET /admin/stats | from,to | AdminStats | A | Sprint6; all row counts; revenue only completed seller parts |
| GET /admin/audit | resourceType,resourceId,actorId,from,to,page,pageSize | List<Audit> | A | Sprint6; immutable, sanitized |
| POST /admin/seller-orders/{id}/confirm | {expectedVersion,reason} + Idempotency-Key | SellerOrder | A | expectedVersion = SellerOrder.version; Sprint6; account locked recovery, same domain guards |
| POST /admin/seller-orders/{id}/pack | {expectedVersion,reason} + Idempotency-Key | SellerOrder | A | expectedVersion = SellerOrder.version; Sprint6; CONFIRMED only; logged |
| POST /admin/seller-orders/{id}/reject | ReasonVersion + Idempotency-Key | SellerOrder | A | expectedVersion = SellerOrder.version; Sprint6; PENDING/CONFIRMED only, restores once |

Admin recovery actions exist only to process existing orders when an account is locked,
per spec edge case; no general impersonation or arbitrary edit. No public role assignment API.

## OpenAPI, mocks và contract testing

This Markdown is the readable API contract. `packages/contracts/openapi.yaml` records its
endpoint, DTO, auth and error shapes, with commerce examples at
`packages/contracts/examples/commerce.json`. Runtime controllers and NestJS Swagger output are
implemented incrementally and must conform to this contract; contract tests compare route,
security, DTO and header shapes. Generated TypeScript clients/types live in `packages/api-client`;
avoid hand-maintained duplicate DTOs across web/mobile/desktop. Breaking contract changes require
review/versioned migration.

Mock fixtures from contract examples: Guest, BuyerA/B, SellerA/B, Admin; two active shops,
one pending/locked shop, one hidden category/product, final-unit variant, completed/partial
cancelled orders, success/failure/cancel/late mock payment, FAILED shipment. Stateful mock
scenarios may drive UI transitions but do not prove concurrency/security correctness.

Contract test matrix: each endpoint's success, malformed DTO, no auth, wrong role, wrong
resource owner; list sorting/pagination; response excludes secrets; datetime/money formats.
Priority P0 actual PostgreSQL integration tests for checkout all-or-none, parallel final-unit
buyers, inventory adjustment collision, checkout repeat, conflicting idempotency body,
parallel payment/cancel/deadline, late success refund, repeated COD, shipment return exactly
once, unauthorized cross-shop mutation. P1 verifies category cycles, SKU uniqueness,
snapshot immutability, review duplication and statistics at timezone boundaries.
Acceptance requires actual API responses and persisted state to match contract; generating
client or passing mock UI tests alone is insufficient.

## Requirement coverage

| FR | Contract |
| --- | --- |
| 01–06 | auth, profile, addresses, membership and role/ownership guards |
| 07–10 | shop create/manage/resubmit; admin approve/reject/suspend/resume |
| 11–15 | category writes; products/variants/inventory; admin hide |
| 16–20 | public product/category/shop discovery, filters, detail/reviews |
| 21–24 | account cart CRUD/grouping and quotes/revalidation |
| 25–28 | idempotent checkout, snapshots, transaction stock adjustment |
| 29–32 | buyer/seller order queries, explicit commands, derived status/cancel |
| 33–36 | COD collection, mock attempts/results, ledger/refund/idempotency/deadline |
| 37–39 | shipment queries/events/retry/admin return |
| 40–42 | review create/read and unique completed buyer item |
| 43–45 | shop stats/revenue/order filtering |
| 46–50 | admin stats/accounts/shop queue/moderation/order audit |
