# Thiết kế lại Marketplace theo hướng Shopee

Trạng thái: người dùng đã duyệt “Duyệt, triển khai luôn” ngày 2026-11-09. Hướng hình ảnh do người dùng chọn: “y chang Shopee”.

## Kết quả mong muốn

Buyer phải nhìn và dùng như một sàn mua sắm ngay khi mở trang: tìm kiếm, danh mục, hình sản phẩm và giá dẫn dắt bố cục. Seller và Admin có mật độ thông tin, điều hướng và thao tác giống công cụ vận hành của sàn. Đây là thay đổi toàn bộ hệ thống giao diện của 33 route hiện có, không chỉ đổi màu trang chủ.

Thay thế định hướng Signal Dispatch trong `DESIGN.md` bằng định hướng thương mại cam–trắng. Giữ tên Marketplace, dữ liệu, API, quyền, route, form, handler và các chức năng hiện có. Không thêm giảm giá, voucher, lượt bán, chứng nhận hay dịch vụ mà API chưa hỗ trợ.

## Tham chiếu và hai skill

- Hallmark: full redesign của các app screen, giữ wiring; token hóa, focus rõ, kiểm tra responsive và review hình ảnh. Yêu cầu mới của người dùng thay thế màu và bố cục đã khóa trước đây.
- Taste: nhịp khoảng cách, cạnh thẳng hàng, typography, hình sản phẩm, chất lượng control và micro-interaction. Các quy tắc landing page toàn màn hình không áp dụng cho danh mục hàng hóa hoặc bảng vận hành.
- Tham chiếu chính: https://shopee.vn, lấy HTML ngày 2026-11-09. Màu `#ee4d2d` hiện diện trong nguồn trang; đây là bằng chứng màu tham chiếu, không đoán từ trí nhớ. Tái hiện ngôn ngữ bố cục với tên và dữ liệu Marketplace, không thay tên ứng dụng thành Shopee.

Baseline: commit `e5f6d60`, nhánh triển khai `codex/shopee-marketplace-redesign`. Sáu ảnh desktop/light và phone/dark của ba app được giữ tại `test-results/shopee-redesign/before/` (fixture API của lần kiểm tra trước). API local trả ready 200, nhưng public products và categories hiện đều rỗng. Do đó review bố cục có hàng hóa sẽ dùng fixture được ghi rõ; dữ liệu rỗng thật vẫn phải hiển thị empty state đúng, không tự thêm hàng hoặc ưu đãi vào database.

## Hệ thống giao diện

- Nền trang xám rất nhạt, các vùng nội dung trắng, cam là màu hành động và giá. Viền mảnh, radius 2–6px, bóng nhẹ; bỏ hiệu ứng nền xanh ngọc, ánh sáng và khối bo lớn của Signal Dispatch.
- Be Vietnam Pro cho nội dung và tiêu đề; chữ số tabular cho tiền và bảng. Mono chỉ dùng cho mã kỹ thuật dài khi cần. Tiêu đề trang 22–28px, nội dung 14–16px; không dùng tiêu đề display khổng lồ trong màn hình quản lý.
- Cam tham chiếu dùng cho điểm nhận diện; màu control và cặp màu chữ/nền được kiểm tra tương phản. Các trạng thái thành công/cảnh báo/nguy hiểm vẫn có màu semantic riêng.
- Container Buyer khoảng 1200–1280px. Console có sidebar khoảng 220–240px và vùng làm việc linh hoạt. Khoảng cách desktop 16–24px, mobile 8–16px.
- Mặc định hướng hình ảnh sáng như sàn mua sắm; giữ lựa chọn sáng/tối/hệ thống và theme đã lưu của người dùng. Không làm mất cơ chế phục hồi phiên hoặc bản sửa animation.
- Focus xuất hiện ngay; hover nhẹ; reduced motion tắt animation không cần thiết. Không animation khiến hàng hóa hoặc bảng bị ẩn trong lúc tải trang.

## Buyer

