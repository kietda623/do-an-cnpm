# DFD — Sơ đồ luồng dữ liệu (Data Flow Diagram)

**Dự án:** Multi-vendor Marketplace MVP
**Nguồn:** `spec.md`, `plan.md`, `data-model.md`, `contracts/api.md`, `apps/api/prisma/schema.prisma`
**Cấp độ:** Mức 0 (context) → Mức 1 (10 tiến trình) → Mức 2 (Checkout/Đơn hàng và Thanh toán, hai vùng có ràng buộc toàn vẹn cao nhất).

**Ký hiệu dùng trong Mermaid**

| Hình | Ý nghĩa |
| --- | --- |
| Hình chữ nhật `[ ]` | Tác nhân ngoài (external entity) |
| Hình tròn `(( ))` | Tiến trình (process) |
| Hình trụ `[( )]` | Kho dữ liệu (data store) |
| Mũi tên có nhãn | Luồng dữ liệu |

---

## 1. DFD mức 0 — sơ đồ ngữ cảnh

Hệ thống là một khối duy nhất (một Modular Monolith NestJS + PostgreSQL). Cổng thanh toán và vận chuyển đều **mô phỏng bên trong hệ thống**, không có tác nhân ngoài là ngân hàng hay hãng vận chuyển thật.

```mermaid
flowchart LR
  Guest["Guest"]
  Buyer["Buyer"]
  Seller["Seller"]
  Admin["Admin"]
  Sch["Scheduler<br/>tác vụ nền của hệ thống"]
  S3["Object Storage<br/>S3-compatible"]

  SYS(("0<br/>Hệ thống<br/>Marketplace"))

  Guest -- "Từ khóa, bộ lọc, sắp xếp" --> SYS
  SYS -- "Danh sách, chi tiết sản phẩm, trang shop, đánh giá công khai" --> Guest

  Buyer -- "Thông tin đăng ký, đăng nhập, hồ sơ, địa chỉ" --> SYS
  Buyer -- "Giỏ hàng, yêu cầu checkout, kết quả thanh toán mô phỏng, yêu cầu hủy, xác nhận nhận hàng, đánh giá" --> SYS
  SYS -- "Token phiên, giỏ, báo giá, đơn hàng, trạng thái tiền và giao hàng" --> Buyer

  Seller -- "Hồ sơ shop, sản phẩm, biến thể, điều chỉnh tồn, lệnh xử lý đơn, sự kiện shipment, xác nhận thu COD" --> SYS
  SYS -- "Trạng thái duyệt shop, SellerOrder của shop, đánh giá, thống kê, doanh thu mô phỏng" --> Seller

  Admin -- "Quyết định duyệt, khóa, ẩn sản phẩm, quản lý danh mục, xác nhận hàng hoàn về" --> SYS
  SYS -- "Hàng đợi duyệt shop, thống kê sàn, kết quả tra cứu đơn, nhật ký audit" --> Admin

  Sch -- "Tick kiểm tra hạn thanh toán" --> SYS
  SYS -- "Kết quả hủy phần đơn quá hạn, hoàn tồn" --> Sch

  SYS -- "Ảnh đã xác thực để lưu" --> S3
  S3 -- "URL công khai của ảnh" --> SYS
```

### Từ điển luồng dữ liệu mức 0

| Mã | Từ → Đến | Nội dung | FR liên quan |
| --- | --- | --- | --- |
| DF0-01 | Guest → Hệ thống | `q`, `categoryId`, `minPrice`, `maxPrice`, `sort`, `page` | FR-17–20 |
| DF0-02 | Hệ thống → Guest | Danh sách sản phẩm đủ điều kiện bán, chi tiết, shop ACTIVE, review | FR-16–20, 41 |
| DF0-03 | Buyer → Hệ thống | Email, mật khẩu, họ tên, địa chỉ, `cartItemIds`, `addressId`, `paymentMethod`, `Idempotency-Key` | FR-01–05, 21–25 |
| DF0-04 | Buyer → Hệ thống | Kết quả thanh toán mô phỏng (`SUCCEEDED/FAILED/CANCELLED`), yêu cầu hủy, nhận hàng, review | FR-31–36, 40 |
| DF0-05 | Hệ thống → Buyer | Access token, giỏ nhóm theo shop, quote (tổng tiền do server tính), Order, Payment, Shipment | FR-02, 23–25, 29, 39 |
| DF0-06 | Seller → Hệ thống | `ShopWrite`, `ProductCreate`, `InventoryAdjust`, lệnh confirm/pack/reject, `ShipmentEvent`, `CodCollection` | FR-07, 09, 12–15, 28, 30, 33, 38 |
| DF0-07 | Hệ thống → Seller | Trạng thái shop, SellerOrder (chỉ phần của shop mình), thống kê, doanh thu mô phỏng | FR-08, 43–45 |
| DF0-08 | Admin → Hệ thống | Duyệt/từ chối/khóa shop, `CategoryWrite`, khóa tài khoản, ẩn sản phẩm, xác nhận hàng hoàn về | FR-08, 10, 11, 15, 47–49 |
| DF0-09 | Hệ thống → Admin | Hàng đợi shop PENDING, thống kê sàn, đơn, audit | FR-46, 50 |
| DF0-10 | Scheduler → Hệ thống | Tick quét `payment_deadline` | FR-36, BR-06 |
| DF0-11 | Hệ thống ↔ Object Storage | Ảnh đã kiểm tra magic-byte/kích thước; URL công khai | BR-03 |

