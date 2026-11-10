# Frontend / Desktop Design and Delivery Plan

Thiết kế theo spec platform matrix; chưa có màn hình được lập trình.
API paths dưới rút gọn prefix `/api/v1`; `{s}` shopId, `{p}` productId, `{o}` Order,
`{so}` SellerOrder, `{v}` Variant, `{sh}` Shipment. DTO/errors chi tiết ở contracts/api.md.

## Quy tắc áp dụng mọi màn hình

Server data dùng TanStack Query có key user/shop/filter/page; React state cho lựa chọn UI,
RHF+Zod cho form. Không để role/shop lấy từ local state thành quyền backend.
Logout/switch user clear sensitive cache; switch shop invalidate/re-key dữ liệu quản trị.
Server money string VND, trình bày Intl theo locale; client không là nguồn giá/tổng thanh toán.
Mọi mutation disable submit khi chờ, báo success sau response đã commit; retry mutation chỉ
với idempotency key được giữ nguyên cho cùng ý định. Không tự tạo key mới vì timeout.

State pack bắt buộc cho từng hàng bên dưới:
- L=loading skeleton/progress và disable duplicate submit.
- E=empty có hướng dẫn hành động; form mới là trạng thái chưa nhập, không spinner vô hạn.
- X=error rõ, field errors cho validation;409 có reload/reconfirm, không báo thành công giả.
- S=success có dữ liệu mới đã lưu; unauthorized→login/forbidden rõ, không lộ data.
Mỗi AC dưới bao gồm đủ L/E/X/S và kiểm quyền, không chỉ happy path.
Accessibility: nhãn form, focus sau lỗi, keyboard Web/Desktop, không chỉ màu biểu thị status.
Buyer 360/1280 hiển thị đủ nút; desktop buyer dùng cùng breakpoint responsive, không cần layout thứ hai.

## Buyer Web — Owner M3, reviewer theo WBS

| ID / màn hình / Sprint | Mục tiêu & components | API cần tích hợp | State/validation riêng | AC và kiểm thử chính |
| --- | --- | --- | --- | --- |
| B01 Home S3 | Khám phá: Header, SearchBox, CategoryNav, ProductGrid | GET categories; GET products | category/query/page; L/E/X/S | Guest xem hàng hợp lệ, click tới detail, không copy assets thương hiệu |
| B02 Register/Login S2 | Form email/password/fullName, session controls | auth/csrf, auth/register, login/refresh/logout | Email valid/unique, password1–128, fullname1–120; memory token | US1 đúng/sai login, logout bị revoke, CSRF/429 rõ |
| B03 Product List S3/4 | ProductCard/Grid/Pagination | GET products | page/filter/sort URL state, max pageSize100 | Chỉ hàng công khai, stable pagination, hết hàng có nhãn |
| B04 Search & Filters S4 | SearchBox, category/price filters, SortSelect | GET products?q/categoryId/minPrice/maxPrice/sort | q<=200, min<=max, money nguyên VND | US4 đúng filters/sort, empty query result có reset |
| B05 Product Detail S3 | Gallery, VariantPicker, StockLabel, AddToCart, Reviews | GET products/{p}; POST cart/items; GET products/{p}/reviews S6 | variantId/quantity positive, stock display không là authority | Chọn variant đổi giá/tồn, cannot buy stopped/out-of-stock; review list S6 |
| B06 Public Shop S3 | ShopHero/ProductGrid | GET shops/{s}; shops/{s}/products | shopId/page; private contact omitted | Chỉ ACTIVE, hidden shop404, không lộ management fields |
| B07 Cart S4 | ShopCartGroup, QuantityInput, SelectedSummary | GET cart; POST/PATCH/DELETE cart/items | selectedIds/quantity, stock issue per line | US5.1 group/select/edit/delete; selected subset không ảnh hưởng dòng khác |
| B08 Checkout S5 | AddressPicker, QuoteSummary, PaymentMethod, ConfirmDialog | users/me/addresses; POST checkout/quotes; POST checkout | owned address, selectedIds, quoteId5min, Idempotency-Key | US5 all-or-none, changed-price reconfirm; persisted same order on retry |
| B09 Order List S5 | OrderCards, StatusFilter, pagination | GET orders | own orders, status/payment/date/page | Buyer chỉ thấy đơn mình, aggregate/partial cancellation rõ |
| B10 Order Detail/Payment S5 | SellerOrderSections, snapshots, timeline, cancel/receive/mock panel | GET orders/{o}; payments?orderId; shipments/{sh}; orders cancel/receive; mock-attempts/mock-result | version/key, eligible action theo trạng thái, countdown chỉ hướng dẫn | US6/7, hiển thị full vs part cancel/refund; timeout tra cứu trước retry |
| B11 Profile S2/S3 image | ProfileForm, AvatarUpload, PasswordDialog | users/me GET/PATCH; users/me/password; users/me/assets S3 | current password khi đổi, phone/name, owned valid image<=5MB | Hồ sơ own only, revoke other sessions, upload invalid field error |
| B12 Addresses S2 | AddressList/Form, DefaultBadge | users/me/addresses GET/POST/PATCH/DELETE | required recipient/phone/line1/ward/district/province, one default | Add/edit/delete/default đúng, snapshot đơn không đổi |
| B13 Review from order S6 | Rating1–5, CommentForm, ExistingReview | POST reviews; GET products/{p}/reviews | completed own OrderItem, one review/item, comment<=2000 | US8.1 duplicate409, chưa complete422, existing review read-only |

