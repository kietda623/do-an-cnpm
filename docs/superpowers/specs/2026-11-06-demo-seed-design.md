# Thiết kế seed demo Marketplace

Ngày: 2026-11-06
Phạm vi: T150 — seed riêng cho demo local trên PostgreSQL disposable.

## Mục tiêu

Tạo lệnh `seed:demo` có thể chạy lặp lại để tạo chính xác 10 shop và 1.000 sản phẩm demo, cùng các account/order fixture cần thiết cho demo Desktop sau này. Giữ nguyên các lệnh seed hiện có và không sửa dữ liệu giao dịch hay tồn kho đã thay đổi khi chạy lại.

## Các cách đã cân nhắc

1. Mở rộng `seed:shops`, `seed:catalog` và các seed giao dịch hiện có. Cách này ít file mới nhưng trộn fixture phục vụ test/US với dữ liệu demo và có thể làm thay đổi giả định của các seed hiện hành.
2. Reset database rồi nạp toàn bộ demo từ đầu. Cách này tạo trạng thái đều nhưng phá dữ liệu giao dịch hiện có, trái yêu cầu seed lặp lại không reset.
3. Thêm lệnh `seed:demo` riêng, chỉ thêm/upsert bản ghi demo có stable keys, không xóa dữ liệu và không cập nhật trạng thái giao dịch/tồn kho đã tồn tại. Đây là hướng được chọn vì cô lập bộ dữ liệu demo và cho phép chạy lại an toàn trên namespace disposable.

## Ràng buộc

- Chỉ chấp nhận `TEST_DATABASE_URL` trỏ tới PostgreSQL có tên database kết thúc bằng `_test` hoặc `_disposable`, và `TEST_DATABASE_NAME_CONFIRMATION` phải khớp chính xác tên database.
- Không fallback sang `DATABASE_URL`; không reset, truncate, xóa hoặc migrate database.
- Mật khẩu bootstrap bắt buộc lấy từ environment, không có mật khẩu mặc định, không in mật khẩu/hash/token ra log và không commit secret.
- Stable keys/UUIDs cho fixture; không sinh dữ liệu ngẫu nhiên theo từng lần chạy.
- Các account, shop, danh mục, sản phẩm và asset metadata được tạo theo stable key. Transaction/order/payment/refund/shipment fixtures chỉ được tạo khi chưa tồn tại; lần chạy sau không đưa chúng về trạng thái ban đầu.
- Không sửa migration, API contract hoặc seed test hiện có.

## Dữ liệu đề xuất

- 10 seller accounts, mỗi account sở hữu một shop ACTIVE có slug ổn định; con số 10 shop/1.000 sản phẩm là số dòng thuộc namespace seed demo, không phải tổng database. Dữ liệu khác được giữ nguyên.
- 1 buyer ACTIVE và 1 buyer LOCKED; account dùng email ổn định trong namespace `demo-*.example.test`, không trùng `IDENTITY_*`; mật khẩu lấy từ ba biến môi trường riêng: `DEMO_SELLER_PASSWORD`, `DEMO_BUYER_PASSWORD`, `DEMO_LOCKED_BUYER_PASSWORD`. Seed demo tự tạo account, không phụ thuộc `seed:identity`.
- Tạo 10 danh mục VISIBLE có slug `demo-category-01`…`demo-category-10`. 1.000 sản phẩm chính xác: 100 sản phẩm mỗi shop; sản phẩm demo được chia ổn định giữa các danh mục. Có một sản phẩm fixture bị ẩn bằng `adminHidden`, vẫn nằm trong tổng 1.000.
- Mỗi sản phẩm có một variant và inventory ban đầu được tạo một lần. Re-run không cập nhật `availableQuantity`.
- Asset ảnh chỉ là metadata VERIFIED với object key ổn định, theo quy ước seed hiện có; uploader là seller tương ứng, `shopId` trỏ shop sở hữu asset; seed không giả vờ upload bytes lên object storage. Tài liệu nêu rõ để giao diện không phụ thuộc ảnh thật.
- Bộ giao dịch nhỏ, có khóa ổn định và public number riêng: `DEMO-PENDING-COD-001`, `DEMO-EXPIRED-MOCK-001`, `DEMO-REFUNDED-MOCK-001`, `DEMO-COMPLETED-COD-001`. Refund fixture theo mẫu đang có trong seed US8: `CANCELLATION` sau capture MOCK thành công. Tồn kho tạo ở mức 25 mỗi variant. Movement `INITIAL`, giữ/bán, và `CANCEL_RETURN` được thêm đúng một lần trong transaction cùng tồn kho; cancellation/refund trả tồn, còn order chưa hủy và completed COD tiếp tục giữ một đơn vị. Do đó tồn hiện tại được suy ra từ movement ledger và không bị reset khi seed chạy lại. Movement gắn `orderItemId` phải đặt rõ `effectType: SALE` cho SALE và `effectType: RESTORE` cho CANCEL_RETURN để thỏa unique key `(orderItemId, effectType)`.