---

## 2. DFD mức 1 — 10 tiến trình chính

### Danh mục tiến trình

| Mã | Tiến trình | Module |
| --- | --- | --- |
| P1 | Quản lý tài khoản và phiên | `identity` |
| P2 | Quản lý cửa hàng | `shop` |
| P3 | Quản lý danh mục, sản phẩm, tồn kho, ảnh | `catalog`, `inventory` |
| P4 | Khám phá hàng hóa | `catalog` (discovery) |
| P5 | Quản lý giỏ hàng | `cart` |
| P6 | Checkout và vòng đời đơn hàng | `order` |
| P7 | Thanh toán, hoàn tiền mô phỏng | `payment` |
| P8 | Vận chuyển mô phỏng | `shipping` |
| P9 | Đánh giá và thống kê | `review` |
| P10 | Quản trị và nhật ký | `admin` |

### Danh mục kho dữ liệu

| Mã | Kho dữ liệu | Bảng PostgreSQL |
| --- | --- | --- |
| D1 | Người dùng và phiên | `users`, `sessions`, `addresses` |
| D2 | Cửa hàng | `shops`, `shop_members` |
| D3 | Danh mục và sản phẩm | `categories`, `products`, `product_images`, `product_variants` |
| D4 | Tồn kho | `inventory`, `inventory_movements` |
| D5 | Giỏ và báo giá | `carts`, `cart_items`, `checkout_quotes` |
| D6 | Đơn hàng | `marketplace_orders`, `seller_orders`, `order_items`, `order_events` |
| D7 | Thanh toán | `payments`, `payment_attempts`, `payment_allocations`, `simulated_refunds`, `payment_events` |
| D8 | Vận chuyển | `shipments`, `shipment_events` |
| D9 | Đánh giá | `reviews` — **đã thiết kế, chưa có trong `schema.prisma` (Sprint 6)** |
| D10 | Audit và idempotency | `audit_events`, `idempotency_records` |
| D11 | Tài nguyên ảnh | `assets` (+ object storage) |

### 2.1. DFD mức 1A — Định danh, Cửa hàng, Danh mục/Sản phẩm, Khám phá

