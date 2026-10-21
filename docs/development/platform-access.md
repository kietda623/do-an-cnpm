# Nền tảng, thiết bị và dịch vụ bên ngoài

**Ngày kiểm tra:** 2026-10-21. Tài liệu ghi nhận quyền/môi trường mà workspace hiện nhìn thấy; không lưu credentials, mã đăng nhập hoặc thông tin thanh toán.

| Mục tiêu nghiệm thu | Điều kiện cần | Bằng chứng hiện có | Trạng thái / việc cần làm |
| --- | --- | --- | --- |
| Windows desktop (Tauri) | Windows 10/11, Rust stable MSVC, Microsoft C++ Build Tools, WebView2; sau đó build và chạy app | Host hiện tại Windows 11 Home AMD64; Rust/Cargo, `cl` không ở PATH; `vswhere.exe` không tại vị trí cài mặc định đã kiểm | **Chưa sẵn sàng.** M4 xác định máy/runner, cài qua quy trình nhóm, ghi `rustc -V`, VS Build Tools version, WebView2 và launch evidence. |
| Android Buyer | Android Studio, JDK/JAVA_HOME, Android SDK/NDK, `adb`, emulator hoặc thiết bị; URL API LAN/HTTPS | Không thấy `adb`, `ANDROID_HOME`, `JAVA_HOME`; `%LOCALAPPDATA%\Android\Sdk` không tồn tại; chưa có emulator/device evidence | **Chưa sẵn sàng.** M5 ghi SDK/API level, thiết bị, SecureStore flow và truy cập API. |
| iOS Buyer | macOS, Xcode 26.4+ cho Expo SDK 57, iOS 16.4+ simulator/device, signing phù hợp cho dev build | Host hiện tại là Windows; chưa có thông tin quyền Mac/Xcode của nhóm | **Chưa xác minh.** M5/M4 ghi Mac runner/provider, Xcode version, device/simulator, ai có quyền truy cập và cách lưu evidence. |
| macOS Seller Desktop | macOS + Xcode/toolchain Tauri; Windows/Mac Seller flow cần chạy trên target tương ứng | Chưa thấy quyền Mac/runner hoặc thông tin phiên bản | **Chưa xác minh.** Ghi rõ đường build và chạy signed/unsigned local app theo phạm vi demo. |
| S3-compatible storage | Dev bucket riêng, credentials scoped, endpoint/region/namespace, quota/budget cap, cleanup owner | Không thấy endpoint hoặc tên biến môi trường AWS/S3/R2/Cloudflare trong host; chưa có quyền/approval trong project workspace | **Chưa cấp.** Owner W008 ghi provider, người giữ billing/quota, cap theo Sprint, access test và cách revoke/cleanup; secrets chỉ ở secret store/env local. |
| Linux CI/demo | Linux runner/VM, Docker Compose, PostgreSQL 17, HTTPS/reverse proxy, object storage tách biệt | Docker CLI trên host Windows; không chứng minh daemon, Linux runner hay VPS có quyền | **Chưa xác minh.** W008/W063 ghi CI runner và demo host/owner; không coi dự toán 2 vCPU/4GB là được cấp. |

## Evidence record khi có quyền

Ghi một dòng cho mỗi target: ngày giờ Asia/Saigon, owner/operator, provider/host, OS/tool versions, emulator/device model và OS, app SHA, API environment (không secret), lệnh/flow, exit code, kết quả observed và đường dẫn logs đã redact. Chỉ ghi “pass” cho hành trình chạy thật; compile/build riêng là build evidence.

## Resource/budget decision còn mở

Docker CLI 29.6.1/Compose 5.2.0 có mặt; daemon chưa được kiểm tra. Chưa có dữ liệu chi phí hoặc quyền cấp bucket, Mac runner, thiết bị iOS hay demo VM trong workspace. Cần M5/M4 xác nhận budget cap theo Sprint và người phê duyệt tài nguyên trước khi tạo resource có billing. Đây là open gate của W008, không ngăn việc review contract/wireframe/test fixtures. Xem [toolchain matrix](toolchain.md) và [risk/hosting assumptions](../../specs/001-marketplace-mvp/research.md).
