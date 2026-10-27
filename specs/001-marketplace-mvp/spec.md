# Feature Specification: Multi-Vendor Marketplace MVP

**Feature Branch**: `main` (giữ branch hiện tại; không có hook tạo branch)

**Created**: 2026-10-20

**Status**: Draft — ready for planning; assumptions require review

**Input**: Functional Requirements Prompt do chủ dự án cung cấp: nền tảng thương mại
điện tử đa người bán trên Web, Mobile và Desktop, 50 yêu cầu chức năng.

## User Scenarios & Testing *(mandatory)*

Các story có thể nghiệm thu độc lập bằng dữ liệu mẫu cho những phần phụ thuộc.
P1 là nghiệp vụ cốt lõi, P2 là quản trị sau bán và mở rộng trải nghiệm đa nền tảng trong MVP;
P2 không có nghĩa là ngoài phạm vi. Thứ tự phát triển tuân thủ hiến chương.

### User Story 1 - Tài khoản và địa chỉ cá nhân (Priority: P1)

Người dùng đăng ký, đăng nhập, quản lý hồ sơ/địa chỉ và đăng xuất an toàn.

**Why this priority**: Là điều kiện để đặt hàng và quản lý cửa hàng có danh tính.

**Independent Test**: Dùng tài khoản mới, cập nhật hồ sơ/địa chỉ và kiểm tra phiên đăng nhập.

**Acceptance Scenarios**:

1. **Given** email chưa đăng ký, **When** gửi email hợp lệ, mật khẩu, họ tên,
   **Then** tạo một tài khoản; email trùng hoặc dữ liệu sai bị từ chối với lỗi dễ hiểu.
2. **Given** tài khoản hoạt động, **When** đăng nhập đúng/sai thông tin,
   **Then** chỉ thông tin đúng tạo phiên; đăng xuất làm phiên đó không thể tiếp tục sử dụng.
3. **Given** đã đăng nhập, **When** đổi họ tên, điện thoại, ảnh, mật khẩu và thêm/sửa/xóa địa chỉ,
   **Then** thay đổi được lưu, chỉ có tối đa một địa chỉ mặc định và người khác không đọc/sửa được.

### User Story 2 - Đăng ký, duyệt và quản lý shop (Priority: P1)

Buyer trở thành Seller mà vẫn giữ quyền mua hàng; Admin quyết định shop được hoạt động.

**Why this priority**: Chỉ shop hợp lệ mới cung cấp hàng hóa cho sàn.

**Independent Test**: Tạo yêu cầu shop với tài khoản mẫu và duyệt/từ chối/khóa bằng Admin.

**Acceptance Scenarios**:

1. **Given** người dùng đăng nhập, **When** gửi đủ tên, slug, mô tả, logo, địa chỉ, điện thoại,
   **Then** shop ở PENDING; slug trùng bị từ chối; chưa được đăng bán công khai.
2. **Given** yêu cầu đang chờ, **When** Admin duyệt hoặc từ chối kèm lý do,
   **Then** Seller nhìn thấy kết quả; chỉ shop ACTIVE được bán công khai.
3. **Given** shop hoạt động, **When** Seller có quyền sửa thông tin/logo/banner hoặc Admin khóa/mở,
   **Then** cập nhật đúng shop; shop khóa không phát sinh giao dịch mới; lịch sử vẫn còn.
4. **Given** Seller thuộc nhiều shop, **When** chuyển shop hoặc truy cập shop không được cấp quyền,
   **Then** chỉ dữ liệu và thao tác của shop được cấp quyền khả dụng.

### User Story 3 - Danh mục, sản phẩm và biến thể (Priority: P1)

Admin quản lý danh mục, Seller đăng sản phẩm có biến thể và cập nhật hàng bán.

**Why this priority**: Tạo nguồn hàng có thể mua, có giá và tồn kho theo lựa chọn cụ thể.

**Independent Test**: Dùng shop đã duyệt để tạo sản phẩm hai biến thể và ngừng bán một biến thể.

**Acceptance Scenarios**:

1. **Given** Admin, **When** tạo/sửa/ẩn danh mục cha-con,
   **Then** cây danh mục không có chu kỳ và danh mục ẩn không được chọn cho sản phẩm mới.
2. **Given** shop ACTIVE và danh mục hợp lệ, **When** Seller tạo sản phẩm có ảnh, mô tả,
   biến thể, SKU, giá và số lượng, **Then** mỗi biến thể có giá/tồn riêng; dữ liệu sai bị chặn.
3. **Given** sản phẩm đã có đơn, **When** sửa tên/ảnh/giá hoặc ngừng bán sản phẩm/biến thể,
   **Then** đơn cũ giữ nguyên nội dung; hàng ngừng bán không được mua mới.
4. **Given** Seller quản lý tồn kho, **When** cập nhật số lượng không âm và xem lại,
   **Then** số lượng khả dụng nhất quán với giao dịch đã phát sinh; không ghi đè lượng đã bán.

### User Story 4 - Khám phá hàng hóa (Priority: P1)

Guest và Buyer xem trang chủ, tìm kiếm, lọc, sắp xếp và xem sản phẩm/shop công khai.

**Why this priority**: Người mua phải tìm được sản phẩm phù hợp trước khi đăng nhập mua hàng.

**Independent Test**: Dùng danh mục mẫu có hàng hoạt động, ẩn, hết hàng và shop bị khóa.

**Acceptance Scenarios**:

1. **Given** Guest, **When** tìm theo tên/từ khóa/danh mục, lọc khoảng giá và sắp xếp giá hoặc mới nhất,
   **Then** chỉ thấy hàng công khai hợp lệ, kết quả đúng bộ lọc, có phân trang và trạng thái rỗng.
2. **Given** sản phẩm nhiều biến thể, **When** chọn biến thể ở trang chi tiết,
   **Then** thấy tên, ảnh, mô tả, giá/tồn tương ứng, shop và đánh giá; shop có danh sách hàng đang bán.
3. **Given** Guest muốn đặt hàng, **When** bắt đầu hành động mua,
   **Then** được yêu cầu đăng nhập trước khi tạo đơn.

### User Story 5 - Giỏ hàng và checkout đa shop (Priority: P1)

Buyer chọn sản phẩm nhiều shop, kiểm tra tổng tiền và tạo đơn theo từng shop.

**Why this priority**: Đây là giá trị trung tâm của marketplace.

**Independent Test**: Buyer và hai shop mẫu, mỗi shop có ít nhất hai biến thể còn hàng.

**Acceptance Scenarios**:

1. **Given** Buyer đăng nhập, **When** thêm biến thể, tăng/giảm số lượng, xóa và chọn dòng thanh toán,
   **Then** giỏ nhóm theo shop, chỉ dòng chọn tham gia checkout; số lượng phải là số nguyên dương.
2. **Given** giỏ có hàng từ hai shop, **When** chọn địa chỉ và phương thức thanh toán hợp lệ,
   **Then** tạo đúng một Order tổng và hai Seller Orders, mỗi dòng thuộc đúng shop;
   tổng tiền khớp và chỉ dòng đã mua bị loại khỏi giỏ.
3. **Given** giá thay đổi, hàng thiếu, biến thể ngừng bán hoặc shop bị khóa,
   **When** xác nhận checkout, **Then** kiểm tra lại và thông báo điều chỉnh;
   không tạo đơn một phần hoặc âm tồn; giá thay đổi cần Buyer xác nhận lại.
4. **Given** cùng yêu cầu mua được gửi lại hoặc nhiều Buyer tranh mua đơn vị cuối,
   **When** xử lý đồng thời, **Then** không tạo đơn trùng và tối đa một Buyer mua được đơn vị đó.
5. **Given** đã tạo đơn, **When** Seller thay đổi sản phẩm hoặc Buyer đổi địa chỉ cá nhân,
   **Then** tên, SKU, giá, số lượng, thành tiền và địa chỉ giao của đơn vẫn giữ nguyên.

### User Story 6 - Thanh toán và hủy hợp lệ (Priority: P1)

Buyer chọn COD hoặc thanh toán mô phỏng, theo dõi giao dịch và hủy phần đơn được phép.

**Why this priority**: Bảo đảm thanh toán, đơn và hàng tồn không mâu thuẫn.

**Independent Test**: Dùng đơn mẫu với COD, mô phỏng thành công/thất bại/hủy và gửi lại kết quả.

**Acceptance Scenarios**:

1. **Given** checkout COD, **When** tạo đơn, **Then** phương thức COD và trạng thái chưa thu tiền
   tách biệt; chỉ ghi đã thu khi có xác nhận giao và thu tiền mô phỏng.
2. **Given** thanh toán mô phỏng, **When** chọn thành công/thất bại/hủy,
   **Then** ghi nhận đúng kết quả có mã giao dịch; kết quả lặp không làm thay đổi tiền/tồn lần hai.
3. **Given** thanh toán thất bại hoặc hủy, **When** Buyer thử lại trong thời hạn,
   **Then** vẫn dùng đơn đang chờ, mỗi lần thử có định danh riêng, tối đa một lần thành công.
4. **Given** Seller Order ở PENDING, **When** Buyer hủy hoặc Seller từ chối kèm lý do,
   **Then** chỉ phần đó bị hủy, hoàn tồn đúng một lần và hoàn tiền mô phỏng phần đã trả nếu có.
5. **Given** một Seller Order đã CONFIRMED, **When** Buyer hủy toàn Order,
   **Then** từ chối toàn hành động, nêu các phần không đủ điều kiện; Buyer có thể hủy riêng phần PENDING.

### User Story 7 - Xử lý đơn và giao hàng mô phỏng (Priority: P1)

Seller xử lý phần đơn của shop; Buyer theo dõi và xác nhận nhận hàng.

**Why this priority**: Hoàn tất vòng đời đơn hàng và giao nhận.

**Independent Test**: Dùng Seller Orders mẫu để chạy từng chuyển trạng thái và nhánh lỗi.

**Acceptance Scenarios**:

1. **Given** đơn hợp lệ với COD hoặc thanh toán mô phỏng đã thành công,
   **When** Seller xác nhận, đóng gói và bàn giao,
   **Then** lần lượt CONFIRMED, PACKING, SHIPPING; Seller không thấy phần của shop khác.
2. **Given** shipment tương ứng, **When** người có quyền thao tác mô phỏng cập nhật lấy hàng,
   đang giao, đã giao hoặc thất bại, **Then** Buyer/Seller thấy cùng trạng thái và lịch sử;
   đã giao đưa đơn sang DELIVERED, giao thất bại không tự coi là hoàn thành.
3. **Given** đã giao và thanh toán/thu COD đã được ghi nhận,
   **When** Buyer xác nhận nhận hàng, **Then** Seller Order COMPLETED; Buyer xem được lịch sử,
   chi tiết, trạng thái đơn/thanh toán/vận chuyển và phần đơn thuộc từng shop.
4. **Given** có yêu cầu nhảy trạng thái, thực hiện sau khi hủy hoặc dùng quyền sai,
   **When** gửi thao tác, **Then** từ chối, không đổi dữ liệu và thông báo lý do.

### User Story 8 - Đánh giá và thống kê Seller (Priority: P2)

Buyer đánh giá hàng đã nhận; Seller theo dõi đánh giá, đơn và doanh thu mô phỏng.

**Why this priority**: Tạo phản hồi và giúp shop đo hoạt động sau giao dịch.

**Independent Test**: Dùng đơn hoàn thành và đơn chưa hoàn thành với số tiền đã biết.

**Acceptance Scenarios**:

1. **Given** Order Item thuộc Buyer trong Seller Order COMPLETED,
   **When** đánh giá 1–5 sao kèm bình luận, **Then** lưu thời điểm và hiển thị trên sản phẩm;
   lần thứ hai, sai người mua, điểm ngoài 1–5 hoặc đơn chưa hoàn thành đều bị từ chối.
2. **Given** Seller chọn shop, **When** mở dashboard, lọc đơn và xem ngày/tháng,
   **Then** số sản phẩm, đơn chờ/đang xử lý/hoàn thành và doanh thu khớp dữ liệu shop;
   doanh thu chỉ gồm Seller Orders COMPLETED và được ghi rõ là mô phỏng.
3. **Given** shop có đánh giá, **When** Seller xem đánh giá và lọc theo sản phẩm,
   **Then** thấy phản hồi của hàng thuộc shop; không được sửa/xóa lời đánh giá của Buyer.

### User Story 9 - Quản trị sàn (Priority: P2)

Admin kiểm soát tài khoản, shop, hàng hóa và tra cứu giao dịch.

**Why this priority**: Cho phép vận hành demo có kiểm soát và xử lý vi phạm.

**Independent Test**: Dữ liệu mẫu nhiều tài khoản/shop và giao dịch hoàn tất có số liệu biết trước.

**Acceptance Scenarios**:

1. **Given** Admin, **When** xem/tìm/khóa/mở tài khoản và ẩn sản phẩm,
   **Then** quyền mua/bán mới bị chặn tương ứng; lịch sử giao dịch không bị xóa.
2. **Given** Admin, **When** xem thống kê hoặc tra cứu đơn toàn sàn,
   **Then** thấy số người dùng/shop/sản phẩm/đơn và giá trị mô phỏng đúng dữ liệu,
   gồm các bộ lọc và chi tiết phục vụ sự cố.
3. **Given** giao dịch đã hoàn tất, **When** có thao tác sửa trực tiếp giá/nội dung/trạng thái,
   **Then** bị chặn; hành động quản trị hợp lệ có nhật ký ai, lúc nào, đối tượng và lý do.

### User Story 10 - Trải nghiệm xuyên nền tảng (Priority: P2)

Buyer mua trên Web/Android/iOS; Seller quản lý shop trên Web/Windows/macOS.

**Why this priority**: Đáp ứng đầy đủ phạm vi đề tài và cho phép tiếp tục công việc giữa thiết bị.

**Independent Test**: Cùng tài khoản và dữ liệu mẫu trên từng nền tảng đích.

**Acceptance Scenarios**:

1. **Given** Buyer dùng Web rồi Mobile, **When** xem giỏ/đơn và hoàn tất hành trình mua,
   **Then** dữ liệu đã lưu nhất quán, không phải tạo tài khoản riêng.
2. **Given** Seller dùng Web rồi Desktop, **When** sửa hàng/tồn và xử lý đơn,
   **Then** thay đổi xuất hiện trên nền tảng còn lại sau tải lại.
3. **Given** mỗi màn hình bắt buộc, **When** chờ tải, không có dữ liệu, thao tác thành công,
   lỗi hoặc thiếu quyền, **Then** hiển thị trạng thái và hướng dẫn phù hợp, giữ dữ liệu nhập khi an toàn;
   không báo thành công khi thao tác chưa được lưu.

### Edge Cases

- Email khác hoa/thường hoặc slug trùng: không tạo tài khoản/shop trùng theo chuẩn hóa.
- Giá/tồn/shop thay đổi giữa mở giỏ và xác nhận: kiểm tra lại toàn bộ checkout, không mua một phần.
- Gửi lại checkout/kết quả thanh toán/hủy: cùng ý định xử lý một lần; cùng định danh khác nội dung bị từ chối.
- Mất kết nối sau xác nhận: tra cứu kết quả trước thử lại, không tạo thêm đơn ngoài ý muốn.
- Hai yêu cầu mua đơn vị cuối, sửa tồn và hủy đồng thời: tồn không âm, không hoàn hàng hai lần.
- Thanh toán báo thành công sau khi đơn đã hết hạn/hủy: ghi nhận sự kiện, hoàn mô phỏng đúng số tiền;
  không mở lại đơn hoặc trừ tồn lần nữa.
- Shop/tài khoản bị khóa khi có đơn đang xử lý: chặn giao dịch mới; lịch sử không mất;
  shop bị khóa vẫn xử lý đơn cũ nếu tài khoản còn hoạt động, Admin xử lý khi tài khoản đã bị khóa.
- Danh mục ẩn: hàng gắn danh mục bị ẩn không được mua mới; đơn cũ giữ nguyên.
- Xóa địa chỉ mặc định: Buyer phải chọn địa chỉ còn lại trước checkout; snapshot đơn không đổi.
- Đơn đa shop có phần hủy/đã giao: hiển thị riêng từng phần và trạng thái tổng hợp rõ ràng.
- Giao thất bại: cho phép giao lại có lịch sử; không tự hoàn tồn khi hàng chưa được xác nhận hoàn về.
- Tải ảnh sai định dạng/quá dung lượng: từ chối có lý do, không công khai file không hợp lệ.

## Requirements *(mandatory)*

### Functional Requirements

Giữ mã FR-01–FR-50 của tài liệu nguồn để truy vết. Các quy tắc BR bên dưới làm rõ
điều kiện nghiệm thu khi một yêu cầu nguồn dùng cụm “khi phù hợp” hoặc “theo quy tắc”.

#### FR-01: Đăng ký tài khoản

Hệ thống PHẢI đáp ứng:

Người dùng đăng ký bằng email, mật khẩu, họ tên và các thông tin bắt buộc.

Hệ thống phải kiểm tra email trùng lặp và tính hợp lệ của dữ liệu.

#### FR-02: Đăng nhập

Hệ thống PHẢI đáp ứng:

Cho phép đăng nhập bằng email và mật khẩu.

Hệ thống xác thực và cấp phiên đăng nhập an toàn.

#### FR-03: Đăng xuất

Hệ thống PHẢI đáp ứng:

Cho phép người dùng đăng xuất và vô hiệu hóa phiên/thông tin duy trì phiên tương ứng.

#### FR-04: Quản lý hồ sơ

Hệ thống PHẢI đáp ứng:

Người dùng có thể:
- Cập nhật họ tên.
- Cập nhật số điện thoại.
- Thay đổi ảnh đại diện.
- Đổi mật khẩu.

#### FR-05: Quản lý địa chỉ

Hệ thống PHẢI đáp ứng:

Người dùng có thể thêm, sửa, xóa và chọn địa chỉ giao hàng mặc định.

#### FR-06: Phân quyền

Hệ thống PHẢI đáp ứng:

Hệ thống phải phân quyền theo vai trò và phạm vi tài nguyên.

Người bán không thể quản lý cửa hàng không thuộc quyền của mình.

#### FR-07: Đăng ký cửa hàng

Hệ thống PHẢI đáp ứng:

Người dùng có thể gửi yêu cầu mở cửa hàng với các thông tin:
- Tên cửa hàng.
- Đường dẫn/slug cửa hàng.
- Mô tả cửa hàng.
- Logo.
- Địa chỉ liên hệ.
- Số điện thoại.

Sau đăng ký, trạng thái cửa hàng là PENDING.

#### FR-08: Phê duyệt cửa hàng

Hệ thống PHẢI đáp ứng:

Admin có thể:
- Xem danh sách yêu cầu.
- Phê duyệt.
- Từ chối và ghi lý do.

Chỉ cửa hàng APPROVED/ACTIVE mới được đăng bán công khai.

#### FR-09: Quản lý cửa hàng

Hệ thống PHẢI đáp ứng:

Seller được:
- Chỉnh sửa thông tin.
- Thay đổi logo và banner.
- Xem hồ sơ cửa hàng công khai.