## Hình dạng triển khai

- Thêm `apps/api/prisma/seed/demo.seed.ts` và script `seed:demo` vào `apps/api/package.json`, dùng loader Prisma/TypeScript giống các seed hiện hữu.
- Tách phần deterministic IDs/fixture plan thành helper thuần để kiểm thử số lượng, stable keys, 10×100 và trạng thái fixture mà không cần kết nối DB.
- Dùng Prisma create-if-absent/upsert có `update: {}` cho bản ghi cần bất biến khi chạy lại; các thao tác theo shop được chia transaction nhỏ để tránh một transaction lớn cho 1.000 sản phẩm.
- Dùng operation key có namespace ổn định, như `demo:inventory:<fixture>:<variantId>:<effect>`, `demo:order:<fixture>:<transition>` và `demo:shipment:<fixture>:<transition>`; unique key hiện có của database là điểm chống trùng cho movement/event.
- Ghi hướng dẫn lệnh, environment variables, database guard, số lượng kỳ vọng, và giới hạn asset metadata trong README hoặc tài liệu seed phù hợp.
- Chỉ cập nhật ghi chú T150 nếu có quy ước tài liệu; không đánh dấu hoàn tất khi dependency T149 chưa được nghiệm thu.

## Các quyết định để người triển khai áp dụng

- Đếm 10 shop/1.000 sản phẩm theo các stable keys của seed demo, vì seed phải giữ dữ liệu không thuộc namespace này.
- Dùng refund do hủy sau mock capture thành công, cùng loại fixture đã có ở `reviews-statistics.seed.ts`.
- Khởi tạo tồn kho 25 cho mỗi variant và ghi movement fixture đúng hiệu ứng; lần chạy lại không chỉnh số lượng.
- Dùng seller sở hữu shop làm uploader cho asset; dù schema không có constraint buộc uploader phải là shop owner, cách này giữ ý nghĩa dữ liệu nhất quán.
- Tạo danh mục, event actor và public number trong namespace demo; shipment event dùng seller tương ứng làm actor. `IDENTITY_*` seed không được xem là prerequisite và không tác động locked demo buyer.

## Kiểm chứng dự kiến

- Unit test cho deterministic fixture plan và đúng 10 shop × 100 sản phẩm.
- Chạy seed hai lần trên một PostgreSQL disposable riêng, xác nhận số lượng ổn định và mọi trạng thái giao dịch/tồn kho giữ nguyên giữa hai lần chạy.
- Xác nhận lệnh từ chối URL không đúng namespace hoặc thiếu xác nhận chính xác.
- Chạy lint/typecheck và các kiểm tra liên quan tới API/seed; ghi rõ những lệnh không chạy được.

## Điểm cần reviewer xác nhận

T150 hiện phụ thuộc T149, đang chưa tick trên `origin/main`. Thay đổi có thể được chuẩn bị và đẩy lên nhánh để review, nhưng T150 sẽ vẫn mở cho tới khi có bằng chứng hoàn tất T149. Account `DEMO_LOCKED_BUYER_PASSWORD` chỉ dùng để chứng minh luồng đăng nhập bị khóa trên database disposable.
