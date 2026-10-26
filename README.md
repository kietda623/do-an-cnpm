# Multi-vendor Marketplace MVP

Workspace cho đồ án nền tảng thương mại điện tử đa người bán. Phạm vi MVP và các quyết định sản phẩm nằm trong `specs/001-marketplace-mvp/`.

## Trạng thái hiện tại

Repo đã có monorepo, NestJS API, PostgreSQL/Prisma migrations đến `0007_shipments`, Docker Compose, ba ứng dụng web và mã cho identity, shop, catalog, inventory, cart, checkout, thanh toán mô phỏng và hủy đơn. Giao hàng hiện có schema và policy; các route xử lý SellerOrder, shipment, review và phần lớn admin vẫn chưa hoàn tất. Tình trạng task và giới hạn kiểm thử được ghi trong [task list](specs/001-marketplace-mvp/tasks.md) và `docs/testing/`. Chưa có bằng chứng nghiệm thu toàn bộ marketplace trên môi trường local hiện tại.

## Bắt đầu

- [Hướng dẫn phát triển local](docs/development/local.md): toolchain, ports, env, scripts và bảo vệ database.
- [Quickstart và validation guide](specs/001-marketplace-mvp/quickstart.md): các bước setup/test mục tiêu và acceptance scenarios.
- [Specification](specs/001-marketplace-mvp/spec.md), [implementation plan](specs/001-marketplace-mvp/plan.md) và [task list](specs/001-marketplace-mvp/tasks.md).

## Các lệnh đã cấu hình

Dùng Node.js 24.18.0 và pnpm 12.14.0 theo `.nvmrc` và `package.json`. Repo cấu hình `pnpm lint:workspaces`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build`, API integration test và Prisma schema check. Việc có script không đồng nghĩa các lệnh đã chạy thành công trên máy của bạn; xem kết quả thực tế trong CI và tài liệu bằng chứng từng story.

Xem [hướng dẫn local](docs/development/local.md) trước khi cài dependencies hoặc chạy service.