#### FR-10: Quản lý trạng thái cửa hàng

Hệ thống PHẢI đáp ứng:

Admin có thể tạm khóa cửa hàng vi phạm.

Sản phẩm thuộc cửa hàng bị tạm khóa không được phép phát sinh giao dịch mới.

#### FR-11: Quản lý danh mục

Hệ thống PHẢI đáp ứng:

Admin có thể:
- Tạo danh mục.
- Cập nhật danh mục.
- Ẩn danh mục.
- Thiết lập danh mục cha/con.

#### FR-12: Seller tạo sản phẩm

Hệ thống PHẢI đáp ứng:

Seller nhập:
- Tên sản phẩm.
- Mô tả.
- Danh mục.
- Hình ảnh.
- Giá bán.
- Biến thể.
- Số lượng tồn kho.

Sản phẩm phải thuộc một cửa hàng do Seller có quyền quản lý.

#### FR-13: Quản lý biến thể

Hệ thống PHẢI đáp ứng:

Sản phẩm hỗ trợ các biến thể như:
- Màu sắc.
- Kích thước.
- Phiên bản.

Mỗi biến thể có SKU, giá và tồn kho riêng.

#### FR-14: Chỉnh sửa sản phẩm

Hệ thống PHẢI đáp ứng:

Seller có thể:
- Sửa tên.
- Sửa mô tả.
- Thay ảnh.
- Sửa giá.
- Thêm hoặc ngừng bán biến thể.

Các thay đổi không được làm sai dữ liệu đơn hàng đã phát sinh.

#### FR-15: Ẩn hoặc ngừng bán sản phẩm

Hệ thống PHẢI đáp ứng:

Seller có thể ngừng bán sản phẩm mà không làm mất lịch sử đơn hàng.

Admin có thể ẩn sản phẩm vi phạm.

#### FR-16: Trang chi tiết sản phẩm

Hệ thống PHẢI đáp ứng:

Hiển thị:
- Tên sản phẩm.
- Ảnh sản phẩm.
- Giá tương ứng với biến thể.
- Mô tả.
- Tồn kho khả dụng.
- Thông tin cửa hàng.
- Đánh giá.

#### FR-17: Danh sách sản phẩm

Hệ thống PHẢI đáp ứng:

Hiển thị các sản phẩm đang được phép bán.

Hỗ trợ phân trang.

#### FR-18: Tìm kiếm sản phẩm

Hệ thống PHẢI đáp ứng:

Buyer và Guest có thể tìm kiếm theo:
- Tên sản phẩm.
- Từ khóa.
- Danh mục.

#### FR-19: Lọc và sắp xếp

Hệ thống PHẢI đáp ứng:

Hỗ trợ:
- Khoảng giá.
- Danh mục.
- Giá tăng dần.
- Giá giảm dần.
- Mới nhất.

#### FR-20: Trang cửa hàng công khai

Hệ thống PHẢI đáp ứng:

Người dùng có thể xem:
- Tên và mô tả cửa hàng.
- Logo.
- Danh sách sản phẩm đang bán.

#### FR-21: Thêm vào giỏ hàng

Hệ thống PHẢI đáp ứng:

Buyer có thể chọn biến thể và số lượng để thêm vào giỏ.

#### FR-22: Cập nhật giỏ hàng

Hệ thống PHẢI đáp ứng:

Buyer có thể:
- Tăng hoặc giảm số lượng.
- Xóa sản phẩm.
- Chọn các sản phẩm cần thanh toán.

#### FR-23: Nhóm theo cửa hàng

Hệ thống PHẢI đáp ứng:

Giỏ hàng phải hiển thị các sản phẩm theo từng cửa hàng.

#### FR-24: Kiểm tra giỏ hàng

Hệ thống PHẢI đáp ứng:

Khi thanh toán, hệ thống phải kiểm tra lại:
- Sản phẩm còn được bán.
- Cửa hàng đang hoạt động.
- Giá hiện tại.
- Số lượng tồn kho.
- Biến thể còn hợp lệ.

Không sử dụng giá tiền từ giao diện người dùng làm giá trị giao dịch cuối cùng.

#### FR-25: Tạo đơn hàng

Hệ thống PHẢI đáp ứng:

Buyer lựa chọn:
- Các sản phẩm trong giỏ.
- Địa chỉ giao hàng.
- Phương thức thanh toán.

Hệ thống tính toán và tạo đơn hàng.

#### FR-26: Đơn hàng đa cửa hàng

Hệ thống PHẢI đáp ứng:

Nếu buyer mua sản phẩm thuộc nhiều cửa hàng, hệ thống tạo:
- Một đơn hàng tổng.
- Nhiều đơn hàng con tương ứng với từng cửa hàng.
- Các dòng sản phẩm thuộc đơn hàng con.

Seller chỉ được xem và xử lý đơn hàng con thuộc cửa hàng mình.

#### FR-27: Lưu snapshot sản phẩm

Hệ thống PHẢI đáp ứng:

Order Item phải lưu lại:
- Tên sản phẩm.
- SKU/biến thể tại thời điểm mua.
- Giá tại thời điểm mua.
- Số lượng.
- Thành tiền.

Việc Seller thay đổi sản phẩm sau này không được thay đổi nội dung đơn hàng đã đặt.

#### FR-28: Kiểm soát tồn kho

Hệ thống PHẢI đáp ứng:

Khi đặt hàng:
- Kiểm tra số lượng khả dụng.
- Giữ hàng hoặc khấu trừ tồn kho theo quy tắc thống nhất.
- Tránh tình trạng bán vượt tồn kho.

Khi hủy đơn hợp lệ, hệ thống hoàn lại tồn kho đúng một lần.

#### FR-29: Xem lịch sử đơn hàng

Hệ thống PHẢI đáp ứng:

Buyer có thể xem:
- Danh sách đơn hàng.
- Chi tiết đơn.
- Trạng thái thanh toán.
- Trạng thái giao hàng.

#### FR-30: Seller xử lý đơn hàng

Hệ thống PHẢI đáp ứng:

Seller có thể:
- Xác nhận đơn.
- Chuẩn bị hàng.
- Bàn giao vận chuyển mô phỏng.
- Theo dõi trạng thái đơn.

#### FR-31: Hủy đơn hàng

Hệ thống PHẢI đáp ứng:

Buyer được hủy đơn trong các trạng thái cho phép.

Seller cũng có thể từ chối/hủy đơn trong các trường hợp hợp lệ.

#### FR-32: Kiểm soát trạng thái

Hệ thống PHẢI đáp ứng:

Không được phép chuyển trạng thái tùy ý.

Ví dụ:

PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED → COMPLETED.

Hủy đơn phải tuân thủ điều kiện nghiệp vụ.

#### FR-33: Thanh toán COD

Hệ thống PHẢI đáp ứng:

Cho phép người mua chọn thanh toán khi nhận hàng.

Phương thức thanh toán và tình trạng đã thu tiền phải được theo dõi riêng.

#### FR-34: Thanh toán trực tuyến mô phỏng

Hệ thống PHẢI đáp ứng:

Hệ thống cung cấp cổng thanh toán giả lập với các kết quả:
- Thành công.
- Thất bại.
- Hủy thanh toán.

Không xử lý tiền thật.

#### FR-35: Theo dõi thanh toán

Hệ thống PHẢI đáp ứng:

Mỗi giao dịch có mã định danh và trạng thái rõ ràng.

Không xử lý trùng một kết quả thanh toán.

#### FR-36: Xử lý thanh toán thất bại

Hệ thống PHẢI đáp ứng:

Cho phép thử thanh toán lại khi phù hợp.

Hệ thống phải bảo đảm đơn hàng và tồn kho vẫn nhất quán.

#### FR-37: Tạo thông tin vận chuyển

Hệ thống PHẢI đáp ứng:

Mỗi đơn hàng con có thông tin giao hàng tương ứng.

#### FR-38: Mô phỏng vận chuyển

Hệ thống PHẢI đáp ứng:

Hệ thống có thể mô phỏng:
- Chờ lấy hàng.
- Đã lấy hàng.
- Đang vận chuyển.
- Đã giao.
- Giao thất bại.

#### FR-39: Theo dõi vận chuyển

Hệ thống PHẢI đáp ứng:

Buyer và Seller xem được trạng thái vận chuyển của đơn có liên quan.

Trạng thái giao hàng phải phù hợp với trạng thái đơn hàng.

#### FR-40: Đánh giá sản phẩm

Hệ thống PHẢI đáp ứng:

Buyer chỉ được đánh giá sản phẩm thuộc đơn hàng đã hoàn tất.

Nội dung gồm:
- Điểm đánh giá từ 1 đến 5.
- Bình luận.
- Thời điểm đánh giá.

#### FR-41: Xem đánh giá

Hệ thống PHẢI đáp ứng:

Người dùng có thể xem đánh giá ở trang chi tiết sản phẩm.

#### FR-42: Kiểm soát đánh giá trùng

Hệ thống PHẢI đáp ứng:

Một dòng sản phẩm đã mua chỉ được tạo số lượng đánh giá theo quy tắc do hệ thống xác định; với MVP, mặc định mỗi Order Item được đánh giá một lần.

#### FR-43: Tổng quan cửa hàng

Hệ thống PHẢI đáp ứng:

Seller xem:
- Tổng số sản phẩm.
- Số đơn chờ xác nhận.
- Số đơn đang xử lý.
- Số đơn hoàn thành.
- Doanh thu mô phỏng.

#### FR-44: Quản lý đơn

Hệ thống PHẢI đáp ứng:

Seller có thể lọc đơn theo trạng thái và xem chi tiết từng đơn.

#### FR-45: Thống kê doanh thu

Hệ thống PHẢI đáp ứng:

Thống kê theo ngày, tháng và tổng giá trị đơn hoàn thành.

Trong MVP, doanh thu chỉ là số liệu nghiệp vụ mô phỏng, không đại diện cho số tiền thực tế đã đối soát hoặc chuyển khoản.

#### FR-46: Thống kê hệ thống

Hệ thống PHẢI đáp ứng:

Admin có thể xem:
- Số lượng người dùng.
- Số lượng cửa hàng.
- Số lượng sản phẩm.
- Tổng đơn hàng.
- Giá trị giao dịch mô phỏng.

#### FR-47: Quản lý tài khoản

Hệ thống PHẢI đáp ứng:

Admin có thể xem, tìm kiếm, khóa và mở khóa tài khoản theo quyền hạn.

#### FR-48: Duyệt cửa hàng

Hệ thống PHẢI đáp ứng:

Admin quản lý yêu cầu mở cửa hàng.

#### FR-49: Kiểm duyệt sản phẩm

Hệ thống PHẢI đáp ứng:

Admin có thể xem và ẩn sản phẩm không phù hợp.

#### FR-50: Theo dõi đơn hàng

Hệ thống PHẢI đáp ứng:

Admin có thể truy vấn đơn hàng để phục vụ quản trị và xử lý sự cố.

### Business Rules and Acceptance Boundaries

- **BR-01 — Danh tính/quyền (FR-01–10, FR-47–48):** Email chuẩn hóa khoảng trắng/hoa thường và
  duy nhất; mật khẩu tối thiểu 12 ký tự, chấp nhận khoảng trắng, không hiển thị mật khẩu.
  Đổi mật khẩu yêu cầu mật khẩu hiện tại và vô hiệu hóa các phiên khác. Khóa tài khoản vô hiệu
  hóa các phiên và chặn đăng nhập; mở khóa không phục hồi phiên cũ. Admin không tự đăng ký công khai.
  Mỗi người chỉ xem/sửa hồ sơ, địa chỉ, đơn của mình; Seller chỉ quản lý shop có quyền.
  Membership nhiều shop được hỗ trợ, nhưng giao diện mời nhân viên và vai trò tùy biến ngoài MVP.
- **BR-02 — Shop/danh mục (FR-07–11):** PENDING → ACTIVE khi duyệt, hoặc REJECTED kèm lý do.
  Shop bị từ chối được sửa và gửi lại về PENDING; ACTIVE ↔ SUSPENDED do Admin kèm lý do.
  APPROVED trong nguồn là cùng ý nghĩa được duyệt/ACTIVE, không phải hai điều kiện độc lập.
  Slug duy nhất, ổn định sau duyệt; thay slug và xóa danh mục ngoài MVP. Không cho cha-con có chu kỳ.
- **BR-03 — Hàng hóa (FR-12–20):** Mỗi sản phẩm có ít nhất một biến thể, kể cả hàng không có
  lựa chọn; SKU duy nhất trong shop. Giá VND là số nguyên dương, tồn là số nguyên không âm.
  Chỉ hàng đang bán, không bị Admin ẩn, thuộc danh mục công khai và shop ACTIVE được mua.
  Hết hàng vẫn xem được nhưng không đặt mua. Ngừng biến thể không xóa lịch sử.
  Giá đại diện để lọc/sắp xếp là giá thấp nhất của các biến thể đang bán;
  thứ tự bằng giá/ngày được giữ ổn định giữa các trang. Ảnh cho phép JPEG/PNG/WebP tối đa 5 MB/ảnh.
