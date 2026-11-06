# Phát triển local

## Trạng thái

Workspace đã có manifests/lockfile, TypeScript config, lint/format, `.env.example` và API bootstrap NestJS. Health liveness và Swagger đã được smoke test; readiness chỉ trả sẵn sàng khi cấu hình thiết yếu và PostgreSQL reachable. Source nghiệp vụ, Docker Compose, migrations và các script test nghiệp vụ chưa có, nên các hướng dẫn về service bên dưới vẫn là contract cho các task tiếp theo.

## Toolchain cần dùng

| Thành phần | Phiên bản / yêu cầu |
| --- | --- |
| Node.js | 24.18.0 theo `.nvmrc` (`>=24.15.0 <25`) |
| pnpm | 12.14.0 theo `packageManager` |
| Git | Bản hỗ trợ nhánh feature và pull request |
| Docker Engine + Compose plugin | Cần cho PostgreSQL và service containers khi Compose được thêm |
| PostgreSQL | 17 theo plan; dev/test database phải tách biệt |
| S3-compatible storage | Chỉ cần cho upload E2E khi có bucket; để trống S3 thì dev ghi file vào `ASSET_LOCAL_DIR` (mặc định `apps/api/uploads/`) và phục vụ qua `PUBLIC_API_URL/api/v1/assets`, production vẫn bắt buộc S3 |

Kiểm tra phiên bản bằng `node --version` và `pnpm --version`. `pnpm install --frozen-lockfile` chỉ dùng với pnpm 12 và sau khi package build-script policy của workspace được chấp thuận. Không thay đổi package manager toàn máy để chạy repo.

## Ports và URL

| Service | Port | Quy tắc |
| --- | ---: | --- |
| Storefront web | 3000 | Local development |
| Seller Center web | 3001 | Local development |
| Admin panel web | 3002 | Local development |
| API | 4000 | Local development; prefix `/api/v1`, Swagger `/api/docs`, liveness `/health/live`, readiness `/health/ready` |
| PostgreSQL | 5432 | Chỉ bind loopback/local trong development; không public ra Internet |

Không chạy đồng thời hai app trên cùng port. Trình duyệt trên host dùng `localhost`; API container gọi PostgreSQL bằng service name `postgres`. Buyer desktop (khi được triển khai) mở storefront URL này trong webview Tauri.

## Environment

Tạo file local từ mẫu:

```powershell
Copy-Item .env.example .env
```

Điền `DATABASE_URL`, JWT signing secret và các thông tin dịch vụ chỉ trong `.env`. Kết nối từ host dùng hostname `localhost`; API trong Compose dùng hostname `postgres`. Giá trị mẫu trong `.env.example` không phải credentials đã provision. JWT previous secret chỉ dùng verify trong thời gian rotation. Để trống S3/bootstrap admin nếu chưa được cấp quyền và chưa chủ đích cấu hình seed.

`PUBLIC_API_URL` và `NEXT_PUBLIC_API_URL` chỉ chứa URL công khai. Buyer desktop dùng cùng API URL với web. Không đặt JWT, database password, S3 access key hay bootstrap password vào biến có prefix `NEXT_PUBLIC_`.

## Script contract

| Lệnh | Trạng thái |
| --- | --- |
| `pnpm lint` | Đã cấu hình; kiểm tra ESLint ở root |
| `pnpm lint:workspaces` | Đã cấu hình qua Turbo; workspace rỗng sẽ báo skip |
| `pnpm typecheck` | Đã cấu hình qua Turbo; workspace chưa có TypeScript sẽ báo skip |
| `pnpm format` / `pnpm format:check` | Đã cấu hình cho source và workspace config |
| `pnpm --filter @marketplace/api build` / `start` | NestJS bootstrap đã cấu hình; `start` cần build trước |
| `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm clean` | Root orchestration đã có; package tasks tương ứng chưa được triển khai |
| `pnpm test:unit`, `test:integration`, `test:contract`, `test:e2e`, `test:concurrency`, `test:security`, `test:performance` | Contract mục tiêu trong quickstart; chưa có script thực thi |
| API `db:migrate:deploy`, `db:seed:demo`, `test:expiry`; Desktop `tauri`, `build:desktop` | Contract mục tiêu; desktop buyer chưa có workspace và chưa triển khai, các lệnh còn lại chưa có script/service tương ứng |

Cập nhật quickstart cùng task implementation nếu tên script hoặc service đổi. Không báo test pass khi lệnh chưa tồn tại hoặc chưa chạy được.

## Khi nền tảng chạy được

Quickstart mô tả luồng dự kiến: copy `.env.example`, cài frozen lockfile, khởi động PostgreSQL, migrate/seed qua script API, rồi chạy API và ba web app. API bootstrap có thể build/start riêng; hiện chưa có Compose/migrations nên các lệnh database và web container chưa chạy được. Khi được triển khai, xác nhận database URL và namespace trước khi migrate hoặc seed.

### Bảo vệ dữ liệu

- Không chạy `prisma migrate reset`, `docker compose down -v` hoặc lệnh xóa volume trên database dùng chung/demo.
- Chỉ reset database được xác nhận là disposable test database, với URL/tên database kiểm tra rõ ràng.
- Dùng database/bucket namespace riêng cho test; migration triển khai dùng lệnh deploy, không reset.
- Seed chỉ chạy có chủ đích trên môi trường local disposable; không in password, token hoặc URL có credentials vào log.
- Backup/restore rehearsal phải dùng database cô lập, không restore đè dữ liệu demo.

### Desktop (kế hoạch) và giới hạn hệ điều hành

- Buyer desktop là Tauri wrapper quanh web storefront, không nhân đôi UI hay design system.
- Tauri desktop cần toolchain native của OS đích. Windows cần MSVC C++ Build Tools/WebView2, Rust stable và cargo; macOS cần Xcode/Rust targets phù hợp.
- Desktop buyer **chưa được triển khai**: không có script build trong CI và không cần Rust/MSVC để chạy repo hiện tại.
- Ghi lại OS, phiên bản toolchain, storefront/API endpoint và evidence cho từng desktop run. Build thành công không thay cho kiểm thử flow.
- Không yêu cầu phát hành app lên store trong MVP. Không có app mobile (Android/iOS).

Chi tiết acceptance scenarios và evidence format ở [quickstart](../../specs/001-marketplace-mvp/quickstart.md); baseline toolchain ở [toolchain](toolchain.md).
