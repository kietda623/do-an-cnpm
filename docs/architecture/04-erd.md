# ERD — Sơ đồ thực thể quan hệ

**Dự án:** Multi-vendor Marketplace MVP
**Nguồn chính:** `apps/api/prisma/schema.prisma` (28 model, trích từ zip repo ngày 2026-10-24), đối chiếu `specs/001-marketplace-mvp/data-model.md` và `docs/database/data-design.md`.
**Cơ sở dữ liệu:** PostgreSQL 17 · khóa chính UUID · tiền `NUMERIC(18,0)` (VND) · thời gian `timestamptz` (UTC).

> **Lưu ý về `Review`.** Bảng `reviews` có trong `data-model.md` (Sprint 6) nhưng **chưa có trong `schema.prisma` hiện tại** và chưa có migration. ERD bên dưới vẫn vẽ để phủ FR-40–42; thực thể này được đánh dấu *(thiết kế, chưa migrate)*.

## 1. Quy ước

| Ký hiệu | Ý nghĩa |
| --- | --- |
| `PK` | Khóa chính |
| `FK` | Khóa ngoại |
| `UK` | Có ràng buộc UNIQUE (đơn lẻ hoặc là một phần của unique tổ hợp, ghi chú ở bảng) |
| `\|\|--o{` | 1 – nhiều (0..n) |
| `\|\|--o\|` | 1 – 0..1 |
| `\|\|--\|{` | 1 – nhiều (1..n) |

Tên cột dùng `snake_case` như trong DB. Chỉ liệt kê các cột quan trọng (khóa, trạng thái, tiền, version, snapshot); danh sách đầy đủ xem `schema.prisma`.

---

## 2. ERD tổng quan (chỉ khóa và quan hệ)

```mermaid
erDiagram
  USER ||--o{ SESSION : "có"
  USER ||--o{ ADDRESS : "sở hữu"
  USER ||--o{ ASSET : "tải lên"
  USER ||--o{ SHOP_MEMBER : "tham gia"
  USER ||--o| CART : "có"
  USER ||--o{ MARKETPLACE_ORDER : "đặt"
  USER ||--o{ CHECKOUT_QUOTE : "yêu cầu"
  USER |o--o{ AUDIT_EVENT : "thực hiện"

  SHOP ||--o{ SHOP_MEMBER : "cấp quyền"
  SHOP ||--o{ PRODUCT : "bán"
  SHOP ||--o{ SELLER_ORDER : "nhận"
  SHOP ||--o{ INVENTORY : "quản lý"

  CATEGORY ||--o{ CATEGORY : "cha-con"
  CATEGORY ||--o{ PRODUCT : "phân loại"
  PRODUCT ||--|{ PRODUCT_VARIANT : "gồm"
  PRODUCT ||--o{ PRODUCT_IMAGE : "có ảnh"
  ASSET ||--o{ PRODUCT_IMAGE : "dùng làm"
  PRODUCT_VARIANT ||--|| INVENTORY : "theo dõi tồn"
  INVENTORY ||--o{ INVENTORY_MOVEMENT : "ghi biến động"

  CART ||--o{ CART_ITEM : "chứa"
  PRODUCT_VARIANT ||--o{ CART_ITEM : "được chọn"
  CART ||--o{ CHECKOUT_QUOTE : "sinh báo giá"
  ADDRESS ||--o{ CHECKOUT_QUOTE : "dùng cho"
  CHECKOUT_QUOTE |o--o| MARKETPLACE_ORDER : "được tiêu thụ bởi"

  MARKETPLACE_ORDER ||--|{ SELLER_ORDER : "tách thành"
  SELLER_ORDER ||--|{ ORDER_ITEM : "gồm"
  PRODUCT_VARIANT ||--o{ ORDER_ITEM : "được mua"
  MARKETPLACE_ORDER ||--o{ ORDER_EVENT : "ghi sự kiện"

  MARKETPLACE_ORDER ||--o| PAYMENT : "có"
  PAYMENT ||--o{ PAYMENT_ATTEMPT : "thử"
  PAYMENT ||--o{ PAYMENT_EVENT : "nhận sự kiện"
  PAYMENT_ATTEMPT ||--o{ PAYMENT_ALLOCATION : "phân bổ"
  SELLER_ORDER ||--o{ PAYMENT_ALLOCATION : "nhận tiền"
  PAYMENT_ALLOCATION ||--o| SIMULATED_REFUND : "hoàn"

  SELLER_ORDER ||--o| SHIPMENT : "giao bằng"
  SHIPMENT ||--o{ SHIPMENT_EVENT : "lịch sử"

  ORDER_ITEM ||--o| REVIEW : "được đánh giá"
```

