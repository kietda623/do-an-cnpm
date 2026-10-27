# BFD — Sơ đồ phân rã chức năng (Business Function Diagram)

**Dự án:** Multi-vendor Marketplace MVP
**Nguồn:** `specs/001-marketplace-mvp/spec.md` (FR-01–FR-50, BR-01–BR-10), `docs/requirements/srs.md`
**Phạm vi:** Phân rã hệ thống từ mức gốc xuống các chức năng lá. Mỗi chức năng lá gắn mã FR để truy vết.

> Quy ước mã: **F0** = hệ thống, **F1…F10** = nhóm chức năng cấp 1, **F1.1…** = chức năng cấp 2.
> Nhóm chức năng cấp 1 ánh xạ logic với module backend trong `apps/api/src/modules/*`: một nhóm có thể dùng nhiều module, và một module có thể phục vụ nhiều nhóm (xem bảng cuối tài liệu).

---

## 1. BFD cấp 1 — các nhóm chức năng của hệ thống

```mermaid
flowchart TD
  F0["F0. Hệ thống Marketplace đa người bán"]

  F1["F1. Quản lý tài khoản<br/>và phân quyền"]
  F2["F2. Quản lý cửa hàng"]
  F3["F3. Quản lý danh mục,<br/>sản phẩm và tồn kho"]
  F4["F4. Khám phá hàng hóa"]
  F5["F5. Giỏ hàng và Checkout"]
  F6["F6. Quản lý đơn hàng"]
  F7["F7. Thanh toán"]
  F8["F8. Vận chuyển mô phỏng"]
  F9["F9. Đánh giá và thống kê"]
  F10["F10. Quản trị sàn<br/>và nhật ký"]

  F0 --> F1
  F0 --> F2
  F0 --> F3
  F0 --> F4
  F0 --> F5
  F0 --> F6
  F0 --> F7
  F0 --> F8
  F0 --> F9
  F0 --> F10
```

---

## 2. BFD cấp 2 — phân rã chi tiết

### 2.1. F1 Tài khoản · F2 Cửa hàng · F3 Danh mục/Sản phẩm/Tồn kho

```mermaid
flowchart LR
  F1["F1. Tài khoản<br/>và phân quyền"]
  F1 --> F11["F1.1 Đăng ký<br/>FR-01"]
  F1 --> F12["F1.2 Đăng nhập, cấp phiên,<br/>refresh token<br/>FR-02"]
  F1 --> F13["F1.3 Đăng xuất,<br/>thu hồi phiên<br/>FR-03"]
  F1 --> F14["F1.4 Quản lý hồ sơ,<br/>avatar, đổi mật khẩu<br/>FR-04"]
  F1 --> F15["F1.5 Quản lý địa chỉ<br/>giao hàng<br/>FR-05"]
  F1 --> F16["F1.6 Phân quyền theo vai trò<br/>và phạm vi shop<br/>FR-06"]

  F2["F2. Quản lý cửa hàng"]
  F2 --> F21["F2.1 Đăng ký mở shop<br/>FR-07"]
  F2 --> F22["F2.2 Duyệt / từ chối shop<br/>FR-08, FR-48"]
  F2 --> F23["F2.3 Sửa hồ sơ shop,<br/>logo, banner<br/>FR-09"]
  F2 --> F24["F2.4 Khóa / mở khóa shop<br/>FR-10"]
  F2 --> F25["F2.5 Gửi lại yêu cầu<br/>shop bị từ chối<br/>BR-02"]

  F3["F3. Danh mục, sản phẩm,<br/>tồn kho"]
  F3 --> F31["F3.1 Quản lý danh mục<br/>cha / con<br/>FR-11"]
  F3 --> F32["F3.2 Tạo sản phẩm<br/>và ảnh<br/>FR-12"]
  F3 --> F33["F3.3 Quản lý biến thể<br/>SKU, giá, thuộc tính<br/>FR-13"]
  F3 --> F34["F3.4 Sửa sản phẩm,<br/>ngừng bán<br/>FR-14, FR-15"]
  F3 --> F35["F3.5 Điều chỉnh tồn kho<br/>và ghi movement<br/>FR-28"]
  F3 --> F36["F3.6 Tải và xác thực<br/>ảnh (Asset)<br/>BR-03"]
```