- **BR-04 — Checkout (FR-21–28):** Giỏ gắn tài khoản và đồng bộ giữa thiết bị sau tải lại.
  Một biến thể trong giỏ là một dòng; thêm lại cộng số lượng. Chỉ dòng được chọn tham gia checkout.
  Checkout là toàn bộ hoặc không tạo gì; thông báo đầy đủ dòng không hợp lệ.
  Giá lấy theo dữ liệu sàn hiện tại; thay giá phải xác nhận lại trước tạo đơn.
  Khi tạo thành công, trừ tồn ngay; không có giữ tồn từ giỏ. Đơn và việc trừ tồn cùng thành công
  hoặc cùng không có hiệu lực. Snapshot gồm tên, SKU/thuộc tính biến thể, đơn giá, số lượng,
  thành tiền và địa chỉ nhận. Gửi lại cùng ý định checkout trả về cùng đơn.
- **BR-05 — Giá trị giao dịch (FR-25–27, FR-33–36, FR-43–46):** MVP dùng VND; không voucher,
  thuế tính riêng hoặc chiết khấu. Phí giao mô phỏng bằng 0 và hiển thị rõ.
  Thành tiền dòng = đơn giá × số lượng; Seller Order = tổng dòng của shop;
  Order tổng = tổng các Seller Orders, kể cả phần hủy để bảo toàn giá trị gốc.
  Hiển thị riêng giá trị hủy, đã trả, hoàn mô phỏng và còn phải trả. Không làm tròn mất tiền.
- **BR-06 — Thanh toán (FR-33–36):** COD ghi chưa thu ở đầu, đã thu theo từng Seller Order
  khi xác nhận giao và thu tiền mô phỏng. Mock Payment trả một lần cho toàn phần còn hiệu lực
  của Order trước khi Seller xác nhận. Lần thử có PENDING/SUCCEEDED/FAILED/CANCELLED;
  thử lại chỉ khi chưa có thành công, đơn còn hiệu lực và trong 15 phút từ tạo đơn.
  Thất bại/hủy lần thử không tự hủy Order; hết 15 phút mà chưa trả thành công thì hủy các phần
  PENDING và hoàn tồn đúng một lần. COD không áp dụng thời hạn thanh toán này.
  Thành công lặp không tăng tiền; kết quả mâu thuẫn không ghi đè thành công đã xác nhận.
  Hủy phần đã trả tạo bản ghi hoàn mô phỏng đúng giá trị phần hủy, không đổi lịch sử lần trả;
  phần chưa thu COD không phát sinh hoàn tiền. Không thu thập dữ liệu thẻ hoặc tiền thật.
- **BR-07 — Hủy và trạng thái (FR-29–32):** Buyer hủy riêng Seller Order PENDING;
  hủy toàn Order chỉ thành công khi mọi phần chưa hủy đều PENDING. Seller được từ chối PENDING
  hoặc hủy CONFIRMED trước PACKING kèm lý do. Mọi hủy hợp lệ hoàn tồn đúng một lần.
  Sau PACKING không hủy trực tiếp. Seller Order chuyển PENDING → CONFIRMED → PACKING → SHIPPING
  → DELIVERED → COMPLETED. CONFIRMED với Mock Payment yêu cầu đã trả; COD không cần trả trước.
  Không cho bỏ bước, chuyển ngược hoặc thao tác tiếp trên CANCELLED/COMPLETED.
  Giao thất bại giữ phần đơn ở SHIPPING với cảnh báo shipment FAILED, cho giao lại;
  Admin được xác nhận hàng hoàn về để đóng CANCELLED, hoàn tồn/tiền mô phỏng đúng một lần.
  Chưa xác nhận hoàn về thì không tự tăng tồn. Tất cả thay đổi có người thực hiện, thời gian, lý do.
- **BR-08 — Tổng hợp Order (FR-26, FR-29, FR-32):** Order không nhận trạng thái tùy ý.
  Nếu mọi phần CANCELLED thì tổng CANCELLED; nếu mọi phần còn hiệu lực COMPLETED thì tổng
  COMPLETED (kèm chỉ báo hủy một phần nếu có). Các trường hợp khác lấy giai đoạn sớm nhất
  trong các phần chưa hủy/chưa COMPLETED, theo thứ tự PENDING, CONFIRMED, PACKING, SHIPPING,
  DELIVERED; hiển thị từng phần song song để không mất thông tin tiến độ.
  Thanh toán tổng thể hiển thị UNPAID, PARTIALLY_PAID, PAID, PARTIALLY_REFUNDED hoặc REFUNDED
  từ các lần thu/hoàn; không suy trạng thái tiền chỉ từ trạng thái đơn.
- **BR-09 — Vận chuyển (FR-37–39):** Mỗi Seller Order có một shipment mô phỏng, được kích hoạt
  khi PACKING: WAITING_PICKUP → PICKED_UP → IN_TRANSIT → DELIVERED hoặc FAILED.
  Bàn giao chuyển Seller Order SHIPPING; shipment DELIVERED chuyển phần đơn DELIVERED.
  Seller phụ trách shop và Admin được thao tác mô phỏng; Buyer chỉ xem và xác nhận đã nhận.
  Buyer xác nhận nhận chỉ khi DELIVERED và đã thanh toán/thu COD; không tự hoàn thành theo thời gian.
  Thử giao lại từ FAILED về WAITING_PICKUP giữ lịch sử và không trừ tồn thêm.
- **BR-10 — Sau bán/quản trị (FR-40–50):** Một review trên mỗi Order Item COMPLETED của chính
  Buyer; không có sửa/xóa/phản hồi Seller trong MVP. Seller xem/lọc đánh giá hàng của shop.
  Tài khoản ACTIVE với membership ACTIVE được xem reviews, thống kê và doanh thu của shop
  ACTIVE hoặc SUSPENDED; shop PENDING/REJECTED không được truy cập các chức năng này.
  Seller dashboard đếm sản phẩm chưa ngừng bán, đơn PENDING, đang xử lý
  (CONFIRMED/PACKING/SHIPPING/DELIVERED), COMPLETED. Doanh thu mô phỏng = tổng giá trị các
  Seller Orders COMPLETED theo ngày hoàn thành, timezone Asia/Saigon; không tính đơn hủy/chưa xong.
  Dashboard Admin đếm mọi bản ghi người dùng/shop/sản phẩm/Order tổng, có nhãn trạng thái;
  giá trị giao dịch mô phỏng lấy tổng Seller Orders COMPLETED, không đếm kép Order tổng.
  Admin không sửa trực tiếp snapshot, tiền hoặc giao dịch đã hoàn tất. MVP không có quy trình
  điều chỉnh giao dịch hoàn tất; chỉ tra cứu và ghi nhận sự cố, giữ nhật ký quản trị.