---

## 3. ERD chi tiết theo miền

### 3.1. Định danh, phiên, địa chỉ, tài nguyên ảnh, audit, idempotency

```mermaid
erDiagram
  USER ||--o{ SESSION : "có"
  USER ||--o{ ADDRESS : "sở hữu"
  USER ||--o{ ASSET : "tải lên"
  USER |o--o| ASSET : "avatar"
  USER |o--o{ AUDIT_EVENT : "thực hiện"
  USER |o--o{ IDEMPOTENCY_RECORD : "gửi"
  SESSION |o--o| SESSION : "thay thế bởi"

  USER {
    uuid id PK
    string email_normalized UK
    string password_hash
    string display_name
    string phone
    uuid avatar_asset_id FK
    enum system_role "BUYER, ADMIN"
    enum status "ACTIVE, LOCKED"
    int auth_version
    timestamptz created_at
  }
  SESSION {
    uuid id PK
    uuid user_id FK
    enum platform "WEB, MOBILE, DESKTOP"
    enum client_platform "WEB, ANDROID, IOS, WINDOWS, MACOS"
    string refresh_hash UK
    uuid family_id
    timestamptz expires_at
    timestamptz revoked_at
    uuid replaced_by_session_id UK
  }
  ADDRESS {
    uuid id PK
    uuid user_id FK
    string recipient_name
    string phone
    string line1
    string ward
    string district
    string province
    string country
    boolean is_default
    timestamptz deleted_at
  }
  ASSET {
    uuid id PK
    uuid uploader_user_id FK
    uuid shop_id FK
    enum purpose "AVATAR, SHOP_LOGO, SHOP_BANNER, PRODUCT_IMAGE"
    string object_key UK
    string mime_type
    int byte_size
    int width
    int height
    enum status "PENDING, VERIFIED, REJECTED"
    timestamptz attached_at
  }
  AUDIT_EVENT {
    uuid id PK
    uuid actor_user_id FK
    string actor_kind
    string action
    string target_type
    string target_id
    uuid shop_id FK
    string reason
    string outcome
    string request_id
    json safe_metadata
  }
  IDEMPOTENCY_RECORD {
    uuid id PK
    uuid actor_user_id FK
    string actor_scope
    string operation
    string idempotency_key
    string request_hash
    enum state "IN_PROGRESS, COMPLETED"
    int response_status
    string resource_type
    string resource_id
    json response_summary
  }
```

**Ràng buộc đáng chú ý:** `email_normalized` unique; `refresh_hash` unique; `UNIQUE(actor_scope, operation, idempotency_key)` trên `idempotency_records`; chỉ **một** địa chỉ mặc định/user (kiểm tra bằng unique một phần/service); xóa địa chỉ là xóa mềm.

### 3.2. Cửa hàng, danh mục, sản phẩm, biến thể, tồn kho

