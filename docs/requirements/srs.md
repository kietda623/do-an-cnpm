# Software Requirements Specification — Marketplace MVP

**Trạng thái:** Baseline yêu cầu đã đối chiếu với feature spec.  
**Nguồn chuẩn:** [`specs/001-marketplace-mvp/spec.md`](../../specs/001-marketplace-mvp/spec.md), các business rule BR-01–BR-10.  
**Phạm vi:** MVP marketplace nhiều người bán trên Web, Android, iOS và Desktop. Tài liệu này lập chỉ mục actor, use case và tiêu chí nghiệm thu; mã FR và BR trong feature spec vẫn là nguồn chi tiết để tránh hai bản đặc tả trôi lệch.

## Mục tiêu và phạm vi

Buyer/Guest khám phá hàng hóa; Buyer mua hàng đa shop và theo dõi giao dịch; Seller quản lý shop, catalog, tồn và đơn của shop mình; Admin duyệt và điều hành sàn. MVP dùng COD và cổng thanh toán mô phỏng, vận chuyển mô phỏng, không xử lý tiền thật. Toàn bộ 50 FR và 10 SC thuộc phạm vi đã chốt. Các giới hạn ngoài MVP được ghi trong phần Scope Boundaries của feature spec.

## Actor

| Actor | Quyền và mục tiêu chính |
| --- | --- |
| Guest | Duyệt, tìm kiếm, lọc sản phẩm và xem shop/sản phẩm/đánh giá công khai; không tạo giao dịch. |
| Buyer | Quản lý tài khoản, địa chỉ, giỏ; checkout; theo dõi đơn/tiền/giao hàng; đánh giá đơn đủ điều kiện. Một tài khoản Buyer vẫn giữ quyền Buyer khi có membership Seller. |
| Seller | Người dùng có ShopMember ACTIVE với vai trò OWNER hoặc MANAGER; chỉ thao tác trong shop được cấp quyền. |
| Admin | Tài khoản được cấp system role ADMIN; duyệt/khóa theo quy tắc, kiểm duyệt và truy vấn phục vụ xử lý sự cố. |
| System/Scheduler | Thành phần tin cậy xử lý expiry, callback/payment events, audit và các tác vụ mô phỏng theo cùng quy tắc giao dịch. Không phải actor đăng nhập. |

## Danh mục use case

| UC | Actor chính | Kết quả nghiệm thu | Yêu cầu |
| --- | --- | --- | --- |
| UC-01 Tạo và quản lý tài khoản | Guest, Buyer | Email chuẩn hóa duy nhất; đăng nhập tạo phiên; logout/đổi mật khẩu thu hồi phiên theo BR-01; hồ sơ và địa chỉ chỉ truy cập bởi chủ sở hữu. | FR-01–06 |
| UC-02 Mở và vận hành shop | Buyer/Seller, Admin | Đăng ký tạo PENDING; Admin duyệt hoặc từ chối có lý do; chỉ shop ACTIVE phát sinh giao dịch mới; thành viên chỉ quản lý shop được cấp quyền. | FR-07–10, FR-48 |
| UC-03 Quản lý danh mục và hàng hóa | Admin, Seller | Admin quản lý cây danh mục; Seller tạo/sửa sản phẩm, ảnh và biến thể trong shop; dừng bán/ẩn không xóa lịch sử đơn; hàng đủ điều kiện mới hiển thị. | FR-11–15, FR-49 |
| UC-04 Khám phá hàng hóa | Guest, Buyer | Danh sách, chi tiết, tìm kiếm, lọc, sắp xếp và trang shop chỉ hiển thị hàng đủ điều kiện bán; dữ liệu riêng và cờ quản trị không lộ ra. | FR-16–20 |
| UC-05 Quản lý giỏ và checkout | Buyer | Giỏ đồng bộ theo tài khoản, nhóm theo shop; trước xác nhận kiểm tra lại shop, catalog, giá, biến thể, địa chỉ và tồn; tổng tiền do server tính. | FR-21–28 |
| UC-06 Theo dõi và xử lý đơn | Buyer, Seller, Admin | Một MarketplaceOrder được tách thành SellerOrder theo shop; Seller chỉ xử lý phần của mình; buyer/admin xem theo quyền; snapshot giao dịch không đổi theo catalog. | FR-26–32, FR-44, FR-50 |
| UC-07 Thu, hủy và hoàn giao dịch | Buyer, Seller, System | COD và MOCK theo dõi riêng trạng thái đơn; expiry/cancel/late callback tuân BR-05–08; retry không thu/hoàn hoặc hoàn kho trùng. | FR-28, FR-31–36 |
| UC-08 Giao hàng và hoàn tất | Seller, Buyer, Admin, System | Mỗi SellerOrder có shipment mô phỏng; trạng thái chuyển đúng thứ tự; giao lại và xác nhận hàng hoàn có lịch sử; Buyer hoàn tất theo quyền. | FR-30–32, FR-37–39 |
| UC-09 Đánh giá và thống kê | Buyer, Seller | Buyer của OrderItem thuộc đơn COMPLETED đánh giá tối đa một lần; Seller xem thống kê giới hạn shop và kỳ; số doanh thu được ghi rõ là mô phỏng. | FR-40–45 |
| UC-10 Điều hành marketplace | Admin | Quản lý user, shop, sản phẩm, thống kê và tra cứu đơn bằng action được phép, có audit; không chỉnh sửa tùy ý lịch sử giao dịch. | FR-08, FR-10–11, FR-15, FR-46–50 |
| UC-11 Trải nghiệm đa nền tảng | Buyer, Seller | Hành vi theo platform requirement: Web, Android, iOS, Desktop; phiên được lưu an toàn theo nền tảng và luồng Seller reuse client-only như plan. | SC-009–010 |