## Seller Center Web — Owner M4

| ID / màn hình / Sprint | Mục tiêu & components | API cần tích hợp | State/validation riêng | AC và kiểm thử chính |
| --- | --- | --- | --- | --- |
| S01 Shop Registration S3 | ShopForm/LogoUpload/slug | POST shops; users/me/assets | name/slug/contact/phone/description/logo; owned asset | US2 tạo PENDING, slug duplicate409, không tự ACTIVE |
| S02 Approval Status S3 | DecisionBanner, reason, Resubmit | GET shops/{s}/management; POST resubmit | current status/version, rejected editable | PENDING không publish; rejected có reason; resubmit đúng quyền |
| S03 Dashboard S6 | ShopSwitcher, CountsCards, PendingOrders, ReviewPreview | users/me/shops; shops/{s}/stats/reviews | shop key/date range | Không lẫn shop, totals đúng BR10, doanh thu mô phỏng có nhãn |
| S04 Product Management S3 | ProductTable, SellToggle, filters | shops/{s}/management/products; product PATCH | q/status/page/version | Own stopped/hidden visible quản trị, không mất lịch sử |
| S05 Create/Edit Product S3 | ProductForm/Gallery/Category/VariantEditor | categories; shops/{s}/products POST; product GET management/PATCH; assets | title/category/image, positive money, >=1variant, own asset | SKU duplicate field error, all variants atomic, snapshots cũ nguyên |
| S06 Variants & Inventory S3/4 | SKU table, VariantEditor, StockAdjustmentDialog | variants POST/PATCH; inventory GET; inventory-adjustments POST | SKU unique/shop, delta integer, expectedVersion, reason/key | Concurrent stock409 reload, không ghi đè hoặc âm tồn |
| S07 Order List S5 | ScopedOrdersTable, StatusTabs | shops/{s}/orders | status/date/page, selected shop | Chỉ SellerOrder của shop; count/filter khớp |
| S08 Order Detail/Fulfillment S5 | ItemsSnapshot, address needed to deliver, transitions, shipment panel | shops/{s}/orders/{so}, confirm/pack/reject; shipments events/retry; cod-collection | state/version/key/reason, COD chỉ sau DELIVERED | US7 đúng state, fail/retry không hoàn tồn sớm; wrong shop404 |
| S09 Revenue S6 | Day/MonthTable, summary, export ngoài MVP | shops/{s}/revenue; stats | groupBy/day/month, from<to, Asia/Saigon | SC008 completed only, không cộng hủy; mô phỏng không đối soát thật |
| S10 Shop Settings S3 | ShopInfoForm/LogoBanner/PublicPreview | shops/{s}/management GET/PATCH; assets; public shop | immutable slug after approval, version | Edit name/logo/banner, foreign asset denied, public/private projection đúng |
| S11 Reviews S6 | ReviewTable, product/rating filters | shops/{s}/reviews | productId thuộc shop,1–5 | Xem đúng review shop, không sửa/xóa/phản hồi Buyer |

## Admin Web — Owner M4, domain API M1/M2

| ID / màn hình / Sprint | Mục tiêu & components | API cần tích hợp | State/validation riêng | AC và kiểm thử chính |
| --- | --- | --- | --- | --- |
| A01 Dashboard S6 | CountsCards, CompletedGMVTable | admin/stats | date range, label counts statuses | Total users/shops/products/Orders, no double-count GMV |
| A02 Users S6 | SearchTable, Lock/UnlockReasonDialog | admin/users GET; lock/unlock POST | role guard/reason/version | Khóa revoke sessions, mở không hồi sinh, no hashes/token |
| A03 Shop Approval S3 | PendingQueue/ShopDetail/ApproveReject | admin/shops; approve/reject | PENDING/version, reject reason | US2 decision, audit actor/time/reason |
| A04 Shop Management S3 basic/S6 inquiry | ShopSearch/StatusAction | admin/shops; suspend/resume | ACTIVE/SUSPENDED, reason/version | Khóa chặn mua mới, đơn cũ vẫn xử lý có quyền |
| A05 Categories S3 | CategoryTree/Edit/HideDialog | admin/categories POST/PATCH; categories | parent!=self/descendant, version | Cycle rejected, hidden chặn publish/mua mới |
| A06 Product Moderation S6 | ProductSearch/Preview/HideReason | admin/products GET; hide POST | reason/version, no direct transaction edit | Hide không xóa snapshot, actor audit |
| A07 Order Inquiry S6 | OrderSearch, parts/payment/timeline/audit | admin/orders GET/detail; admin/audit; recovery actions | read-only final, recovery action guard reason/key | Xem mọi đơn, không sửa final; failed return-confirmation hoàn đúng1lần |