```mermaid
erDiagram
  USER ||--o{ SHOP : "chủ sở hữu"
  USER ||--o{ SHOP_MEMBER : "tham gia"
  SHOP ||--o{ SHOP_MEMBER : "cấp quyền"
  ASSET ||--o| SHOP : "logo"
  ASSET |o--o| SHOP : "banner"
  SHOP ||--o{ PRODUCT : "bán"
  CATEGORY |o--o{ CATEGORY : "cha-con"
  CATEGORY ||--o{ PRODUCT : "phân loại"
  PRODUCT ||--o{ PRODUCT_IMAGE : "có ảnh"
  ASSET ||--o{ PRODUCT_IMAGE : "dùng làm"
  PRODUCT ||--|{ PRODUCT_VARIANT : "gồm"
  PRODUCT_VARIANT ||--|| INVENTORY : "theo dõi tồn"
  SHOP ||--o{ INVENTORY : "thuộc"
  INVENTORY ||--o{ INVENTORY_MOVEMENT : "ghi biến động"

  SHOP {
    uuid id PK
    uuid owner_user_id FK
    string name
    string slug_normalized UK
    string description
    uuid logo_asset_id FK
    uuid banner_asset_id FK
    string contact_address
    string phone
    enum status "PENDING, ACTIVE, REJECTED, SUSPENDED"
    string decision_reason
    timestamptz approved_at
    int version
  }
  SHOP_MEMBER {
    uuid id PK
    uuid shop_id FK
    uuid user_id FK
    enum role "OWNER, MANAGER"
    enum status "ACTIVE, REVOKED"
  }
  CATEGORY {
    uuid id PK
    uuid parent_id FK
    string name
    string slug UK
    enum status "VISIBLE, HIDDEN"
    int version
  }
  PRODUCT {
    uuid id PK
    uuid shop_id FK
    uuid category_id FK
    string name
    string description
    enum sale_status "DRAFT, ACTIVE, DISCONTINUED"
    boolean admin_hidden
    string hidden_reason
    int version
  }
  PRODUCT_IMAGE {
    uuid id PK
    uuid product_id FK
    uuid asset_id FK
    int position
  }
  PRODUCT_VARIANT {
    uuid id PK
    uuid product_id FK
    uuid shop_id FK
    string sku_normalized
    json attributes
    string attributes_key
    numeric price "NUMERIC(18,0) VND"
    enum sale_status "ACTIVE, DISCONTINUED"
    int version
  }
  INVENTORY {
    uuid variant_id PK
    uuid shop_id FK
    int available_quantity "CHECK >= 0"
    int version
  }
  INVENTORY_MOVEMENT {
    uuid id PK
    uuid inventory_id FK
    uuid seller_order_id FK
    uuid order_item_id FK
    uuid actor_user_id FK
    enum kind "INITIAL, ADJUST, SALE, CANCEL_RETURN, CONFIRMED_RETURN"
    enum effect_type "SALE, RESTORE"
    int quantity_delta
    int quantity_after
    string reason
    string operation_key UK
  }
```

**Ràng buộc đáng chú ý**

| Bảng | Ràng buộc |
| --- | --- |
| `shops` | `slug_normalized` unique; `logo_asset_id` unique; `banner_asset_id` unique |
| `shop_members` | `UNIQUE(shop_id, user_id)` |
| `products` | `UNIQUE(id, shop_id)` — nền tảng cho FK tổ hợp, chống gắn chéo shop |
| `product_variants` | `UNIQUE(shop_id, sku_normalized)`; `UNIQUE(product_id, attributes_key)`; `UNIQUE(id, shop_id)` |
| `product_images` | `UNIQUE(product_id, position)`; `UNIQUE(product_id, asset_id)` |
| `inventory` | PK là `variant_id` (quan hệ 1–1 với biến thể); `UNIQUE(variant_id, shop_id)`; giảm tồn bằng `UPDATE ... WHERE available_quantity >= qty` |
| `inventory_movements` | `UNIQUE(order_item_id, effect_type)` — mỗi dòng hàng chỉ **một** lần SALE và **một** lần RESTORE (chống hoàn tồn hai lần); `operation_key` unique |
| `categories` | Cây cha-con, không chu trình (kiểm tra trong service) |

### 3.3. Giỏ hàng, báo giá, đơn hàng