## Functional requirements và actor/acceptance index

Mỗi dòng dưới đây là điều kiện review tối thiểu cùng actor. Toàn bộ quy tắc, field và ngoại lệ chi tiết nằm dưới cùng mã FR trong feature spec. BR liên quan là tiêu chí bắt buộc khi nghiệm thu.

| ID | Actor | Điều kiện nghiệm thu tóm tắt | BR |
| --- | --- | --- | --- |
| FR-01 | Guest | Đăng ký với email, mật khẩu, họ tên và dữ liệu hợp lệ; email chuẩn hóa trùng bị từ chối. | BR-01 |
| FR-02 | Guest | Email/mật khẩu hợp lệ cấp phiên; sai thông tin không tạo phiên. | BR-01 |
| FR-03 | Buyer/Seller/Admin | Logout vô hiệu hóa phiên tương ứng; refresh/session bị thu hồi không dùng lại được. | BR-01 |
| FR-04 | Buyer/Seller/Admin | Chủ tài khoản sửa họ tên, điện thoại, avatar, mật khẩu; mật khẩu mới áp dụng chính sách phiên. | BR-01 |
| FR-05 | Buyer/Seller/Admin | Chủ tài khoản CRUD địa chỉ và chọn tối đa một địa chỉ mặc định còn hiệu lực. | BR-01 |
| FR-06 | Mọi actor | Backend từ chối role/resource scope không hợp lệ; Seller A không truy cập shop B. | BR-01 |
| FR-07 | Buyer | Đăng ký đủ thông tin shop tạo shop PENDING và membership OWNER. | BR-01–02 |
| FR-08 | Admin | Admin xem queue, duyệt hoặc từ chối kèm lý do; chỉ ACTIVE được bán công khai. | BR-01–02 |
| FR-09 | Seller, Guest | Thành viên có quyền sửa hồ sơ/ảnh; Guest xem hồ sơ công khai đã lọc dữ liệu. | BR-02 |
| FR-10 | Admin, Buyer | Admin khóa/mở shop theo quyền; shop không ACTIVE không phát sinh giao dịch mới. | BR-02 |
| FR-11 | Admin | Tạo/sửa/ẩn category cha-con; từ chối chu trình và category không hợp lệ. | BR-02 |
| FR-12 | Seller | Tạo product thuộc shop được cấp quyền, có category, ảnh, variant và tồn hợp lệ. | BR-03 |
| FR-13 | Seller, Buyer | Variant có SKU/attributes/giá/tồn riêng; SKU/attributes trùng trong shop bị chặn. | BR-03 |
| FR-14 | Seller, Buyer | Seller sửa catalog không thay đổi snapshot đơn đã tạo; ngừng variant không xóa lịch sử. | BR-03 |
| FR-15 | Seller, Admin, Buyer | Seller dừng bán; Admin ẩn vi phạm; hàng ẩn/dừng không được mua mới. | BR-02–03 |
| FR-16 | Guest, Buyer | Chi tiết hiển thị thông tin hàng/shop, giá variant, tồn khả dụng và review công khai. | BR-03 |
| FR-17 | Guest, Buyer | Danh sách phân trang chỉ chứa sản phẩm được phép bán. | BR-03 |
| FR-18 | Guest, Buyer | Tìm kiếm theo tên/từ khóa/category trả kết quả phù hợp và chỉ công khai. | BR-03 |
| FR-19 | Guest, Buyer | Lọc khoảng giá/category và sort giá tăng/giảm hoặc mới nhất đúng dữ liệu. | BR-03 |
| FR-20 | Guest, Buyer | Trang shop công khai chỉ hiển thị thông tin được phép và sản phẩm đang bán. | BR-02–03 |
| FR-21 | Buyer | Thêm variant/số lượng hợp lệ vào giỏ gắn tài khoản. | BR-04 |
| FR-22 | Buyer | Sửa số lượng, xóa và chọn dòng checkout; dòng ngoài lựa chọn không bị ảnh hưởng. | BR-04 |
| FR-23 | Buyer | Giỏ nhóm chính xác theo shop, giữ quyền xử lý dữ liệu theo buyer. | BR-04 |
| FR-24 | Buyer | Checkout revalidate eligibility/giá/tồn; server tính tiền; thay đổi cần buyer xác nhận lại. | BR-04–05 |
| FR-25 | Buyer | Checkout hợp lệ tạo đơn từ dòng đã chọn, địa chỉ sở hữu và phương thức hợp lệ. | BR-04–06 |
| FR-26 | Buyer, Seller | Một đơn tổng có một SellerOrder mỗi shop; Seller chỉ thấy/xử lý shop mình. | BR-04, BR-08 |
| FR-27 | Buyer, Seller, Admin | Item giữ snapshot tên/SKU/giá/số lượng/thành tiền; catalog edit không đổi snapshot. | BR-05 |
| FR-28 | Buyer, Seller, System | Không oversell; hủy hợp lệ trả kho đúng một lần; tranh chấp tồn cho kết quả nguyên tử. | BR-04, BR-07 |
| FR-29 | Buyer | Buyer xem lịch sử/chi tiết và trạng thái tiền/giao hàng của đơn sở hữu. | BR-07–09 |
| FR-30 | Seller | Seller thực hiện transition được phép trên SellerOrder của shop mình và theo dõi kết quả. | BR-07–09 |
| FR-31 | Buyer, Seller | Buyer/Seller chỉ hủy theo trạng thái và quyền được BR-07 quy định. | BR-07 |
| FR-32 | Buyer, Seller, System | Transition state hợp lệ; aggregate Order được derive theo BR-08. | BR-07–09 |
| FR-33 | Buyer, Seller | COD được chọn và khoản thu chỉ ghi nhận theo action đủ điều kiện, tách khỏi Order state. | BR-05–06 |
| FR-34 | Buyer, System | Mock payment trả thành công/thất bại/hủy; không gọi tiền hoặc cổng thật. | BR-05–06 |
| FR-35 | Buyer, Seller, Admin, System | Payment có mã và event; callback/retry lặp không tạo tác động kinh tế lặp. | BR-05–08 |
| FR-36 | Buyer, System | Thất bại/hết hạn có thể retry theo policy; kho và đơn nhất quán, callback muộn được bù trừ. | BR-05–08 |
| FR-37 | Seller, System | Tạo đúng một shipment cho mỗi SellerOrder theo điều kiện kích hoạt. | BR-09 |
| FR-38 | Seller, System | Mô phỏng các trạng thái giao hàng hợp lệ; lỗi có reason/attempt theo rule. | BR-09 |
| FR-39 | Buyer, Seller | Chỉ người liên quan xem tracking; shipment/order states đồng bộ theo policy. | BR-09 |
| FR-40 | Buyer | Buyer của item thuộc đơn COMPLETED tạo review rating 1–5 và bình luận. | BR-10 |
| FR-41 | Guest, Buyer | Xem review công khai gắn đúng sản phẩm. | BR-10 |
| FR-42 | Buyer | Review thứ hai trên cùng OrderItem bị từ chối. | BR-10 |
| FR-43 | Seller | Dashboard chỉ tính dữ liệu shop thuộc quyền và dùng định nghĩa thống kê đã chốt. | BR-05, BR-10 |
| FR-44 | Seller | Lọc và xem chi tiết SellerOrder của shop mình theo trạng thái. | BR-01, BR-07 |
| FR-45 | Seller | Thống kê ngày/tháng/tổng từ giao dịch mô phỏng hoàn tất, theo timezone đã định. | BR-05, BR-10 |
| FR-46 | Admin | Thống kê hệ thống dùng định nghĩa không đếm kép, không nhầm doanh thu mô phỏng là tiền thật. | BR-05, BR-10 |
| FR-47 | Admin | Admin tìm/xem/khóa/mở tài khoản; hành động audit và tuân policy session. | BR-01 |
| FR-48 | Admin | Admin quản lý queue yêu cầu mở shop; quyết định trùng hoặc sai trạng thái bị chặn. | BR-01–02 |
| FR-49 | Admin | Admin ẩn sản phẩm vi phạm; Seller không tự gỡ cờ kiểm duyệt. | BR-02–03 |
| FR-50 | Admin | Admin tra cứu đơn theo quyền với snapshot/event/audit đủ xử lý sự cố. | BR-05–10 |

