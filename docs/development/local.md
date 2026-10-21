# Phát triển local

## Trạng thái

Workspace đã có manifests/lockfile, TypeScript config, lint/format và `.env.example`. Source ứng dụng, Docker Compose, migrations và các script test nghiệp vụ chưa có. Vì vậy các hướng dẫn về PostgreSQL, API, web và native bên dưới là contract cho các task tiếp theo, không phải kết quả chạy thử thành công.

## Toolchain cần dùng

| Thành phần | Phiên bản / yêu cầu |
| --- | --- |
| Node.js | 24.18.0 theo `.nvmrc` (`>=24.15.0 <25`) |
| pnpm | 12.14.0 theo `packageManager` |
| Git | Bản hỗ trợ nhánh feature và pull request |
| Docker Engine + Compose plugin | Cần cho PostgreSQL và service containers khi Compose được thêm |
| PostgreSQL | 17 theo plan; dev/test database phải tách biệt |
| S3-compatible storage | Chỉ cần cho upload E2E; bucket và credentials phải scoped, không giả định MinIO |

Kiểm tra phiên bản bằng `node --version` và `pnpm --version`. `pnpm install --frozen-lockfile` chỉ dùng với pnpm 12 và sau khi package build-script policy của workspace được chấp thuận. Không thay đổi package manager toàn máy để chạy repo.

## Ports và URL

| Service | Port | Quy tắc |
| --- | ---: | --- |
| Storefront web | 3000 | Local development |
| Seller Center web | 3001 | Local development |
| Admin panel web | 3002 | Local development |
| API | 4000 | Local development; `/api/v1`, docs dự kiến ở `/api/docs` |
| PostgreSQL | 5432 | Chỉ bind loopback/local trong development; không public ra Internet |
| Expo development server | 8081 | Cho thiết bị/emulator khi chạy mobile |

Không chạy đồng thời hai app trên cùng port. Trình duyệt trên host dùng `localhost`; API container gọi PostgreSQL bằng service name `postgres`. Thiết bị Android/iOS phải dùng địa chỉ LAN có thể truy cập hoặc HTTPS, không dùng `localhost` của máy phát triển.

## Environment

Tạo file local từ mẫu:

```powershell
Copy-Item .env.example .env
```

Điền `DATABASE_URL`, JWT signing secret và các thông tin dịch vụ chỉ trong `.env`. Kết nối từ host dùng hostname `localhost`; API trong Compose dùng hostname `postgres`. Giá trị mẫu trong `.env.example` không phải credentials đã provision. JWT previous secret chỉ dùng verify trong thời gian rotation. Để trống S3/bootstrap admin nếu chưa được cấp quyền và chưa chủ đích cấu hình seed.

`PUBLIC_API_URL`, `NEXT_PUBLIC_API_URL` và `EXPO_PUBLIC_API_URL` chỉ chứa URL công khai. URL cho thiết bị thật cần thay `localhost` bằng IP LAN hoặc HTTPS. Không đặt JWT, database password, S3 access key hay bootstrap password vào biến có prefix `NEXT_PUBLIC_` hoặc `EXPO_PUBLIC_`.

## Script contract

| Lệnh | Trạng thái |
| --- | --- |
| `pnpm lint` | Đã cấu hình; kiểm tra ESLint ở root |
| `pnpm lint:workspaces` | Đã cấu hình qua Turbo; workspace rỗng sẽ báo skip |
| `pnpm typecheck` | Đã cấu hình qua Turbo; workspace chưa có TypeScript sẽ báo skip |
| `pnpm format` / `pnpm format:check` | Đã cấu hình cho source và workspace config |
| `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm clean` | Root orchestration đã có; package tasks tương ứng chưa được triển khai |
| `pnpm test:unit`, `test:integration`, `test:contract`, `test:e2e`, `test:concurrency`, `test:security`, `test:performance` | Contract mục tiêu trong quickstart; chưa có script thực thi |
| API `db:migrate:deploy`, `db:seed:demo`, `test:expiry`; Mobile `start`; Desktop `tauri`, `build:desktop` | Contract mục tiêu; chưa có script/service tương ứng |

Cập nhật quickstart cùng task implementation nếu tên script hoặc service đổi. Không báo test pass khi lệnh chưa tồn tại hoặc chưa chạy được.

## Khi nền tảng chạy được

Quickstart mô tả luồng dự kiến: copy `.env.example`, cài frozen lockfile, khởi động PostgreSQL, migrate/seed qua script API, rồi chạy API và ba web app. Hiện chưa có Compose/migrations nên chưa chạy các lệnh service đó. Khi được triển khai, xác nhận database URL và namespace trước khi migrate hoặc seed.

### Bảo vệ dữ liệu

- Không chạy `prisma migrate reset`, `docker compose down -v` hoặc lệnh xóa volume trên database dùng chung/demo.
- Chỉ reset database được xác nhận là disposable test database, với URL/tên database kiểm tra rõ ràng.
- Dùng database/bucket namespace riêng cho test; migration triển khai dùng lệnh deploy, không reset.
- Seed chỉ chạy có chủ đích trên môi trường local disposable; không in password, token hoặc URL có credentials vào log.
- Backup/restore rehearsal phải dùng database cô lập, không restore đè dữ liệu demo.

### Native và giới hạn hệ điều hành

- Android cần Android SDK/emulator hoặc thiết bị; xác nhận API URL có thể truy cập từ thiết bị.
- iOS build/test cần macOS, Xcode và simulator/device; lệnh chạy trên Windows không chứng minh iOS pass.
- Tauri desktop cần toolchain native của OS đích. Windows cần MSVC C++ Build Tools/WebView2; macOS cần Xcode/Rust targets phù hợp.
- Ghi lại OS, thiết bị, phiên bản toolchain, API endpoint và evidence cho từng native run. Build thành công không thay cho kiểm thử flow trên thiết bị.
- Không yêu cầu phát hành app lên store trong MVP.

Chi tiết acceptance scenarios và evidence format ở [quickstart](../../specs/001-marketplace-mvp/quickstart.md); baseline toolchain ở [toolchain](toolchain.md).