```mermaid
erDiagram
  USER ||--o| CART : "có"
  CART ||--o{ CART_ITEM : "chứa"
  PRODUCT_VARIANT ||--o{ CART_ITEM : "được chọn"
  USER ||--o{ CHECKOUT_QUOTE : "yêu cầu"
  CART ||--o{ CHECKOUT_QUOTE : "sinh báo giá"
  ADDRESS ||--o{ CHECKOUT_QUOTE : "dùng cho"
  CHECKOUT_QUOTE |o--o| MARKETPLACE_ORDER : "được tiêu thụ bởi"
  USER ||--o{ MARKETPLACE_ORDER : "đặt"
  MARKETPLACE_ORDER ||--|{ SELLER_ORDER : "tách thành"
  SHOP ||--o{ SELLER_ORDER : "nhận"
  SELLER_ORDER ||--|{ ORDER_ITEM : "gồm"
  PRODUCT ||--o{ ORDER_ITEM : "tham chiếu"
  PRODUCT_VARIANT ||--o{ ORDER_ITEM : "tham chiếu"
  ASSET |o--o{ ORDER_ITEM : "ảnh snapshot"
  MARKETPLACE_ORDER ||--o{ ORDER_EVENT : "ghi sự kiện"
  SELLER_ORDER |o--o{ ORDER_EVENT : "ghi sự kiện"

  CART {
    uuid id PK
    uuid buyer_user_id UK
    int version
  }
  CART_ITEM {
    uuid id PK
    uuid cart_id FK
    uuid variant_id FK
    int quantity "1 den 999"
    boolean selected
    int version
  }
  CHECKOUT_QUOTE {
    uuid id PK
    uuid buyer_user_id FK
    uuid cart_id FK
    int cart_version
    json selected_items
    uuid address_id FK
    json recipient_snapshot
    enum payment_method "COD, MOCK"
    numeric total
    string canonical_hash
    timestamptz expires_at
    uuid consumed_order_id FK
  }
  MARKETPLACE_ORDER {
    uuid id PK
    uuid buyer_user_id FK
    string public_number UK
    json recipient_snapshot
    enum payment_method "COD, MOCK"
    numeric original_total
    numeric shipping_total
    timestamptz payment_deadline
    enum status "PENDING, CONFIRMED, PACKING, SHIPPING, DELIVERED, COMPLETED, CANCELLED"
    int version
  }
  SELLER_ORDER {
    uuid id PK
    uuid order_id FK
    uuid shop_id FK
    string shop_name_snapshot
    enum status "PENDING, CONFIRMED, PACKING, SHIPPING, DELIVERED, COMPLETED, CANCELLED"
    numeric original_total
    timestamptz cancelled_at
    string cancellation_reason
    timestamptz completed_at
    timestamptz stock_returned_at
    int version
  }
  ORDER_ITEM {
    uuid id PK
    uuid seller_order_id FK
    uuid shop_id FK
    uuid product_id FK
    uuid variant_id FK
    string product_name_snapshot
    string sku_snapshot
    json attributes_snapshot
    uuid image_asset_id FK
    string image_key_snapshot
    numeric unit_price
    int quantity
    numeric line_total
  }
  ORDER_EVENT {
    uuid id PK
    uuid order_id FK
    uuid seller_order_id FK
    uuid actor_user_id FK
    string actor_kind
    string action
    string from_status
    string to_status
    string reason
    string operation_key UK
  }
```

**Ràng buộc đáng chú ý**

| Bảng | Ràng buộc |
| --- | --- |
| `carts` | `buyer_user_id` unique — mỗi Buyer một giỏ |
| `cart_items` | `UNIQUE(cart_id, variant_id)` — một biến thể là một dòng |
| `checkout_quotes` | `consumed_order_id` unique — một quote chỉ tạo một đơn; hết hạn sau 5 phút |
| `marketplace_orders` | `public_number` unique; index `(payment_method, payment_deadline, id)` phục vụ job hết hạn |
| `seller_orders` | `UNIQUE(order_id, shop_id)` — mỗi shop đúng một phần trong một Order; `UNIQUE(id, shop_id)` |
| `order_items` | `UNIQUE(seller_order_id, variant_id)`; mọi cột `*_snapshot`, `unit_price`, `line_total` **bất biến** |
| `order_events` | Chỉ thêm (append-only); `operation_key` unique |

**Bất biến tiền:** `line_total = unit_price × quantity`; `seller_orders.original_total = Σ line_total`; `marketplace_orders.original_total = Σ seller_orders.original_total` (kể cả phần đã hủy, để bảo toàn giá trị gốc).

### 3.4. Thanh toán, hoàn tiền mô phỏng, vận chuyển