### Platform and Screen Coverage

| Phạm vi | Màn hình/chức năng bắt buộc | Nghiệm thu |
| --- | --- | --- |
| Buyer Web, Android, iOS | Trang chủ, đăng ký/đăng nhập, danh sách hàng, tìm kiếm/bộ lọc, chi tiết hàng, shop, giỏ, checkout, danh sách/chi tiết đơn, hồ sơ, địa chỉ; đánh giá từ đơn hoàn tất | Chạy US1, US4–8 trên từng nền tảng; dữ liệu thống nhất sau tải lại |
| Seller Web, Windows, macOS | Đăng ký shop, trạng thái duyệt, dashboard, danh sách/tạo/sửa sản phẩm, biến thể/tồn, danh sách/chi tiết/xử lý đơn, doanh thu, cài đặt shop; xem đánh giá | Chạy US2–3, US7–8 trên từng nền tảng với shop mẫu |
| Admin Web | Dashboard, người dùng, duyệt/quản lý shop, danh mục, kiểm duyệt sản phẩm, tra cứu đơn | Chạy US2, US3, US9 bằng Admin và kiểm tra từ chối vai trò khác |

Tất cả màn hình có loading, empty, error, success và thiếu quyền khi áp dụng;
biểu mẫu báo lỗi tại trường, thao tác hủy nêu phạm vi shop/tiền trước xác nhận.
Web thích ứng màn hình nhỏ và lớn; Mobile/Desktop có điều hướng theo nền tảng.
Không sao chép nguyên bản giao diện hoặc tài sản thương hiệu Shopee/Lazada.

### Acceptance Traceability

Mỗi nhóm FR phải đạt tất cả thao tác mô tả trong chính FR và điều kiện tương ứng sau:

| Yêu cầu nguồn | Story nghiệm thu | Quy tắc/điều kiện bổ sung |
| --- | --- | --- |
| FR-01–06 | US1, US2.4, US9.1 | BR-01; truy cập sai người/sai shop phải bị từ chối |
| FR-07–10 | US2 | BR-01–02; khóa shop không tạo giao dịch mới |
| FR-11–15 | US3 | BR-02–03; đơn cũ không đổi khi sửa hàng |
| FR-16–20 | US4 | BR-03; dữ liệu ẩn/khóa không được mua |
| FR-21–24 | US5.1, US5.3 | BR-03–04; giỏ chỉ chọn đúng dòng và kiểm tra lại |
| FR-25–28 | US5.2–5 | BR-04–05; một đơn tổng, một phần/shop, không vượt tồn |
| FR-29–32 | US6.4–5, US7 | BR-07–09; chỉ chuyển/hủy đúng quyền và trạng thái |
| FR-33–36 | US6.1–3 | BR-05–06; trả lại, hết hạn, hoàn mô phỏng không trùng |
| FR-37–39 | US7.2–4 | BR-09; giao thất bại/giao lại và lịch sử nhất quán |
| FR-40–42 | US8.1, US8.3 | BR-10; chỉ đánh giá một lần/dòng hoàn tất |
| FR-43–45 | US8.2 | BR-05, BR-10; thống kê đúng shop/ngày/tháng |
| FR-46–50 | US9 | BR-01–03, BR-10; số liệu không đếm kép, nhật ký quản trị |
| Màn hình/đa nền tảng | US10 | Ma trận Platform and Screen Coverage |

### Non-Functional Requirements

- **NFR-01:** Thông tin riêng tư, đơn và thao tác quản trị chỉ có người được phép xem/thực hiện;
  thông báo lỗi không tiết lộ dữ liệu bí mật hoặc chi tiết nội bộ. Kiểm tra cả truy cập trực tiếp.
- **NFR-02:** Giao diện hỗ trợ bàn phím ở Web/Desktop, nhãn trường và thông báo lỗi đọc được;
  thao tác chính dùng được ở chiều rộng 360 và 1280 điểm hiển thị mà không mất nút quan trọng.
- **NFR-03:** Trạng thái đã lưu phải còn sau khởi động lại và hiện nhất quán giữa ứng dụng
  sau tải lại. Khi mạng lỗi phải cho tra cứu/thử lại an toàn, không báo lưu thành công giả.
- **NFR-04:** Bàn giao có hướng dẫn chạy môi trường demo, cấu hình, thay đổi cấu trúc dữ liệu,
  dữ liệu mẫu và kiểm thử; người khác chạy lại được luồng demo từ hướng dẫn.
  Thiết kế kỹ thuật, tài liệu hệ thống và các cấp kiểm thử tuân thủ hiến chương.

### Scope Boundaries

Trong MVP: toàn bộ FR-01–50, quản lý tồn kho biến thể, xem đánh giá Seller, màn hình và nền tảng
trong ma trận. Một lần đặc tả tổng thể, triển khai theo milestone có phụ thuộc, không làm mọi module cùng lúc.

Ngoài MVP: thanh toán ngân hàng thật, ví riêng, vận chuyển thật, livestream, gợi ý AI, flash sale tải lớn,
chat realtime, quảng cáo, hoa hồng/đối soát Seller thực, voucher/khuyến mãi, đổi trả sau hoàn tất,
quên mật khẩu/xác minh email qua dịch vụ bên ngoài, quản lý nhân viên shop bằng giao diện,
quy trình sửa giao dịch hoàn tất. Không đưa kiến trúc phân tán vào phạm vi nghiệp vụ MVP.

### Key Entities *(include if feature involves data)*

- **User / Session:** Danh tính, hồ sơ, trạng thái hoạt động, các vai trò và phiên có thể thu hồi.
- **Address:** Địa chỉ của User, cờ mặc định; độc lập snapshot địa chỉ của đơn.
- **Shop / Shop Membership:** Hồ sơ, slug, trạng thái duyệt/khóa và người có quyền tại shop;
  một User liên quan nhiều Shop, một Shop có người quản lý được cấp quyền.