1. Header cam: thanh tiện ích gọn, thương hiệu Marketplace, ô tìm kiếm trắng rộng ở trung tâm, giỏ hàng và tài khoản. Tìm kiếm giữ URL/query và các hook hiện có; mobile đưa ô tìm kiếm sang hàng riêng.
2. Trang chủ: khối mở đầu ngắn, danh mục nổi bật và lưới sản phẩm lên gần đầu trang. Phần giải thích đơn nhiều cửa hàng và Order Rail hiện có thu gọn thành hướng dẫn hỗ trợ, không còn chiếm gần toàn bộ màn hình đầu.
3. Danh mục và tìm kiếm: filter sidebar ở desktop; mobile xếp/chốt bộ lọc trong vùng gọn. Thanh sắp xếp rõ, tổng kết quả và phân trang giữ đúng metadata API.
4. Card sản phẩm: ảnh vuông, tên tối đa hai dòng, giá cam rõ, tình trạng hàng, thông tin cửa hàng và đánh giá từ dữ liệu thật. Desktop 5–6 cột khi đủ rộng; tablet 3–4; điện thoại 2. Sản phẩm thiếu ảnh có trạng thái trung tính rõ ràng, không dùng ảnh của mặt hàng khác.
5. Chi tiết sản phẩm và cửa hàng: nền trắng, thư viện ảnh trái, thông tin/biến thể/số lượng/mua hàng phải; xuống một cột ở mobile. Giữ đánh giá, tồn kho và liên kết cửa hàng thật.
6. Giỏ/checkout: nhóm hàng theo cửa hàng, tổng tiền và nút chính nổi bật; giữ quote, payment, địa chỉ và trạng thái lỗi. Không tạo phí hoặc ưu đãi giả để lấp giao diện.
7. Hồ sơ/địa chỉ/đơn hàng: sidebar tài khoản, form và danh sách trắng gọn; tab trạng thái đơn, giá và thao tác rõ. Order Rail chỉ ở chỗ thực sự mô tả tiến trình đơn.
8. Đăng nhập/đăng ký: form trắng rõ trên nền cam nhạt, liên kết chuyển form hiện có; không thêm phương thức đăng nhập chưa được triển khai.

## Seller

- Shell kiểu Seller Centre: header trắng, logo/điểm nhấn cam, chọn cửa hàng và tài khoản ở header; sidebar trắng với active item cam.
- Dashboard ưu tiên các việc cần xử lý: đơn chờ xác nhận, đang xử lý, sản phẩm, sau đó biểu đồ và doanh thu. Số liệu vẫn lấy từ API và giữ nhãn mô phỏng.
- Đơn hàng/sản phẩm: toolbar, tab, filter, bảng, phân trang; action chính cùng vị trí và kích thước nhất quán. Dialog xác nhận, lý do từ chối và inventory editor giữ nguyên hành vi.
- Cửa hàng, hồ sơ mở shop, settings, analytics và reviews dùng cùng nhịp form/bảng. Giữ đăng ký tài khoản, shop pending và quyền membership.

## Admin

- Cùng hệ control và shell trắng–cam, có tên Marketplace Admin để phân biệt bối cảnh.
- Dashboard ưu tiên hàng chờ duyệt và công việc vận hành, KPI gọn, bảng hoạt động/audit rõ; không trang trí như landing page.
- Users, shops, products, categories, orders, returns và audit đồng bộ thanh lọc, bảng, empty/loading/error, dialog và pagination. Mọi guard quyền và lý do của thao tác nhạy cảm được giữ.
- `/shipments` vẫn là redirect hiện có; Seller `/` vẫn điều hướng theo membership.

## Phạm vi file và triển khai

Sửa `DESIGN.md`, token CSS, shared CSS/shell/primitives và markup của các trang/features cần đổi bố cục trong ba app. Chia CSS mới thành các phần có trách nhiệm rõ thay vì nối thêm một lớp ghi đè lớn vào file hơn 6.000 dòng. Không xóa route hay thay toàn bộ logic component. Không thêm UI library, endpoint hoặc migration.

Thứ tự: hệ token/control → Buyer shell/home/catalog → detail/cart/checkout/account/orders/auth → Seller shell/screens → Admin shell/screens → audit responsive và regression.

## Nghiệm thu

- Kiểm kê 33 route và ghi rõ route redirect. Tất cả dùng hệ giao diện mới; không còn phần Signal Dispatch xanh ngọc sót ngoài dữ liệu có ý nghĩa semantic.
- Ảnh trước/sau và review các màn hình chính ở 1440, 1024, 768, 390px; kiểm tra thêm 360px cho header, card và form. Không overflow toàn trang; bảng có vùng cuộn riêng.
- Buyer thấy được hàng hóa và giá sớm; sản phẩm có thể tìm, lọc, mở, thêm giỏ và checkout. Seller có thể mở cửa hàng/sản phẩm/đơn; Admin có thể mở hàng chờ duyệt và audit.
- Form giữ dữ liệu khi lỗi, loading/empty/error phân biệt được; keyboard focus, dialog, mobile nav và reduced motion hoạt động.
- Chạy typecheck, lint, unit tests, production build; chạy các browser suite hiện có và bổ sung regression có ý nghĩa cho các thay đổi hành vi hiển thị mới.
- Phân biệt test dùng API giả lập với luồng API thật trong handoff. Chạy Hallmark/Taste audit, sửa lỗi thật và ghi rõ những heuristic không áp dụng cho app thương mại.

Không tự push, tạo PR hoặc merge trong bước redesign nếu chưa có yêu cầu mới cho phần thay đổi này.
