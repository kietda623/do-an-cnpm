# Nền tảng, thiết bị và dịch vụ bên ngoài

**Ngày kiểm tra:** 2026-11-03. Tài liệu ghi nhận quyền/môi trường mà workspace hiện nhìn thấy; không lưu credentials, mã đăng nhập hoặc thông tin thanh toán.

Định hướng nền tảng: **buyer dùng web và desktop (Tauri wrapper của cùng web storefront); seller và admin dùng web. Không có app mobile.** Bảng dưới là snapshot quyền/môi trường ngày 2026-11-03; xem phần cập nhật triển khai desktop bên dưới.

| Mục tiêu nghiệm thu | Điều kiện cần | Bằng chứng hiện có | Trạng thái / việc cần làm |
| --- | --- | --- | --- |
| Buyer web storefront | Trình duyệt hiện đại, HTTPS khi demo; API CORS cho origin của storefront | Ba app Next chạy local; e2e storefront pass trên Chromium | **Đã có.** Giữ Playwright web là bằng chứng chính cho buyer. |
| Buyer desktop (Tauri) | Windows 10/11, Rust stable MSVC, Microsoft C++ Build Tools, WebView2; sau đó build và chạy wrapper trỏ tới storefront URL | Host hiện tại Windows 11 Home AMD64; Rust/Cargo, `cl` không ở PATH; `vswhere.exe` không tại vị trí cài mặc định đã kiểm | **Chưa sẵn sàng — kế hoạch.** Khi triển khai: cài toolchain theo quy trình nhóm, ghi `rustc -V`, VS Build Tools version, WebView2 và launch evidence. Xem [ADR-0004](../adr/0004-buyer-desktop-webview-wrapper.md). |
| Seller/Admin web console | Trình duyệt hiện đại; API CORS theo origin console | Ba app Next chạy local; e2e seller/admin pass | **Đã có.** Không có bản desktop riêng cho seller/admin. |
| S3-compatible storage | Dev bucket riêng, credentials scoped, endpoint/region/namespace, quota/budget cap, cleanup owner | Không thấy endpoint hoặc tên biến môi trường AWS/S3/R2/Cloudflare trong host; chưa có quyền/approval trong project workspace | **Chưa cấp.** Owner W008 ghi provider, người giữ billing/quota, cap theo Sprint, access test và cách revoke/cleanup; secrets chỉ ở secret store/env local. |
| Linux CI/demo | Linux runner/VM, Docker Compose, PostgreSQL 17, HTTPS/reverse proxy, object storage tách biệt | Docker CLI trên host Windows; không chứng minh daemon, Linux runner hay VPS có quyền | **Chưa xác minh.** W008/W063 ghi CI runner và demo host/owner; không coi dự toán 2 vCPU/4GB là được cấp. |

## Evidence record khi có quyền

Ghi một dòng cho mỗi target: ngày giờ Asia/Saigon, owner/operator, provider/host, OS/tool versions, device/model nếu có, app SHA, API environment (không secret), lệnh/flow, exit code, kết quả observed và đường dẫn logs đã redact. Chỉ ghi “pass” cho hành trình chạy thật; compile/build riêng là build evidence.

## Tình trạng desktop cập nhật 2026-11-09

T140–T143 đã triển khai; Windows 11 x64 development/commerce smoke có trong [desktop evidence](../testing/desktop-evidence.md). T144 tạo được MSI Windows x64 và SHA-256, nhưng cài đặt chưa xác minh vì phiên hiện tại không có quyền admin. Chưa có macOS build/install/flow hoặc `DESKTOP_STOREFRONT_URL` production HTTPS. T144/T145 chưa hoàn tất và SC-009 desktop vẫn BLOCKED.

## Resource/budget decision còn mở

Docker CLI 29.6.1/Compose 5.2.0 có mặt; daemon chưa được kiểm tra. Chưa có dữ liệu chi phí hoặc quyền cấp bucket, runner desktop hay demo VM trong workspace. Cần xác nhận budget cap theo Sprint và người phê duyệt tài nguyên trước khi tạo resource có billing. Đây là open gate của W008, không ngăn việc review contract/wireframe/test fixtures. Xem [toolchain matrix](toolchain.md) và [risk/hosting assumptions](../../specs/001-marketplace-mvp/research.md).
