# Multi-vendor Marketplace MVP

Workspace cho đồ án nền tảng thương mại điện tử đa người bán. Phạm vi MVP và các quyết định sản phẩm nằm trong `specs/001-marketplace-mvp/`.

## Trạng thái hiện tại

Repo đã có monorepo skeleton, package manifests, lockfile, cấu hình TypeScript dùng chung, lint/format và `.env.example`. Source nghiệp vụ, Docker Compose, database migrations và các lệnh test ứng dụng chưa được triển khai; tài liệu setup mô tả contract mục tiêu, không khẳng định ứng dụng đã chạy được.

## Bắt đầu

- [Hướng dẫn phát triển local](docs/development/local.md): toolchain, ports, env, scripts và bảo vệ database.
- [Quickstart và validation guide](specs/001-marketplace-mvp/quickstart.md): các bước setup/test mục tiêu và acceptance scenarios.
- [Specification](specs/001-marketplace-mvp/spec.md), [implementation plan](specs/001-marketplace-mvp/plan.md) và [task list](specs/001-marketplace-mvp/tasks.md).

## Các lệnh đã cấu hình

Dùng Node.js 24.18.0 và pnpm 12.14.0 theo `.nvmrc` và `package.json`. Hiện có thể dùng `pnpm lint`, `pnpm lint:workspaces`, `pnpm typecheck` và `pnpm format:check`; các workspace chưa có mã nguồn nên lint/typecheck sẽ báo skip. Các test nghiệp vụ, database, API và native sẽ được bổ sung cùng implementation tương ứng.

Xem [hướng dẫn local](docs/development/local.md) trước khi cài dependencies hoặc chạy service.