- **Category:** Danh mục cha/con và trạng thái hiển thị; chứa nhiều Product.
- **Product / Product Image:** Hàng hóa của shop, danh mục, nội dung, ảnh và trạng thái bán/kiểm duyệt.
- **ProductVariant / Inventory:** SKU, lựa chọn thuộc tính, giá và số lượng khả dụng riêng;
  thay đổi tồn phải liên hệ được với bán, hủy hoặc điều chỉnh hợp lệ.
- **Cart / Cart Item:** Giỏ của Buyer; mỗi dòng chọn một biến thể và số lượng, nhóm theo shop.
- **Order:** Checkout của Buyer, snapshot người nhận, tổng gốc, tổng hủy/thu/hoàn và trạng thái tổng hợp.
- **SellerOrder:** Phần Order thuộc một shop, trạng thái xử lý và các giá trị tiền độc lập.
- **OrderItem:** Dòng thuộc SellerOrder; snapshot hàng/biến thể, đơn giá, số lượng và thành tiền.
- **Payment Attempt / Payment Allocation / Simulated Refund:** Lần trả có định danh/kết quả,
  phân bổ theo SellerOrder, lần thu COD và hoàn mô phỏng liên kết phần bị hủy, không đếm kép.
- **Shipment / Shipment Event:** Một SellerOrder có thông tin giao nhận và lịch sử mô phỏng.
- **Review:** Buyer, OrderItem, sản phẩm, điểm 1–5, bình luận, thời gian; tối đa một lần/dòng.
- **Audit Event:** Ai làm gì, khi nào, đối tượng, lý do và kết quả của thao tác nhạy cảm/quản trị.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001:** Demo trọn hành trình Guest xem hàng → đăng ký → đăng ký/duyệt shop → đăng hàng
  → mua từ ít nhất 2 shop → trả mô phỏng → xử lý/giao → nhận/đánh giá, không sửa dữ liệu thủ công.
- **SC-002:** Tất cả 50 FR và các trường hợp chấp nhận tương ứng đạt nghiệm thu;
  không còn lỗi cho phép sai quyền, sai giá, vượt tồn hoặc mất lịch sử giao dịch.
- **SC-003:** Trong 20 yêu cầu mua đồng thời cùng biến thể còn 5 đơn vị (mỗi yêu cầu 1 đơn vị),
  đúng 5 đơn được chấp nhận, 15 nhận thông báo hết hàng và tồn cuối bằng 0.
- **SC-004:** Gửi lại cùng checkout, thanh toán hoặc hủy 10 lần chỉ tạo một hiệu lực nghiệp vụ;
  100% số tiền, số đơn và lượng hàng cuối cùng khớp kết quả xử lý một lần.
- **SC-005:** Với giỏ hợp lệ gồm 5 dòng thuộc 2 shop và địa chỉ sẵn có,
  ít nhất 4/5 người dùng thử hoàn thành checkout trong 3 phút mà không cần người hướng dẫn;
  mỗi người chạy một lần, không tính thời gian chờ Admin/Seller.
- **SC-006:** Trên bộ demo 1.000 sản phẩm/10 shop, 20 người dùng đồng thời, trong 100 lần
  tìm kiếm hoặc mở danh sách, ít nhất 95 lần thấy kết quả trong 2 giây ở môi trường đo đã ghi rõ.
- **SC-007:** Mọi thử truy cập hồ sơ/đơn người khác, shop không được cấp quyền và chức năng Admin
  bằng tài khoản không có quyền đều bị từ chối, không lộ dữ liệu hoặc đổi dữ liệu.
- **SC-008:** Toàn bộ số liệu ngày/tháng Seller và tổng sàn khớp bộ dữ liệu mẫu có cả đơn hoàn tất,
  hủy, chưa trả, hoàn mô phỏng; không sai lệch tiền hoặc đếm trùng Order tổng/SellerOrder.
- **SC-009:** Chạy thành công hành trình Buyer trên Web/Android/iOS và quản lý shop trên
  Web/Windows/macOS; mỗi thay đổi đã lưu xuất hiện trên ứng dụng còn lại sau tải lại.
- **SC-010:** Một thành viên chưa thiết lập dự án chạy được demo theo hướng dẫn trong 30 phút
  sau khi đã có các công cụ tiền đề; không cần bước bí mật hoặc chỉnh giao dịch thủ công.

## Assumptions

- Các BR-01–10 là mặc định nghiệp vụ được đề xuất cho phần chưa rõ, có thể rà soát bằng
  `$speckit-clarify` trước kế hoạch. Chúng không thêm nghiệp vụ tiền thật.
- MVP cho thị trường nội địa Việt Nam, VND, Asia/Saigon, giao hàng mô phỏng miễn phí;
  không quản lý nhiều loại tiền, thuế riêng, ưu đãi hoặc phân chia phí vận chuyển.
- Mỗi checkout có một địa chỉ giao cho tất cả shop; việc đổi địa chỉ sau tạo đơn ngoài MVP.
- Trừ tồn khi tạo đơn, thời hạn Mock Payment 15 phút, hủy theo SellerOrder và hoàn mô phỏng
  là lựa chọn đơn giản để xác định được kết quả; phải review các mặc định này trước triển khai.
- Người dùng có kết nối mạng; chế độ offline không nằm trong MVP.
- Admin đầu tiên và membership shop bổ sung được cấp bằng quy trình thiết lập demo có kiểm soát;
  không có tự nâng quyền hoặc tự cấp quyền shop khác.
- Tiêu chí hiệu năng/usability là mục tiêu nghiệm thu đề xuất theo quy mô đồ án,
  chưa phải kết quả đo. Kế hoạch kiểm thử phải ghi cấu hình môi trường, dữ liệu và thiết bị.
- Chưa có ứng dụng hiện hữu để tái sử dụng. Dependency nghiệp vụ: tài khoản → shop được duyệt
  → danh mục/sản phẩm/biến thể/tồn → giỏ → checkout → thanh toán/xử lý/giao → đánh giá/thống kê.
  Có thể kiểm thử từng story bằng dữ liệu mẫu cho các dependency chưa triển khai.
- Chưa có PROJECT_RULES.md mà nguồn nhắc tới; hiến chương hiện tại là nguồn quy tắc đang có.
  Khi nhận file đó, cần đối chiếu khác biệt trước khi áp dụng, không tự giả định nội dung.
- Bước planning xử lý thiết kế dữ liệu chi tiết, hợp đồng giao tiếp, kiến trúc, sơ đồ checkout,
  roadmap/dependency và thứ tự triển khai; đặc tả này chỉ quyết định hành vi và nghiệm thu.