```mermaid
erDiagram
  MARKETPLACE_ORDER ||--o| PAYMENT : "có"
  PAYMENT ||--o{ PAYMENT_ATTEMPT : "thử"
  PAYMENT ||--o{ PAYMENT_EVENT : "nhận sự kiện"
  PAYMENT_ATTEMPT |o--o{ PAYMENT_ATTEMPT : "bù trừ cho"
  PAYMENT_ATTEMPT |o--o{ PAYMENT_EVENT : "nhận sự kiện (attempt_id)"
  PAYMENT_EVENT |o--o| PAYMENT_ATTEMPT : "sinh bù trừ"
  PAYMENT_ATTEMPT ||--o{ PAYMENT_ALLOCATION : "phân bổ"
  SELLER_ORDER ||--o{ PAYMENT_ALLOCATION : "nhận tiền"
  PAYMENT_ALLOCATION ||--o| SIMULATED_REFUND : "hoàn"
  SELLER_ORDER ||--o{ SIMULATED_REFUND : "liên quan"
  SELLER_ORDER ||--o| SHIPMENT : "giao bằng"
  SHIPMENT ||--o{ SHIPMENT_EVENT : "lịch sử"
  USER ||--o{ SHIPMENT_EVENT : "thực hiện"

  PAYMENT {
    uuid id PK
    uuid order_id UK
    enum method "COD, MOCK"
    string currency "VND"
    int version
  }
  PAYMENT_ATTEMPT {
    uuid id PK
    uuid payment_id FK
    int attempt_number
    enum provider "MOCK, COD_SIMULATION"
    enum settlement_kind "NORMAL, LATE_COMPENSATION"
    uuid original_attempt_id FK
    uuid compensates_event_id UK
    enum status "PENDING, SUCCEEDED, FAILED, CANCELLED"
    json target_seller_orders_snapshot
    numeric amount
    string external_transaction_id
    timestamptz expires_at
    timestamptz settled_at
    string operation_key UK
  }
  PAYMENT_ALLOCATION {
    uuid id PK
    uuid attempt_id FK
    uuid seller_order_id FK
    numeric amount
    enum kind "MOCK_PREPAYMENT, COD_COLLECTION"
  }
  SIMULATED_REFUND {
    uuid id PK
    uuid allocation_id UK
    uuid seller_order_id FK
    numeric amount
    enum reason "CANCELLATION, LATE_SUCCESS, CONFIRMED_RETURN"
    string status
    string operation_key UK
  }
  PAYMENT_EVENT {
    uuid id PK
    uuid payment_id FK
    uuid attempt_id FK
    enum provider "MOCK, COD_SIMULATION"
    string external_event_id
    string payload_digest
    enum observed_status "SUCCEEDED, FAILED, CANCELLED"
    enum processing_result "APPLIED, DUPLICATE, IGNORED, REFUNDED"
    numeric late_received_amount
    string late_received_transaction_id
    timestamptz received_at
  }
  SHIPMENT {
    uuid id PK
    uuid seller_order_id UK
    string tracking_code UK
    enum status "WAITING_PICKUP, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED"
    int delivery_attempt
    timestamptz delivered_at
    timestamptz returned_confirmed_at
    int version
  }
  SHIPMENT_EVENT {
    uuid id PK
    uuid shipment_id FK
    uuid actor_user_id FK
    enum from_status
    enum to_status
    int delivery_attempt
    string reason
    string operation_key UK
  }
```

**Ràng buộc đáng chú ý**

| Bảng | Ràng buộc |
| --- | --- |
| `payments` | `order_id` unique — mỗi Order một Payment |
| `payment_attempts` | `UNIQUE(payment_id, attempt_number)`; `compensates_event_id` unique → mỗi sự kiện đến muộn chỉ sinh **một** bản bù trừ; `operation_key` unique |
| `payment_allocations` | `UNIQUE(attempt_id, seller_order_id)` |
| `simulated_refunds` | `allocation_id` unique → mỗi allocation hoàn tối đa một lần trong MVP |
| `payment_events` | `UNIQUE(provider, external_event_id)` → sự kiện lặp bị phát hiện (`DUPLICATE`) |
| `shipments` | `seller_order_id` unique (mỗi SellerOrder một shipment); `tracking_code` unique |
| `shipment_events` | Chỉ thêm; `operation_key` unique |

**Tính trạng thái tiền (không lưu cột):** gọi C = tổng allocation thành công, R = tổng refund, N = C − R, L = tổng `original_total` các SellerOrder chưa hủy.
C = 0 → `UNPAID`; R = C > 0 → `REFUNDED`; 0 < R < C → `PARTIALLY_REFUNDED`; N < L → `PARTIALLY_PAID`; còn lại `PAID`.

### 3.5. Đánh giá *(thiết kế, chưa migrate)*

```mermaid
erDiagram
  USER ||--o{ REVIEW : "viết"
  PRODUCT ||--o{ REVIEW : "nhận"
  ORDER_ITEM ||--o| REVIEW : "đủ điều kiện"

  REVIEW {
    uuid id PK
    uuid buyer_user_id FK
    uuid order_item_id UK
    uuid product_id FK
    smallint rating "CHECK 1 den 5"
    string comment "toi da 2000 ky tu"
    timestamptz created_at
  }
```

Ràng buộc: `UNIQUE(order_item_id)`; `CHECK rating BETWEEN 1 AND 5`; index `(product_id, created_at, id)`. Việc kiểm tra "Buyer sở hữu dòng hàng" và "SellerOrder đã COMPLETED" thực hiện trong service transaction (CHECK không kiểm liên bảng). Không sửa/xóa/phản hồi trong MVP.

