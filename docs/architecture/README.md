# Tài liệu kiến trúc và phân tích — Marketplace MVP

Bộ tài liệu này hoàn thành phần tài liệu phân tích/thiết kế còn thiếu của task **T154** (`tasks.md`): use-case, sequence, ERD, cùng BFD và DFD. Các sơ đồ dùng **Mermaid**, hiển thị trực tiếp trên GitHub, GitLab, VS Code (extension Markdown Preview Mermaid Support) và Claude.

| # | Tài liệu | Nội dung | Số sơ đồ |
| --- | --- | --- | --- |
| 1 | [01-bfd.md](01-bfd.md) | Sơ đồ phân rã chức năng 3 cấp (F0 → F10 → 56 chức năng lá), ánh xạ FR và module | 4 |
| 2 | [02-dfd.md](02-dfd.md) | DFD mức 0, mức 1 (10 tiến trình, 11 kho dữ liệu), mức 2 cho Checkout/Đơn hàng và Thanh toán | 5 |
| 3 | [03-usecase.md](03-usecase.md) | Sơ đồ use case theo actor; 42 use case, 40 có đặc tả chi tiết; ma trận truy vết 50 FR | 5 |
| 4 | [04-erd.md](04-erd.md) | ERD tổng quan và 5 ERD chi tiết theo miền, 29 bảng, ràng buộc và bất biến | 6 |
| 5 | [05-sequence.md](05-sequence.md) | 16 sơ đồ tuần tự cho các luồng chính, nhánh lỗi, đồng thời, idempotency | 16 |

## Nguồn và nguyên tắc

- **Nghiệp vụ:** `specs/001-marketplace-mvp/spec.md` (FR-01–50, BR-01–10), `docs/requirements/srs.md`. Mã UC-01…UC-11 giữ nguyên theo SRS; tài liệu use case phân rã thêm thành UC-xx.y.
- **Dữ liệu:** ERD lấy từ `apps/api/prisma/schema.prisma` (28 model thực tế; `Review` còn thiết kế) cộng `Review` từ `data-model.md`.
- **Luồng API:** lấy từ `contracts/api.md`; trạng thái "có/chưa có code" đối chiếu với 77 route thực tế trong `*.controller.ts`.
- Các tài liệu chỉ mô tả hành vi đã chốt trong spec/contract; không thêm nghiệp vụ mới.

## Đối chiếu và điểm lệch phát hiện khi viết tài liệu

1. **`reviews` chưa có trong `schema.prisma`** dù đã thiết kế ở `data-model.md` (Sprint 6).
2. **Chưa có route** cho 5 endpoint US8: `POST /reviews`, `GET /products/{id}/reviews`, `GET /shops/{id}/reviews`, `GET /shops/{id}/stats`, `GET /shops/{id}/revenue`. Module `review` còn trống. Các route US7 (xử lý đơn, shipment) và US9 (admin) **đã có** tại `main` (commit `8ee488a`).
3. **Quyền Admin** gom về `apps/api/src/common/auth/permissions.ts` (bảng `adminPermissionChecks`); hiện mọi quyền trả về `isAdmin`. Thêm vai trò mới chỉ cần sửa bảng này.
4. **T121–T129 (US9) chưa tick có chủ đích:** các task này `Depends: T120` (nghiệm thu US8). Mã và evidence US9 đã có tại `docs/testing/us9-evidence.md`; chỉ tick sau khi US8 xong.
5. Trạng thái "có route" chỉ nghĩa là endpoint tồn tại trong mã, **không** chứng minh đã chạy hoặc đạt nghiệm thu (xem `docs/testing/*-evidence.md` cho bằng chứng kiểm thử).

## Cách cập nhật

Khi thay đổi nghiệp vụ, cập nhật cùng lúc: `spec.md` → `contracts/api.md` → `data-model.md` / `schema.prisma` → các sơ đồ tại đây. Mermaid có thể kiểm tra cú pháp bằng `mermaid.parse` (đã chạy cho cả 36 sơ đồ ở thời điểm tạo, 0 lỗi).