### 2.2. F4 Khám phá · F5 Giỏ hàng/Checkout · F6 Đơn hàng

```mermaid
flowchart LR
  F4["F4. Khám phá hàng hóa"]
  F4 --> F41["F4.1 Danh sách sản phẩm<br/>phân trang<br/>FR-17"]
  F4 --> F42["F4.2 Tìm kiếm theo tên,<br/>từ khóa, danh mục<br/>FR-18"]
  F4 --> F43["F4.3 Lọc khoảng giá,<br/>sắp xếp<br/>FR-19"]
  F4 --> F44["F4.4 Chi tiết sản phẩm<br/>theo biến thể<br/>FR-16, FR-41"]
  F4 --> F45["F4.5 Trang shop công khai<br/>FR-20"]

  F5["F5. Giỏ hàng và Checkout"]
  F5 --> F51["F5.1 Thêm vào giỏ<br/>FR-21"]
  F5 --> F52["F5.2 Sửa số lượng, xóa,<br/>chọn dòng thanh toán<br/>FR-22"]
  F5 --> F53["F5.3 Nhóm giỏ theo shop<br/>FR-23"]
  F5 --> F54["F5.4 Tạo báo giá checkout<br/>kiểm tra lại giá, tồn<br/>FR-24"]
  F5 --> F55["F5.5 Đặt hàng idempotent,<br/>tách đơn theo shop<br/>FR-25, FR-26"]
  F5 --> F56["F5.6 Lưu snapshot,<br/>trừ tồn nguyên tử<br/>FR-27, FR-28"]

  F6["F6. Quản lý đơn hàng"]
  F6 --> F61["F6.1 Buyer xem lịch sử<br/>và chi tiết đơn<br/>FR-29"]
  F6 --> F62["F6.2 Seller lọc và xem<br/>SellerOrder của shop<br/>FR-44"]
  F6 --> F63["F6.3 Seller xác nhận,<br/>đóng gói<br/>FR-30"]
  F6 --> F64["F6.4 Buyer hủy đơn<br/>Seller từ chối / hủy<br/>FR-31"]
  F6 --> F65["F6.5 Kiểm soát trạng thái<br/>và tổng hợp Order<br/>FR-32"]
  F6 --> F66["F6.6 Buyer xác nhận<br/>đã nhận hàng<br/>FR-32"]
```

### 2.3. F7 Thanh toán · F8 Vận chuyển · F9 Đánh giá/Thống kê · F10 Quản trị

