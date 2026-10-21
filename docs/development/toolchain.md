# Toolchain và tương thích nền tảng

**Ngày rà soát:** 2026-10-21. Đây là baseline thiết kế và quan sát trên desktop Codex hiện tại; chưa cài hoặc nâng cấp package, chưa chạy build ứng dụng. Exact patch package và lockfile sẽ được chốt ở T008 sau compatibility smoke.

## Baseline dự kiến

| Thành phần | Baseline | Ghi chú tương thích/gate |
| --- | --- | --- |
| Node.js | 24 LTS, tối thiểu 24.15 cho Nest CLI | Node 24 LTS là line được chọn; CLI Nest 12 yêu cầu >=24.15. Giữ patch exact trong `.nvmrc`/`engines` và CI. |
| pnpm | 12.x | Không lấy `latest` trong CI; exact patch pin qua `packageManager`. pnpm 12 hỗ trợ Node 24. |
| Turborepo | 2.x | Pin exact khi lập workspace. |
| Next.js / React | Next 16.x, React 19.2.x | Next yêu cầu Node >=20.9; web React patch theo peer range Next và các package UI. |
| NestJS / TypeScript | Nest 12.x / TS 6.x | Nest 12 dùng package ESM; Jest cần Node >=24.9. Với TS, kiểm peer ranges Nest/Prisma trước khi đồng nhất backend. |
| Prisma / PostgreSQL | Prisma 7.x / PostgreSQL 17 | Prisma 7 hỗ trợ Node >=24.0 và TS >=5.4; PostgreSQL 17 được chọn theo baseline dự án. Dùng adapter PostgreSQL tương thích và kiểm fresh/upgrade migration. |
| Expo / React Native | Expo SDK 57 / RN 0.86 / React 19.2.3 | Expo SDK 57 yêu cầu Node >=22.13; Android 7+, compile/target SDK 36; iOS 16.4+ và Xcode 26.4+. Dùng Expo dependency matrix, không nâng RN độc lập. |
| Tauri | Tauri 2.x / Rust stable | Windows cần MSVC C++ Build Tools và WebView2; iOS build yêu cầu macOS/Xcode, Rust targets, CocoaPods. |
| Container | Docker Engine + Compose plugin | Compose PostgreSQL/API/web; không dùng volume/database chia sẻ cho test. |

Các major đã thống nhất trong [research](../../specs/001-marketplace-mvp/research.md). Baseline phiên bản không chứng minh cả monorepo đã build tương thích; gate là workspace smoke ở T008/T022.

## Quan sát trên host hiện tại

| Hạng mục | Quan sát 2026-10-21 | Kết luận |
| --- | --- | --- |
| OS/architecture | Windows 11 Home, AMD64 | Có host Windows để kiểm tra desktop sau khi provision toolchain. |
| Node | v24.18.0 | Đạt baseline Node >=24.15. |
| pnpm | v11.25.0 từ bundled Codex runtime | Chưa đạt baseline pnpm 12; chưa cài/nâng cấp trong task tài liệu. |
| Docker / Compose | Docker 29.6.1; Compose 5.2.0 | CLI/plugin có mặt; chưa xác nhận daemon/service hoặc chạy container. |
| Git | 2.55.0.windows.2 | CLI có mặt. |
| Rust/Cargo | Không tìm thấy trong PATH | Tauri Windows build chưa sẵn sàng trên host này. |
| MSVC `cl` / Visual Studio installer | Không tìm thấy trong PATH; `vswhere.exe` không có tại vị trí mặc định | Cần kiểm Visual Studio Build Tools workload trên máy build được chọn. |
| Android SDK | `adb` không tìm thấy; `ANDROID_HOME` rỗng; `%LOCALAPPDATA%\Android\Sdk` không tồn tại | Android emulator/device path chưa sẵn sàng. Java executable có mặt; `JAVA_HOME` chưa đặt. |
| Xcode/iOS | `xcodebuild` không có trên Windows | Đây không phải bằng chứng máy Mac/runner không tồn tại; quyền truy cập nhóm cần xác minh. |
| iOS/Mac access | Chưa có bằng chứng được cung cấp trong workspace | W008 gate còn mở đến khi M5/M4 ghi được Mac runner, Xcode version, simulator/device hoặc cloud build và bằng chứng chạy app. |
| S3 bucket / budget | Không có biến môi trường tên AWS/S3/R2/Cloudflare hoặc endpoint/billing approval trong workspace | Cần owner ghi provider, isolated dev namespace, budget cap/owner, access test và cleanup policy; không ghi secrets vào tài liệu. |

## Gate trước khi khóa dependency

1. Chọn một Node 24 LTS patch >=24.15 và pnpm 12 patch; khóa trong CI/workspace, thử frozen install.
2. Khóa exact Next/React, Nest/TS, Prisma adapter/client, Expo/RN theo peer matrix; chạy install, generate, typecheck và build thử của từng app/package trước feature implementation.
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
