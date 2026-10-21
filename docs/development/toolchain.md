# Toolchain và tương thích nền tảng

**Ngày rà soát:** 2026-10-21. Workspace pins được chốt ở T008 sau khi kiểm tra peer dependency và phân giải lockfile. Ứng dụng chưa được build; W008 vẫn mở cho các nền tảng native, Mac/iOS và object storage.

## Baseline dự kiến

| Thành phần | Baseline | Ghi chú tương thích/gate |
| --- | --- | --- |
| Node.js | 24.18.0 | Pin trong `.nvmrc`; `engines` yêu cầu `>=24.15.0 <25`, phù hợp baseline Nest 12. |
| pnpm | 12.14.0 | Pin trong `packageManager`; CI và local setup dùng phiên bản exact này. |
| Turborepo / TypeScript | 2.11.9 / 6.0.3 | Pin exact ở root manifest và lockfile; TypeScript strict bật trong config chung. |
| Next.js / React | Next 16.4.2 / React + React DOM 19.2.3 | Peer range Next 16 chấp nhận React 19; ba web app dùng cùng React patch. |
| NestJS | Nest 12.2.0 / RxJS 7.8.2 | Core, common và platform-express dùng cùng patch; package ESM. |
| Prisma / PostgreSQL | Prisma 7.10.1 / adapter-pg 7.10.1 / pg 8.23.1 / PostgreSQL 17 | Prisma 7 hỗ trợ Node >=24.0 và TypeScript >=5.4; adapter và client được pin cùng patch. Migration/generate chưa chạy vì T013 chưa triển khai schema. |
| Expo / React Native | Expo 57.0.30 / RN 0.86.3 / React 19.2.3 | Theo SDK 57 dependency matrix; Android 7+, compile/target SDK 36; iOS 16.4+ và Xcode 26.4+. |
| Vite / Tauri | Vite 8.3.4 / API 2.12.4 / CLI 2.12.3 / Rust stable | Vite 8 chạy trên Node 24; Windows cần MSVC C++ Build Tools và WebView2; iOS build yêu cầu macOS/Xcode, Rust targets, CocoaPods. |
| Container | Docker Engine + Compose plugin | Compose PostgreSQL/API/web; không dùng volume/database chia sẻ cho test. |

Các major đã thống nhất trong [research](../../specs/001-marketplace-mvp/research.md). Lockfile và peer graph đã được kiểm ở T008; application build smoke vẫn chờ source và được thực hiện theo task nền tảng/T022.

## Quan sát trên host hiện tại

| Hạng mục | Quan sát 2026-10-21 | Kết luận |
| --- | --- | --- |
| OS/architecture | Windows 11 Home, AMD64 | Có host Windows để kiểm tra desktop sau khi provision toolchain. |
| Node | v24.18.0 | Đạt baseline Node >=24.15. |
| pnpm | Bundled CLI v11.25.0; workspace CLI v12.14.0 | Không đổi bundled CLI toàn máy; dùng `npx pnpm@12.14.0` đúng pin khi chạy trong repo. |
| Docker / Compose | Docker 29.6.1; Compose 5.2.0 | CLI/plugin có mặt; chưa xác nhận daemon/service hoặc chạy container. |
| Git | 2.55.0.windows.2 | CLI có mặt. |
| Rust/Cargo | Không tìm thấy trong PATH | Tauri Windows build chưa sẵn sàng trên host này. |
| MSVC `cl` / Visual Studio installer | Không tìm thấy trong PATH; `vswhere.exe` không có tại vị trí mặc định | Cần kiểm Visual Studio Build Tools workload trên máy build được chọn. |
| Android SDK | `adb` không tìm thấy; `ANDROID_HOME` rỗng; `%LOCALAPPDATA%\Android\Sdk` không tồn tại | Android emulator/device path chưa sẵn sàng. Java executable có mặt; `JAVA_HOME` chưa đặt. |
| Xcode/iOS | `xcodebuild` không có trên Windows | Đây không phải bằng chứng máy Mac/runner không tồn tại; quyền truy cập nhóm cần xác minh. |
| iOS/Mac access | Chưa có bằng chứng được cung cấp trong workspace | W008 gate còn mở đến khi M5/M4 ghi được Mac runner, Xcode version, simulator/device hoặc cloud build và bằng chứng chạy app. |
| S3 bucket / budget | Không có biến môi trường tên AWS/S3/R2/Cloudflare hoặc endpoint/billing approval trong workspace | Cần owner ghi provider, isolated dev namespace, budget cap/owner, access test và cleanup policy; không ghi secrets vào tài liệu. |

## T008 workspace smoke

- `npx --yes pnpm@12.14.0 install --lockfile-only --ignore-scripts` đã phân giải 13 workspace projects và tạo lockfile.
- `npx --yes pnpm@12.14.0 install --lockfile-only --frozen-lockfile --strict-peer-dependencies --ignore-scripts` hoàn tất; lockfile vượt kiểm tra supply-chain policy, không có lỗi peer.
- Cài riêng dependency root theo frozen lockfile và xác nhận Turbo `2.11.9`, TypeScript `6.0.3`; `turbo ls` nhận đủ 12 app/package workspaces.
- pnpm báo một deprecated transitive dependency: `@expo/config-plugins@57.0.10` kéo `xcode@3.0.1`, rồi kéo `uuid@7.0.3`. Chưa thay thế dependency bắc cầu; theo dõi cập nhật upstream trước release.
- Smoke này chỉ xác nhận workspace/lockfile và peer resolution. Chưa chạy application build, Prisma generate/migration, lint hay test nghiệp vụ.

## Remaining platform and implementation gates

1. Đồng bộ Node 24.18.0 và pnpm 12.14.0 trong CI/workstation theo `.nvmrc` và `packageManager`.
2. Khi có source theo các task kế tiếp, chạy frozen install đầy đủ, Prisma generate/migration, typecheck và build trên từng target OS trước khi triển khai feature phụ thuộc.
3. Kiểm máy Windows có Rust MSVC, C++ Build Tools, WebView2; kiểm Android Studio/SDK/NDK/JDK và emulator/device.
4. Đăng ký Mac runner có Xcode 26.4+ và iOS 16.4+ simulator/device hoặc đường build được cấp quyền; ghi người phụ trách và cách thu evidence. Cloud compile không thay run-flow evidence.
5. Cấp S3-compatible dev bucket riêng, quyền tối thiểu, quota/budget cap, namespace và cleanup owner; upload/download/delete thử một asset vô hại sau khi app adapter sẵn sàng.
6. Ghi exact versions, host/OS, command, exit code và blocker vào `docs/development/platform-access.md`. Nếu dependency peer range không tương thích, cập nhật ADR/research/plan trước khi lockfile; không lặng lẽ đổi major.

## Nguồn upstream

- [Node.js release schedule](https://nodejs.org/en/about/previous-releases)
- [pnpm 12 installation and Node compatibility](https://pnpm.io/installation)
- [Next.js installation requirements](https://nextjs.org/docs/app/getting-started/installation)
- [NestJS 12 migration and CLI requirements](https://docs.nestjs.com/migration-guide)
- [Prisma 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements)
- [Expo SDK 57 platform and runtime matrix](https://docs.expo.dev/versions/latest/)
- [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)
- [PostgreSQL version support](https://www.postgresql.org/support/versioning/)