## Buyer Desktop — Tauri wrapper, demo Windows local đã nghiệm thu

Buyer desktop dùng lại nguyên bộ B01–B13 của web storefront trong một cửa sổ Tauri; không có slice UI riêng. Phạm vi đã triển khai và nghiệm thu là demo local trên Windows 11 x64 với WebView2, storefront `http://localhost:3000` và API local.

- Tauri mở storefront local; CSP/allow-list tối thiểu, không shell/filesystem IPC tùy ý.
- Dùng cùng auth contract: refresh cookie HttpOnly + CSRF của webview; không có token store native; access token chỉ trong memory.
- B02 đăng nhập qua webview; B08/B10 giữ retry key theo phiên ý định và refetch khi cửa sổ focus lại.
- T140–T145 và SC-009 đã được nghiệm thu với session restore, flow Buyer và evidence ghi ở [desktop-evidence.md](../../docs/testing/desktop-evidence.md).
- Không yêu cầu URL public, HTTPS production hoặc installer; không mở rộng acceptance sang hệ điều hành desktop khác. Không có client mobile; B01–B13 trên web là nguồn hành vi duy nhất.

## Integration contract và exit gates

W004 S1 thiết kế OpenAPI/examples, W011 S2 runtime schema, W027 S4 order contract freeze;
UI mocks lấy cùng example fixtures, không tự giả status/money shape.
Mỗi màn hình chạy đủ state pack L/E/X/S cùng unauthorized. Screenshot chỉ là evidence UI,
nghiệp vụ phải đối chiếu record/response từ API thật. Test từng phiên bản target ghi OS/device,
server release và commands. Polishing không vượt gate correctness/security.


## Dependency và ngân sách desktop

Desktop buyer không nằm trong baseline MVP ban đầu; T130 mobile đã de-scoped và phần desktop được triển khai bổ sung thành demo Tauri local trên Windows theo T140–T145. Không có cam kết đóng gói/phát hành desktop. Evidence riêng cho demo desktop vẫn cần được phân biệt với web pass; SC-009 đã được nghiệm thu trong phạm vi local nêu trên.

## Giao diện hiện tại — Signal Dispatch

Ba web app đã được thiết kế lại theo hệ **Signal Dispatch** trong [DESIGN.md](../../DESIGN.md): nền giấy xám-lục, mực xanh-đen, accent teal, tín hiệu cam, chữ mono cho dữ liệu. Không thay đổi luồng dữ liệu, contract API, polling hay copy tiếng Việt.

- **Theme**: `data-theme` (light/dark đã resolve) + `data-theme-mode` (system/light/dark), mặc định theo hệ điều hành, lưu ở `localStorage["marketplace-theme"]`, chống FOUC bằng script inline trong `<head>`. Nút `ThemeToggle` nằm trong header storefront và topbar console; chuyển bằng view transition khi trình duyệt hỗ trợ, tức thời khi `prefers-reduced-motion`.
- **Typography**: Space Grotesk (display), Be Vietnam Pro (body/UI), IBM Plex Mono (ID, SKU, tiền, nhãn rail), đều có subset tiếng Việt qua `next/font`.
- **Order Rail**: primitive dùng chung ở hero storefront, chi tiết đơn buyer/admin, dashboard và queue seller, aside đăng nhập. Bước hiện tại lấy từ trạng thái API thật (`PENDING → CONFIRMED → SHIPPING → COMPLETED`, `CANCELLED` là trạng thái cuối); có biến thể compact cho bảng.
- **Shell**: storefront max 1320px, header 72px; console sidebar 264px/topbar 64px, content max 1480px; dưới 760px search storefront xuống hàng để không tràn ngang.
- **Motion**: reveal theo viewport, route enter, stagger, spring hover, theme sweep; tất cả tắt theo `prefers-reduced-motion` và không replay khi polling im lặng.
- **Giữ nguyên hook e2e**: `mp-account`, `mp-badge`, `mp-chart`, `mp-console__context-name`, `mp-menu__panel`, `mp-mobile-menu__panel`, `mp-note`, `mp-panel`, `mp-skeleton--block`, `mp-stat`, `[aria-busy="true"]` chỉ dùng cho tải thật.

Kiểm chứng: unit `@marketplace/ui-web` (gồm theme resolver), typecheck/lint 3 app, build production 3 app, cùng các spec `theme-storefront`, `theme-seller`, `theme-admin` và toàn bộ suite buyer/seller/admin hiện có.
