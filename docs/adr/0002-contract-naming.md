# ADR-0002: Tên và hình dạng contract marketplace

- **Trạng thái:** Accepted as MVP design baseline
- **Ngày:** 2026-10-21
- **Ngữ cảnh:** Các client Web/Mobile/Desktop phải dùng một HTTP contract nhất quán, trong khi dữ liệu nội bộ cần giữ state machine rõ và không để lộ chi tiết persistence.

## Quyết định

`packages/contracts` là package duy nhất cho OpenAPI, generated transport types và ví dụ contract. HTTP API dùng `/api/v1`, UUID cho resource IDs, tiền VND truyền dạng chuỗi thập phân, timestamp ISO-8601 UTC, pagination có giới hạn, error envelope có requestId và mutation nhạy cảm có `Idempotency-Key`. `packages/api-client` tiêu thụ schema/types được sinh từ OpenAPI.

Field bán công khai/ghi qua API là `selling` kiểu boolean. Trường nội bộ Product và ProductVariant là `sale_status`; ánh xạ là `selling=true` chỉ khi state ACTIVE và các điều kiện eligibility khác đều đạt. Contract không nhận `sale_status` trực tiếp. `admin_hidden`, shop/category eligibility và stock vẫn được backend kiểm tra riêng; `selling=true` không tự cấp quyền mua.

Naming domain trong PostgreSQL/Prisma có thể snake_case qua mapping; API DTO dùng camelCase. Không tạo package thứ hai có tên `contract` hoặc `contracts` ở vị trí khác.

## Lựa chọn và hệ quả

Boolean `selling` diễn đạt ý định bán đơn giản cho client; state machine nội bộ giữ DRAFT/ACTIVE/DISCONTINUED và quyền moderation. Server phải diễn giải boolean thành command hợp lệ, không gán thẳng trạng thái. Generated contract tránh client tự tạo DTO lệch nhau; OpenAPI là input cần review trước codegen.

Đổi tên/shape API là thay đổi tương thích cần cập nhật OpenAPI, examples, generated client, contract tests và migration mapping nếu có; internal `sale_status` không đổi chỉ vì contract đổi.

## Bằng chứng/chấp nhận

Mọi tham chiếu workspace dùng `packages/contracts`; API DTO dùng `selling`; storage docs/schema dùng `sale_status`. Chi tiết endpoint và field dictionary tại [API contract](../../specs/001-marketplace-mvp/contracts/api.md), entity mapping tại [data model](../../specs/001-marketplace-mvp/data-model.md).