```mermaid
flowchart LR
  F7["F7. Thanh toán"]
  F7 --> F71["F7.1 Chọn COD<br/>FR-33"]
  F7 --> F72["F7.2 Tạo lần thử<br/>thanh toán mô phỏng<br/>FR-34"]
  F7 --> F73["F7.3 Ghi kết quả:<br/>thành công / thất bại / hủy<br/>FR-34, FR-35"]
  F7 --> F74["F7.4 Thử lại khi thất bại<br/>FR-36"]
  F7 --> F75["F7.5 Hết hạn 15 phút<br/>và hoàn tồn<br/>FR-36, BR-06"]
  F7 --> F76["F7.6 Xử lý kết quả đến muộn<br/>và hoàn mô phỏng<br/>BR-06"]
  F7 --> F77["F7.7 Thu COD theo SellerOrder<br/>FR-33"]

  F8["F8. Vận chuyển mô phỏng"]
  F8 --> F81["F8.1 Tạo shipment khi PACKING<br/>FR-37"]
  F8 --> F82["F8.2 Cập nhật trạng thái<br/>lấy hàng, vận chuyển, giao<br/>FR-38"]
  F8 --> F83["F8.3 Theo dõi vận chuyển<br/>FR-39"]
  F8 --> F84["F8.4 Giao lại khi thất bại<br/>BR-09"]
  F8 --> F85["F8.5 Admin xác nhận<br/>hàng hoàn về<br/>BR-07"]

  F9["F9. Đánh giá và thống kê"]
  F9 --> F91["F9.1 Tạo đánh giá<br/>1–5 sao<br/>FR-40, FR-42"]
  F9 --> F92["F9.2 Xem đánh giá<br/>FR-41"]
  F9 --> F93["F9.3 Dashboard shop<br/>FR-43"]
  F9 --> F94["F9.4 Doanh thu ngày / tháng<br/>mô phỏng<br/>FR-45"]

  F10["F10. Quản trị sàn<br/>và nhật ký"]
  F10 --> F101["F10.1 Quản lý tài khoản<br/>xem, tìm, khóa, mở<br/>FR-47"]
  F10 --> F102["F10.2 Kiểm duyệt sản phẩm<br/>FR-49"]
  F10 --> F103["F10.3 Thống kê hệ thống<br/>FR-46"]
  F10 --> F104["F10.4 Tra cứu đơn<br/>FR-50"]
  F10 --> F105["F10.5 Nhật ký audit<br/>BR-10"]
  F10 --> F106["F10.6 Xử lý đơn khi tài khoản<br/>Seller bị khóa<br/>spec Edge Case"]
```

---

## 3. Bảng ánh xạ nhóm chức năng ↔ vai trò ↔ module

| Nhóm | Tên | Vai trò sử dụng | FR | Module backend (`apps/api/src/modules`) | Trạng thái code* |
| --- | --- | --- | --- | --- | --- |
| F1 | Tài khoản và phân quyền | Guest, Buyer, Seller, Admin | FR-01–06 | `identity` | Có controller |
| F2 | Quản lý cửa hàng | Buyer/Seller, Admin | FR-07–10, 48 | `shop` | Có controller |
| F3 | Danh mục, sản phẩm, tồn kho | Admin, Seller | FR-11–15, 28, 49 | `catalog`, `inventory` | Có route |
| F4 | Khám phá hàng hóa | Guest, Buyer | FR-16–20 | `catalog` (discovery) | Có controller |
| F5 | Giỏ hàng và Checkout | Buyer | FR-21–28 | `cart`, `order` | Có controller |
| F6 | Quản lý đơn hàng | Buyer, Seller, Admin | FR-29–32, 44, 50 | `order` | Có route (xem đơn, hủy, từ chối, confirm, pack, receive) |
| F7 | Thanh toán | Buyer, Seller, System | FR-33–36 | `payment` (+ `jobs` cho expiry) | Có controller |
| F8 | Vận chuyển mô phỏng | Seller, Admin, Buyer | FR-37–39 | `shipping` | Có route (module `shipping`) |
| F9 | Đánh giá và thống kê | Buyer, Seller | FR-40–45 | `review` | Chưa có (US8): reviews, thống kê, doanh thu |
| F10 | Quản trị sàn và nhật ký | Admin | FR-46–50 | `admin` (+ `shop`/`catalog`/`order` admin routes) | Có route (users, products, orders, stats, audit, recovery) |

\* Đối chiếu với **77 route thực tế** trong các `*.controller.ts` tại `main` (commit `8ee488a`). Module `review` còn trống (US8). Đây là đối chiếu mã nguồn, **không** phải kết quả chạy test hay nghiệm thu.

## 4. Độ phủ FR

Các nhóm F1–F10 phủ đủ FR-01–FR-50 của spec. Ngoài FR, BFD ghi thêm ba chức năng hỗ trợ từ BR/Edge Case để không bị bỏ sót khi thiết kế: **F2.5** (gửi lại shop bị từ chối), **F7.6** (kết quả thanh toán đến muộn), **F10.6** (Admin xử lý đơn khi tài khoản Seller bị khóa).