```mermaid
flowchart LR
  Guest["Guest"]
  Buyer["Buyer"]
  Seller["Seller"]
  Admin["Admin"]
  S3["Object Storage"]

  P1(("P1<br/>Tài khoản<br/>và phiên"))
  P2(("P2<br/>Cửa hàng"))
  P3(("P3<br/>Danh mục, sản phẩm,<br/>tồn kho, ảnh"))
  P4(("P4<br/>Khám phá<br/>hàng hóa"))

  D1[("D1 Người dùng, phiên, địa chỉ")]
  D2[("D2 Cửa hàng, thành viên")]
  D3[("D3 Danh mục, sản phẩm, biến thể")]
  D4[("D4 Tồn kho, movement")]
  D10[("D10 Audit, idempotency")]
  D11[("D11 Assets")]

  Buyer -- "đăng ký, đăng nhập, hồ sơ, địa chỉ" --> P1
  Guest -- "đăng ký, đăng nhập" --> P1
  P1 -- "token, hồ sơ, địa chỉ" --> Buyer
  P1 <-- "băm mật khẩu, refresh hash, trạng thái khóa" --> D1
  P1 -- "sự kiện đăng nhập, khóa phiên" --> D10

  Buyer -- "yêu cầu mở shop" --> P2
  Seller -- "sửa hồ sơ, logo, banner" --> P2
  Admin -- "duyệt, từ chối, khóa, mở" --> P2
  P2 -- "trạng thái shop, lý do" --> Seller
  P2 <-- "shop, membership OWNER" --> D2
  P2 -- "audit quyết định" --> D10
  P2 -- "kiểm tra quyền sở hữu tài khoản" --> D1

  Admin -- "tạo, sửa, ẩn danh mục" --> P3
  Seller -- "sản phẩm, biến thể, ảnh, điều chỉnh tồn" --> P3
  P3 <-- "danh mục, sản phẩm, biến thể" --> D3
  P3 <-- "available_quantity, movement" --> D4
  P3 -- "kiểm tra shop ACTIVE, membership" --> D2
  P3 <-- "metadata ảnh đã xác thực" --> D11
  P3 -- "ảnh sau kiểm tra magic-byte" --> S3
  P3 -- "audit điều chỉnh tồn" --> D10

  Guest -- "từ khóa, bộ lọc, sắp xếp" --> P4
  Buyer -- "từ khóa, bộ lọc, sắp xếp" --> P4
  P4 -- "sản phẩm, shop, đánh giá công khai" --> Guest
  P4 -- "sản phẩm, shop, đánh giá công khai" --> Buyer
  D3 -- "sản phẩm đang bán, giá thấp nhất" --> P4
  D4 -- "tồn khả dụng" --> P4
  D2 -- "chỉ shop ACTIVE" --> P4
```

### 2.2. DFD mức 1B — Giỏ hàng, Đơn hàng, Thanh toán, Vận chuyển, Đánh giá, Quản trị

```mermaid
flowchart LR
  Buyer["Buyer"]
  Seller["Seller"]
  Admin["Admin"]
  Sch["Scheduler"]

  P5(("P5<br/>Giỏ hàng"))
  P6(("P6<br/>Checkout và<br/>vòng đời đơn"))
  P7(("P7<br/>Thanh toán"))
  P8(("P8<br/>Vận chuyển<br/>mô phỏng"))
  P9(("P9<br/>Đánh giá<br/>và thống kê"))
  P10(("P10<br/>Quản trị<br/>và nhật ký"))

  D1[("D1 Người dùng, địa chỉ")]
  D3[("D3 Sản phẩm, biến thể")]
  D4[("D4 Tồn kho")]
  D5[("D5 Giỏ, báo giá")]
  D6[("D6 Đơn hàng")]
  D7[("D7 Thanh toán")]
  D8[("D8 Vận chuyển")]
  D9[("D9 Đánh giá")]
  D10[("D10 Audit, idempotency")]

  Buyer -- "thêm, sửa, xóa, chọn dòng" --> P5
  P5 -- "giỏ nhóm theo shop" --> Buyer
  P5 <-- "cart, cart_items" --> D5
  D3 -- "giá hiện tại, trạng thái bán" --> P5
  D4 -- "tồn khả dụng" --> P5

  Buyer -- "cartItemIds, addressId, paymentMethod, Idempotency-Key" --> P6
  Seller -- "confirm, pack, reject" --> P6
  Buyer -- "hủy đơn, nhận hàng" --> P6
  P6 -- "quote, Order, SellerOrder" --> Buyer
  P6 -- "SellerOrder của shop" --> Seller
  D5 -- "dòng đã chọn" --> P6
  D1 -- "địa chỉ, snapshot người nhận" --> P6
  D3 -- "giá, SKU, tên để snapshot" --> P6
  P6 <-- "trừ, hoàn tồn có điều kiện" --> D4
  P6 <-- "Order, SellerOrder, OrderItem, event" --> D6
  P6 <-- "claim, replay kết quả" --> D10
  P6 -- "tạo Payment khi checkout, hủy attempt" --> P7
  P6 -- "tạo shipment khi PACKING" --> P8

  Buyer -- "tạo attempt, kết quả mô phỏng" --> P7
  Seller -- "xác nhận thu COD" --> P7
  Sch -- "tick hết hạn" --> P7
  P7 -- "Payment, allocation, refund" --> Buyer
  P7 <-- "attempt, allocation, refund, event" --> D7
  P7 -- "hủy phần PENDING quá hạn, hoàn tồn" --> P6
  D6 -- "tổng tiền, trạng thái SellerOrder" --> P7

  Seller -- "shipment event, retry" --> P8
  Admin -- "xác nhận hàng hoàn về" --> P8
  P8 -- "tracking, lịch sử" --> Buyer
  P8 -- "tracking, lịch sử" --> Seller
  P8 <-- "shipment, shipment_events" --> D8
  P8 -- "DELIVERED, hoàn tất đơn" --> P6

  Buyer -- "rating, comment" --> P9
  Seller -- "khoảng thời gian, bộ lọc" --> P9
  P9 <-- "review" --> D9
  D6 -- "SellerOrder COMPLETED, OrderItem" --> P9
  P9 -- "dashboard, doanh thu ngày/tháng mô phỏng" --> Seller

  Admin -- "khóa tài khoản, ẩn sản phẩm, tra cứu" --> P10
  P10 -- "thống kê sàn, đơn, audit" --> Admin
  P10 <-- "audit" --> D10
  P10 -- "khóa, thu hồi phiên" --> D1
  P10 -- "cờ admin_hidden" --> D3
  D6 -- "đơn, SellerOrder COMPLETED" --> P10
```

