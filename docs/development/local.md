# Phát triển local

## Trạng thái

Workspace có API NestJS, PostgreSQL migrations, Docker Compose và các bộ unit/contract/integration/E2E. API readiness yêu cầu cấu hình hợp lệ, PostgreSQL và Redis reachable; Redis là store dùng chung cho giới hạn request xác thực.

## Toolchain cần dùng

| Thành phần | Phiên bản / yêu cầu |
| --- | --- |
| Node.js | 24.18.0 theo `.nvmrc` (`>=24.15.0 <25`) |
| pnpm | 12.14.0 theo `packageManager` |
| Git | Bản hỗ trợ nhánh feature và pull request |
| Docker Engine + Compose plugin | Cần cho PostgreSQL, Redis và service containers |
| PostgreSQL | 17 theo plan; dev/test database phải tách biệt |
| Redis | Compose dùng `redis:8.10.3-alpine`; service local và test chỉ bind loopback |
| S3-compatible storage | Chỉ cần cho upload E2E khi có bucket; để trống S3 thì dev ghi file vào `ASSET_LOCAL_DIR` (mặc định `apps/api/uploads/`) và phục vụ qua `PUBLIC_API_URL/api/v1/assets`, production vẫn bắt buộc S3 |

Kiểm tra phiên bản bằng `node --version` và `pnpm --version`. `pnpm install --frozen-lockfile` chỉ dùng với pnpm 12 và sau khi package build-script policy của workspace được chấp thuận. Không thay đổi package manager toàn máy để chạy repo.

## Ports và URL

| Service | Port | Quy tắc |
| --- | ---: | --- |
| Storefront web | 3000 | Local development |
| Seller Center web | 3001 | Local development |
| Admin panel web | 3002 | Local development |
| API | 4000 | Local development; prefix `/api/v1`, Swagger `/api/docs`, liveness `/health/live`, readiness `/health/ready` |
| PostgreSQL development / test | 55432 / 55433 | Chỉ bind loopback; test chạy trong Compose profile `test` |
| Redis development / test | 56379 / 56380 | Chỉ bind loopback; test chạy trong Compose profile `test` |

Không chạy đồng thời hai app trên cùng port. Trình duyệt trên host dùng `localhost`; API container gọi PostgreSQL/Redis bằng service name `postgres`/`redis`. Buyer desktop (khi được triển khai) mở storefront URL này trong webview Tauri.

## Environment

Tạo file local từ mẫu:

```powershell
Copy-Item .env.example .env
```

Điền `DATABASE_URL`, JWT signing secret và các thông tin dịch vụ chỉ trong `.env`. Tạo `RATE_LIMIT_KEY_SECRET` riêng, ngẫu nhiên, dài ít nhất 32 ký tự; không dùng lại JWT secret. Kết nối từ host dùng `localhost` (`RATE_LIMIT_REDIS_URL=redis://localhost:56379`); API trong Compose dùng hostname `postgres` và `redis`. `API_TRUST_PROXY_HOPS` mặc định `0`; chỉ đặt số hop tin cậy khi triển khai sau proxy đã kiểm soát. JWT previous secret chỉ dùng verify trong thời gian rotation. Để trống S3/bootstrap admin nếu chưa được cấp quyền và chưa chủ đích cấu hình seed.

Để chạy API từ source với PostgreSQL/Redis Compose, tạo `.env.compose` từ `.env.compose.example`, thay các secret mẫu, rồi chạy `docker compose --env-file .env.compose up -d postgres redis`. Redis chỉ mở ở `127.0.0.1:56379` trên máy local. Integration test dùng Redis riêng tại `127.0.0.1:56380` và prefix `marketplace-test`.

`PUBLIC_API_URL` và `NEXT_PUBLIC_API_URL` chỉ chứa URL công khai. Buyer desktop dùng cùng API URL với web. Không đặt JWT, database password, S3 access key hay bootstrap password vào biến có prefix `NEXT_PUBLIC_`.

## Script contract

| Lệnh | Trạng thái |
| --- | --- |
| `pnpm lint` | Đã cấu hình; kiểm tra ESLint ở root |
| `pnpm lint:workspaces` | Đã cấu hình qua Turbo; workspace rỗng sẽ báo skip |
| `pnpm typecheck` | Đã cấu hình qua Turbo; workspace chưa có TypeScript sẽ báo skip |
| `pnpm format` / `pnpm format:check` | Đã cấu hình cho source và workspace config |
| `pnpm --filter @marketplace/api build` / `start` | NestJS bootstrap đã cấu hình; `start` cần build trước |
| `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm clean` | Root orchestration cho workspace |
| `pnpm test:contracts`, `pnpm --filter @marketplace/api test:integration` | Contract và PostgreSQL/Redis integration suites |
| API `prisma:migrate:deploy`, `prisma:seed:demo`, `test:expiry` | Migrations/seeds/API expiry tests; kiểm tra database namespace trước thao tác disposable |
| `@marketplace/desktop`: `desktop:dev`, `desktop:test`, `desktop:build` | Đã có. Test chạy local; release build yêu cầu Windows/macOS native toolchain và `DESKTOP_STOREFRONT_URL` HTTPS. Acceptance matrix còn BLOCKED. |

Cập nhật quickstart cùng task implementation nếu tên script hoặc service đổi. Không báo test pass khi lệnh chưa tồn tại hoặc chưa chạy được.

## Khi nền tảng chạy được

Quickstart: copy `.env.example`, cấu hình database/JWT/Redis secrets, cài frozen lockfile, khởi động PostgreSQL và Redis, deploy migration rồi build/start API và web apps. Docker Compose cung cấp Redis health check; `api` chờ PostgreSQL và Redis khỏe trước khi chạy. Xác nhận database URL và namespace trước khi migrate hoặc seed.

### Bảo vệ dữ liệu

- Không chạy `prisma migrate reset`, `docker compose down -v` hoặc lệnh xóa volume trên database dùng chung/demo.
- Chỉ reset database được xác nhận là disposable test database, với URL/tên database kiểm tra rõ ràng.
- Dùng database/bucket namespace riêng cho test; migration triển khai dùng lệnh deploy, không reset.
- Seed chỉ chạy có chủ đích trên môi trường local disposable; không in password, token hoặc URL có credentials vào log.
- Backup/restore rehearsal phải dùng database cô lập, không restore đè dữ liệu demo.

### Desktop buyer và giới hạn hệ điều hành

- Buyer desktop là Tauri wrapper quanh web storefront, không nhân đôi UI hay design system.
- Tauri desktop cần toolchain native của OS đích. Windows cần MSVC C++ Build Tools/WebView2, Rust stable và cargo; macOS cần Xcode/Rust targets phù hợp.
- Wrapper T140–T143 đã được triển khai và có Windows development/commerce evidence. T144 có Windows x64 MSI build/checksum; install chưa verified do thiếu quyền admin. macOS install/flow và HTTPS acceptance còn thiếu; xem [desktop evidence](../testing/desktop-evidence.md).
- Release build dùng `pnpm --filter @marketplace/desktop desktop:build` sau khi đặt `DESKTOP_STOREFRONT_URL` thành storefront HTTPS có thể truy cập. Build thành công không thay cho kiểm thử flow.
- Không yêu cầu phát hành app lên store trong MVP. Không có app mobile (Android/iOS).

Chi tiết acceptance scenarios và evidence format ở [quickstart](../../specs/001-marketplace-mvp/quickstart.md); baseline toolchain ở [toolchain](toolchain.md).
