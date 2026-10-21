# ADR-0001: Modular monolith cho backend marketplace

- **Trạng thái:** Accepted as MVP design baseline
- **Ngày:** 2026-10-21
- **Ngữ cảnh:** Cần hỗ trợ nhiều client, giao dịch liên domain và một nhóm đồ án; cần giữ rõ ranh giới nghiệp vụ mà không tăng chi phí vận hành nhiều service.

## Quyết định

Backend chạy NestJS Modular Monolith, một API triển khai cùng PostgreSQL và S3-compatible object storage. Domain được chia module theo năng lực: Identity, Shop, Catalog/Media, Inventory, Cart, Orders, Payments, Shipping, Reviews, Admin, Audit. Nest module export public service/port có kiểu rõ; module tiêu thụ chỉ gọi API đó và không import repository, entity hoặc file nội bộ của module khác. `packages/contracts` là transport contract dùng chung client/server, không phải nơi chứa domain persistence hay logic backend.

Seller Center Web là ứng dụng client gốc dùng lại trong Tauri Desktop qua WebView; Desktop không nhân đôi UI hoặc business logic. Platform-specific secure storage/session adapter được cô lập, còn mọi quyền Seller vẫn do API backend áp dụng.

Order coordinator sở hữu orchestration checkout/cancel/order transition. Nó truyền transaction context cho các public port cần cập nhật cùng PostgreSQL transaction. Payment không callback ngược vào Order; coordinator gọi payment port. Admin chỉ phát lệnh nghiệp vụ được module sở hữu cung cấp, không sửa bảng hoặc snapshot trực tiếp.

## Ranh giới tin cậy và xác thực

- Mọi input và identity từ client đều không tin cậy. Backend xác thực access JWT ngắn hạn, kiểm tra session còn hiệu lực và tạo AccessContext bất biến cho request.
- Authentication xác nhận user/session; authorization kiểm tra system role cùng ownership/membership và phạm vi shop ở backend cho từng resource/action. Ẩn nút ở client không cấp quyền.
- Seller access yêu cầu ShopMember ACTIVE và role phù hợp cho đúng `shopId`; không suy ra quyền từ ID do client gửi.
- Web dùng cookie refresh an toàn theo contract, mobile/desktop dùng secure storage nền tảng; access token chỉ giữ trong memory client. Token, password, raw provider payload và PII thừa không ghi log.
- Web state-changing requests bảo vệ CSRF theo contract; CORS theo allowlist. Upload dùng Asset UUID, ownership và content verification; client không chọn object key public.
- Job/callback chỉ được tin cậy sau xác minh adapter/provider và idempotency; mọi hiệu ứng kinh tế được áp dụng trong transaction, callback muộn được bù trừ theo policy.

## Public interfaces và transaction

Public ports nhận command/query đã validate, actor context, resource scope và transaction context khi cần; trả domain result hoặc typed error. HTTP controller chỉ chuyển đổi HTTP ↔ application port. Repository chỉ được module sở hữu truy cập trực tiếp. `packages/api-client` tiêu thụ OpenAPI-generated DTO/transport types; không chia sẻ model Prisma ra client.

PostgreSQL là nguồn dữ liệu chuẩn. Checkout, settlement, cancel/return-stock và state transition ghi mọi bảng liên quan cùng transaction. Object storage/network calls không chạy bên trong transaction. Các module đọc dashboard không sở hữu aggregate persistence riêng nếu số có thể derive từ nguồn sự kiện.

## Lựa chọn và hệ quả

Một deployment giảm vận hành cho MVP và cho phép bảo đảm nguyên tử giữa order/payment/inventory. Ranh giới module vẫn cho phép kiểm tra import và phát triển tuần tự. Backend mở rộng theo chiều ngang sau này vẫn dựa vào PostgreSQL locks/idempotency. Trade-off là module có thể coupling qua transaction context; vì vậy port và thứ tự khóa phải được review cùng schema và test integration.

Microservices, message broker, Redis và job queue không được thêm cho MVP nếu không có yêu cầu/đo đạc chứng minh. Scheduler DB-backed chạy batch có claim/lock và idempotency.

## Bằng chứng/chấp nhận

Walkthrough: mỗi module có owner của dữ liệu và public port; không có import nội bộ chéo; Seller authorization kiểm tra membership theo shop; logout/session revoke được kiểm tra ở backend; checkout/cancel/payment effects cùng commit hoặc rollback. Chi tiết hợp đồng ở [API contract](../../specs/001-marketplace-mvp/contracts/api.md), cấu trúc module và delivery ở [plan](../../specs/001-marketplace-mvp/plan.md).