---

## 3. DFD mức 2

### 3.1. P6 — Checkout và vòng đời đơn hàng

Đây là tiến trình quan trọng nhất của sàn (SC-003, SC-004): một Order tổng, nhiều SellerOrder, trừ tồn nguyên tử, idempotent.

```mermaid
flowchart TD
  Buyer["Buyer"]
  Seller["Seller"]

  P61(("6.1<br/>Tạo báo giá<br/>checkout"))
  P62(("6.2<br/>Claim<br/>Idempotency-Key"))
  P63(("6.3<br/>Khóa và kiểm tra lại<br/>điều kiện, giá, tồn"))
  P64(("6.4<br/>Trừ tồn có điều kiện"))
  P65(("6.5<br/>Tạo Order, SellerOrder,<br/>OrderItem snapshot, Payment"))
  P66(("6.6<br/>Dọn giỏ, lưu kết quả<br/>idempotency"))
  P67(("6.7<br/>Hủy đơn<br/>hoàn tồn một lần"))
  P68(("6.8<br/>Chuyển trạng thái<br/>và tổng hợp Order"))

  D1[("D1 Địa chỉ")]
  D3[("D3 Sản phẩm, biến thể")]
  D4[("D4 Tồn kho, movement")]
  D5[("D5 Giỏ, báo giá")]
  D6[("D6 Đơn hàng")]
  D7[("D7 Thanh toán")]
  D10[("D10 Idempotency, audit")]

  Buyer -- "cartItemIds, addressId, paymentMethod" --> P61
  D5 -- "dòng đã chọn, cart.version" --> P61
  D1 -- "địa chỉ sở hữu" --> P61
  D3 -- "giá, trạng thái bán" --> P61
  P61 -- "quote có canonical_hash, hết hạn 5 phút" --> D5
  P61 -- "quote, issues theo dòng" --> Buyer

  Buyer -- "quoteId, Idempotency-Key" --> P62
  P62 <-- "IN_PROGRESS, COMPLETED, replay" --> D10
  P62 -- "key hợp lệ" --> P63

  D5 -- "quote, cart" --> P63
  D3 -- "shop ACTIVE, category, product, variant" --> P63
  P63 -- "danh sách dòng hợp lệ, lỗi theo dòng" --> P64
  P63 -- "PRICE_CHANGED, QUOTE_EXPIRED, line errors" --> Buyer

  P64 <-- "UPDATE ... WHERE available_quantity >= qty" --> D4
  P64 -- "movement SALE" --> D4
  P64 -- "đủ tồn" --> P65
  P64 -- "hết hàng thì rollback toàn bộ" --> Buyer

  P65 -- "marketplace_orders, seller_orders, order_items, deadline MOCK" --> D6
  P65 -- "payments (chưa tạo attempt COD)" --> D7
  P65 -- "order_events" --> D6
  P65 --> P66
  P66 -- "xóa đúng dòng đã mua" --> D5
  P66 -- "COMPLETED, orderId, response" --> D10
  P66 -- "Order 201" --> Buyer

  Buyer -- "cancel Order hoặc SellerOrder" --> P67
  Seller -- "reject SellerOrder, kèm lý do" --> P67
  D6 -- "trạng thái, version" --> P67
  P67 -- "CANCELLED, stock_returned_at" --> D6
  P67 -- "movement CANCEL_RETURN, unique per OrderItem" --> D4
  P67 -- "yêu cầu hoàn mô phỏng phần đã trả" --> D7

  Seller -- "confirm, pack" --> P68
  Buyer -- "receive" --> P68
  D6 -- "SellerOrder, version" --> P68
  P68 -- "trạng thái mới, order_event" --> D6
  P68 -- "derive status Order theo BR-08" --> D6
```