---

## 4. Danh mục bảng và module sở hữu

| # | Bảng | Module sở hữu | Migration | Ghi chú |
| --- | --- | --- | --- | --- |
| 1 | `audit_events` | common | 0001_shared | append-only |
| 2 | `idempotency_records` | common | 0001_shared | |
| 3 | `users` | identity | 0002_identity_assets | |
| 4 | `sessions` | identity | 0002_identity_assets | rotation + family |
| 5 | `addresses` | identity | 0002_identity_assets | xóa mềm |
| 6 | `assets` | catalog/media | 0002_identity_assets | |
| 7 | `shops` | shop | 0003_shops | |
| 8 | `shop_members` | shop | 0003_shops | |
| 9 | `categories` | catalog | 0004_catalog_inventory | |
| 10 | `products` | catalog | 0004_catalog_inventory | |
| 11 | `product_images` | catalog | 0004_catalog_inventory | |
| 12 | `product_variants` | catalog | 0004_catalog_inventory | |
| 13 | `inventory` | inventory | 0004_catalog_inventory | |
| 14 | `inventory_movements` | inventory | 0004_catalog_inventory | append-only |
| 15 | `carts` | cart | 0005_cart_orders | |
| 16 | `cart_items` | cart | 0005_cart_orders | |
| 17 | `checkout_quotes` | order | 0005_cart_orders | |
| 18 | `marketplace_orders` | order | 0005_cart_orders | |
| 19 | `seller_orders` | order | 0005_cart_orders | |
| 20 | `order_items` | order | 0005_cart_orders | snapshot bất biến |
| 21 | `order_events` | order | 0005_cart_orders | append-only |
| 22 | `payments` | payment | 0006_payments | |
| 23 | `payment_attempts` | payment | 0006_payments | |
| 24 | `payment_allocations` | payment | 0006_payments | |
| 25 | `simulated_refunds` | payment | 0006_payments | |
| 26 | `payment_events` | payment | 0006_payments | |
| 27 | `shipments` | shipping | 0007_shipments | |
| 28 | `shipment_events` | shipping | 0007_shipments | append-only |
| 29 | `reviews` | review | *(chưa có)* | Sprint 6 |

## 5. Quy tắc toàn vẹn dữ liệu chính

1. **FK lịch sử dùng RESTRICT**, không hard-delete giao dịch; snapshot người nhận, shop, sản phẩm, biến thể, giá nằm trong đơn.
2. **FK tổ hợp chống chéo shop:** `(product_id, shop_id)`, `(variant_id, shop_id)`, `(seller_order_id, shop_id)` đảm bảo một dòng không thể gắn sản phẩm/biến thể của shop khác.
3. **Tồn kho không âm:** giảm tồn bằng cập nhật có điều kiện; mọi thay đổi có movement; `UNIQUE(order_item_id, effect_type)` ngăn hoàn kho hai lần.
4. **Idempotency:** checkout, payment, cancel, shipment, COD, inventory đều dựa trên `idempotency_records` và/hoặc `operation_key`/`external_event_id` unique.
5. **Version (optimistic lock)** ở `shops`, `products`, `product_variants`, `inventory`, `carts`, `cart_items`, `marketplace_orders`, `seller_orders`, `payments`, `shipments`.
6. **Quy tắc liên bảng** (ví dụ: chỉ shop ACTIVE được bán, SellerOrder COMPLETED mới được đánh giá) kiểm tra trong transaction của service; CHECK trong DB chỉ dùng cho bất biến một bảng.
7. **Thứ tự khóa:** Idempotency → User/Cart → Quote → Order → Payment → SellerOrders (theo ID) → Shop → Category → Product → Variant → Inventory (theo ID) → Shipment.

## 6. Đối chiếu và điểm lệch cần lưu ý

| Hạng mục | Tình trạng |
| --- | --- |
| `reviews` | Có trong `data-model.md`, **chưa có** trong `schema.prisma`/migration |
| Tên trạng thái bán | DB dùng `sale_status`; API công khai dùng `selling` (ADR-0002) |
| `data-design.md` vẽ `Payment` 1–1 với `MarketplaceOrder` | Khớp schema (`order_id` unique); tài liệu gọi là "Payment" còn code là `payments` |
| Tên thực thể trong `data-design.md` | `MarketplaceOrder` (khớp). Spec dùng tên ngắn "Order"; trong tài liệu này dùng `MARKETPLACE_ORDER` |