## Business rules và non-functional requirements

BR-01–BR-10 được định nghĩa đầy đủ trong feature spec và là acceptance baseline cho các dòng trên. Các lựa chọn gồm identity/session, shop eligibility, catalog visibility, checkout atomicity, VND/snapshot, COD/mock settlement, cancellation/stock return, aggregate order state, shipment progression và review/admin boundaries.

NFR-01–NFR-04 và SC-001–SC-010 giữ nguyên nội dung trong feature spec: phân quyền/riêng tư, accessibility, bền vững dữ liệu đa phiên và tài liệu/bàn giao; performance, last-stock concurrency, idempotency, cross-platform security, native workflows và demo/recovery. Các ngưỡng đo được giữ tại nguồn spec.

## Quyết định được chốt cho các cụm từ mơ hồ

- Hạn MOCK là 15 phút từ lúc tạo đơn; deadline lưu cố định. Đến deadline thì expiry thắng cho xử lý chuẩn; callback đến muộn vẫn ghi nhận và bù trừ, không mở lại đơn.
- Buyer được hủy SellerOrder khi PENDING; Seller được hủy CONFIRMED trước PACKING. Hủy toàn bộ chỉ thành công nếu mọi phần chưa hủy còn PENDING; nếu không thì toàn transaction bị từ chối. Không có hủy lẻ OrderItem trong MVP.
- Checkout toàn bộ hoặc rollback toàn bộ; tồn bị trừ lúc checkout, không giữ hàng trong giỏ. Mỗi item chỉ hoàn kho một lần qua movement/idempotency.
- COD thu theo từng SellerOrder sau DELIVERED. MOCK attempt thành công hợp lệ được settle một lần; thất bại/hủy/expiry và late compensation theo BR-06–08.
- Mỗi OrderItem COMPLETED được Buyer sở hữu đánh giá đúng một lần; Admin action không viết tùy ý trạng thái lịch sử.

Các quyết định cụ thể ở trên là baseline tài liệu từ BR; khi sửa nghiệp vụ phải cập nhật spec, API contract, data model và tasks cùng một thay đổi.