Thứ tự P64–P65 thể hiện luồng logic, không áp đặt thứ tự ghi. Trong `CheckoutService.create`, `MarketplaceOrder` và `SellerOrder` được tạo trước khi P64 gọi `tx.inventory.updateMany`; nếu cập nhật tồn thất bại, transaction rollback cả các dòng đã tạo trước đó.

### 3.2. P7 — Thanh toán và hoàn tiền mô phỏng

```mermaid
flowchart TD
  Buyer["Buyer"]
  Seller["Seller"]
  Sch["Scheduler"]

  P71(("7.1<br/>Tạo attempt<br/>thanh toán mô phỏng"))
  P72(("7.2<br/>Ghi kết quả<br/>attempt"))
  P73(("7.3<br/>Settle thành công<br/>tạo allocation"))
  P74(("7.4<br/>Xử lý kết quả<br/>đến muộn"))
  P75(("7.5<br/>Hết hạn 15 phút<br/>hủy phần PENDING"))
  P76(("7.6<br/>Thu COD<br/>theo SellerOrder"))
  P77(("7.7<br/>Tạo hoàn tiền<br/>mô phỏng"))

  D6[("D6 Đơn hàng")]
  D7[("D7 Thanh toán")]
  D4[("D4 Tồn kho")]

  Buyer -- "orderId" --> P71
  D6 -- "phần còn hiệu lực, deadline" --> P71
  P71 -- "attempt PENDING, snapshot phần đơn" --> D7
  P71 -- "Payment" --> Buyer

  Buyer -- "eventId, outcome, expectedVersion" --> P72
  P72 <-- "payment_events unique provider+eventId" --> D7
  P72 -- "FAILED hoặc CANCELLED, đơn vẫn PENDING" --> D7
  P72 -- "SUCCEEDED trong hạn" --> P73
  P72 -- "SUCCEEDED sau hạn hoặc sau hủy" --> P74

  P73 -- "allocation MOCK_PREPAYMENT theo SellerOrder" --> D7
  D7 -- "PaymentAttempt.targetSellerOrdersSnapshot" --> P73

  P74 -- "attempt LATE_COMPENSATION, allocation" --> D7
  P74 --> P77

  Sch -- "tick, payment_deadline đã qua" --> P75
  D6 -- "Order MOCK chưa trả" --> P75
  P75 -- "SellerOrder CANCELLED" --> D6
  P75 -- "hoàn tồn đúng một lần" --> D4

  Seller -- "eventId, expectedVersion" --> P76
  D6 -- "SellerOrder DELIVERED, số tiền" --> P76
  P76 -- "attempt COD_SIMULATION SUCCEEDED, allocation COD_COLLECTION, số tiền do server tính" --> D7

  P77 -- "simulated_refunds, unique theo allocation" --> D7
  P77 -- "Payment, refunds" --> Buyer
```

---

## 4. Quy tắc nhất quán khi đọc DFD

1. **Tiền luôn do server tính.** Mọi luồng tiền tệ ra khỏi P6/P7 là chuỗi VND nguyên (`"150000"`), không nhận số tiền từ client (FR-24, contract).
2. **Dữ liệu lịch sử không bị ghi đè.** OrderItem/Shipment/Payment event chỉ thêm, snapshot không đổi theo catalog hoặc hồ sơ.
3. **Thứ tự khóa:** Idempotency → User/Cart → Quote → Order → Payment → SellerOrders → Shop → Category → Product → Variant → Inventory → Shipment (xem `docs/database/data-design.md`). DFD mức 2 tuân theo thứ tự này.
4. **Không gọi mạng/S3 trong transaction DB.** Luồng "ảnh → Object Storage" của P3 chạy ngoài transaction; sau khi lưu object thành công, service tạo asset trực tiếp ở trạng thái VERIFIED.
5. **D9 (đánh giá) chưa có trong schema thực tế**; P9 vì vậy vẫn là thiết kế. Các luồng đến D9 sẽ bắt đầu hoạt động từ Sprint 6.
