# Toolchain và tương thích nền tảng

**Ngày rà soát:** 2026-11-10. Workspace pins được chốt ở T008 sau khi kiểm tra peer dependency và phân giải lockfile. Buyer dùng web và demo desktop Tauri trên Windows; không có app mobile. W008 còn mở cho object storage và các hạng mục môi trường khác ngoài demo desktop.

**Cập nhật desktop 2026-11-10:** T140–T145 và SC-009 đã được nghiệm thu bằng demo Windows 11 x64 với Node `v24.21.0`, pnpm `12.14.0`, Rust/Cargo `1.94.1`, Tauri CLI `2.12.4`, Rust crate `2.12.5` và WebView2 `157.0.4341.42`. Đây là demo dùng storefront/API local; không yêu cầu MSI, public URL hay HTTPS production. Xem [desktop evidence](../testing/desktop-evidence.md).

## Baseline dự kiến

| Thành phần | Baseline | Ghi chú tương thích/gate |
| --- | --- | --- |
| Node.js | 24.18.0 | Pin trong `.nvmrc`; `engines` yêu cầu `>=24.15.0 <25`, phù hợp baseline Nest 12. |
| pnpm | 12.14.0 | Pin trong `packageManager`; CI và local setup dùng phiên bản exact này. |
| Turborepo / TypeScript | 2.11.9 / 6.0.3 | Pin exact ở root manifest và lockfile; TypeScript strict bật trong config chung. |
| Next.js / React | Next 16.4.2 / React + React DOM 19.2.3 | Peer range Next 16 chấp nhận React 19; ba web app dùng cùng React patch. |
| NestJS | Nest 12.2.0 / RxJS 7.8.2 | Core, common và platform-express dùng cùng patch; package ESM. |
| Prisma / PostgreSQL | Prisma 7.10.1 / adapter-pg 7.10.1 / pg 8.23.1 / PostgreSQL 17 | Prisma 7 hỗ trợ Node >=24.0 và TypeScript >=5.4; adapter và client được pin cùng patch. Migration/generate chưa chạy vì T013 chưa triển khai schema. |
| Vite / Tauri | Vite 8.3.4 / Tauri CLI 2.12.4 / Rust crate 2.12.5 / Rust stable | Buyer desktop là Tauri wrapper quanh storefront. Demo local đã được kiểm chứng trên Windows 11 x64; máy cần MSVC C++ Build Tools và WebView2. Chạy `desktop:dev`/`desktop:test`; không có yêu cầu đóng gói installer trong acceptance. |
| Container | Docker Engine + Compose plugin | Compose PostgreSQL/API/web; không dùng volume/database chia sẻ cho test. |

Các major đã thống nhất trong [research](../../specs/001-marketplace-mvp/research.md). Lockfile và peer graph đã được kiểm ở T008; application build smoke vẫn chờ source và được thực hiện theo task nền tảng/T022.

## Snapshot host lịch sử (2026-10-21)

| Hạng mục | Quan sát 2026-10-21 | Kết luận |
| --- | --- | --- |
| OS/architecture | Windows 11 Home, AMD64 | Host dùng khi ghi snapshot; demo Windows mới nhất có evidence riêng bên trên. |
| Node | v24.18.0 | Đạt baseline Node >=24.15. |
| pnpm | Bundled CLI v11.25.0; workspace CLI v12.14.0 | Không đổi bundled CLI toàn máy; dùng `npx pnpm@12.14.0` đúng pin khi chạy trong repo. |
| Docker / Compose | Docker 29.6.1; Compose 5.2.0 | CLI/plugin có mặt; chưa xác nhận daemon/service hoặc chạy container. |
| Git | 2.55.0.windows.2 | CLI có mặt. |
| Rust/Cargo | Không tìm thấy trong PATH tại ngày snapshot | Quan sát lịch sử; không mô tả trạng thái demo hiện tại. |
| MSVC `cl` / Visual Studio installer | Không tìm thấy trong PATH; `vswhere.exe` không có tại vị trí mặc định | Quan sát lịch sử; demo Windows đã có evidence trong [desktop evidence](../testing/desktop-evidence.md). |
| S3 bucket / budget | Không có biến môi trường tên AWS/S3/R2/Cloudflare hoặc endpoint/billing approval trong workspace | Cần owner ghi provider, isolated dev namespace, budget cap/owner, access test và cleanup policy; không ghi secrets vào tài liệu. |

## T008 workspace smoke

- `npx --yes pnpm@12.14.0 install --lockfile-only --ignore-scripts` đã phân giải workspace projects và tạo lockfile.
- `npx --yes pnpm@12.14.0 install --lockfile-only --frozen-lockfile --strict-peer-dependencies --ignore-scripts` hoàn tất; lockfile vượt kiểm tra supply-chain policy, không có lỗi peer.
- Cài riêng dependency root theo frozen lockfile và xác nhận Turbo `2.11.9`, TypeScript `6.0.3`; `turbo ls` nhận các app/package workspaces hiện có.
- Ngày 2026-11-03, app mobile (Expo/React Native) được gỡ khỏi workspace; lockfile không còn dependency Expo/RN, và test api-client chỉ còn ma trận web (cookie/CSRF).
- Smoke này chỉ xác nhận workspace/lockfile và peer resolution. Chưa chạy Prisma generate/migration cho mọi môi trường hoặc nghiệp vụ ngoài phạm vi test đã ghi.

## Remaining platform and implementation gates

1. Đồng bộ Node 24.18.0 và pnpm 12.14.0 trong CI/workstation theo `.nvmrc` và `packageManager`.
2. Với thay đổi workspace tiếp theo, chạy frozen install, Prisma generate/migration, typecheck và build theo CI/workflow tương ứng.
3. Demo buyer desktop Windows đã được triển khai và nghiệm thu trong phạm vi local; kiểm tra lại bằng chứng khi thay đổi Tauri shell, storefront origin hoặc session flow.
4. Ghi người phụ trách, lệnh chạy và evidence cho các thay đổi desktop; không suy rộng demo local thành production deployment hoặc installer support.
5. Cấp S3-compatible dev bucket riêng, quyền tối thiểu, quota/budget cap, namespace và cleanup owner; upload/download/delete thử một asset vô hại sau khi app adapter sẵn sàng.
6. Ghi exact versions, host/OS, command, exit code và blocker vào `docs/development/platform-access.md`. Nếu dependency peer range không tương thích, cập nhật ADR/research/plan trước khi lockfile; không lặng lẽ đổi major.

## Nguồn upstream

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [pnpm 12 installation and Node compatibility](https://pnpm.io/installation)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [NestJS 12 migration and CLI requirements](https://docs.nestjs.com/migration-guide)
- [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)
- [PostgreSQL version support](https://www.postgresql.org/support/versioning/)
