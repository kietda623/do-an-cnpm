# Frontend / Mobile / Desktop Design and Delivery Plan

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
Buyer 360/1280 hiển thị đủ nút; native có safe-area/back navigation phù hợp, không copy Desktop layout.

## Buyer Web — Owner M3, reviewer theo WBS

| ID / màn hình / Sprint | Mục tiêu & components | API cần tích hợp | State/validation riêng | AC và kiểm thử chính |
| --- | --- | --- | --- | --- |
| B01 Home S3 | Khám phá: Header, SearchBox, CategoryNav, ProductGrid | GET categories; GET products | category/query/page; L/E/X/S | Guest xem hàng hợp lệ, click tới detail, không copy assets thương hiệu |
| B02 Register/Login S2 | Form email/password/fullName, session controls | auth/csrf, auth/register, login/refresh/logout | Email valid/unique, password12–128, fullname1–120; memory token | US1 đúng/sai login, logout bị revoke, CSRF/429 rõ |
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

## Buyer Mobile — M5 core S6, M3 completion S7

Từng B01–B13 đều bắt buộc trên Android/iOS, không chỉ6 route mẫu của prompt planning.
Reuse generated api-client/DTO/validation/tokens, không reuse DOM/ui-web.
B02 refresh Expo SecureStore; B08/B10 giữ key retry trên phiên ý định, app resume refetch;
không chạy cron hết hạn trong client, server deadline là authority.

| Mobile slice | Components/native adaptation | API/state/validation | Sprint/task | Nghiệm thu |
| --- | --- | --- | --- | --- |
| B02 + B01/03 spike | Native forms, navigation, FlatList | Cùng DTO B02, secure adapter, account cache | S4 W032 / T130 | Android và iOS login→list smoke; không plain token |
| B01/03/04/05/06 | Native search/filter modal, gallery, variant sheet | API/validation như bảng Buyer, abort stale search | S6 W048 — mở rộng app đã thử S4 | US4 thật, safe-area/back, correct min-price/filter |
| B07/08/09/10 | Cart sections, address/payment sheet, order timeline | Cart/quote/orders/payments; retry keys/poll on foreground | S6 W048 + M3 support W046 | US5–7; split, cancel/refund, network recovery |
| B11/12 | Native profile/address forms/photo picker | Own-user endpoints, secure password flow/image checks | S6 W048 — mở rộng app đã thử S4 | US1, default address/snapshot đúng |
| B13 + rating views | Native rating/comment + review list | reviews completed-item constraint | S7 W054 | One review/item, async errors/unauthorized |
| All B01–13 | Touch targets, accessibility labels, offline error views | Device/session switching cache clear | S7 W054/056 | SC009 hai OS, evidence flow không chỉ build |

## Seller Desktop — M4, M5 reviewer/build hỗ trợ

Tauri2 + React/Vite bundles local. S01–S11 đầy đủ tương ứng Seller Web, gồm đăng ký/approval,
profile/assets và reviews, không chỉ order table. Reuse client-only views/components,
platform adapter thay auth transport/navigation/file selection.
CSP/permissions hạn chế, không unrestricted shell/filesystem hoặc remote content có IPC.
Refresh Stronghold vault khóa bằng mật khẩu người dùng nhập; không hardcode master password;
access memory, logout revoke/xóa secret. Thiếu vault/unlock phải login lại, không fallback plaintext.

| Slice | Sprint/task | State/validation/API | Acceptance |
| --- | --- | --- | --- |
| Design/static sharing/login spike | ADR S1; smoke foundation S2; shell S6 W047 | Same auth contract, HTTPS origin allowlist, native adapter | Không import Next server APIs; Windows smoke/Mac build access kiểm sớm |
| S01–S06/S10 | S7 W055 | Shop/catalog/assets/inventory; shared form validation/version conflict | Đăng/duyệt shop, tạo/edit variant, stock không lost-update trên Windows/macOS |
| S03/S07–S09/S11 | S7 W055 | Stats/order/shipping/reviews endpoints same as Seller | US7/8, chỉ shop mình, COD correct, mô phỏng rõ |
| Packaging/install/run | S7 W057/S8 W062 | OS runner Rust/MSVC/WebView2 hoặc macOS/Xcode | Artifacts checksum/version, fresh target launch + login/logout/stock/fulfill; build không thay run evidence |

## Integration contract và exit gates

W004 S1 thiết kế OpenAPI/examples, W011 S2 runtime schema, W027 S4 order contract freeze;
UI mocks lấy cùng example fixtures, không tự giả status/money shape.
Mỗi màn hình chạy đủ state pack L/E/X/S cùng unauthorized. Screenshot chỉ là evidence UI,
nghiệp vụ phải đối chiếu record/response từ API thật. Test từng phiên bản target ghi OS/device,
server release và commands. Polishing không vượt gate correctness/security.


## Dependency và ngân sách Mobile

T130 (S4/W032/2 PD) chỉ dùng foundation, identity và discovery; không chờ Admin, checkout hoặc review. Core login/SecureStore/list được giữ và mở rộng cho S6. Test matrix đầy đủ và acceptance đa nền tảng vẫn ở S6–7; không coi smoke S4 là hoàn thành Buyer Mobile.
