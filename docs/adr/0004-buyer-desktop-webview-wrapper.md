# ADR-0004: Desktop buyer là Tauri wrapper quanh web storefront

- **Trạng thái:** Accepted — Windows local demo đã triển khai
- **Ngày:** 2026-11-03
- **Ngữ cảnh:** Sản phẩm cần buyer dùng web và app desktop, không dùng app mobile. Repo trước đây có `apps/mobile` (Expo/React Native) và định nghĩa desktop cho seller. Hai hướng đó trái với mục tiêu sản phẩm và nhân đôi chi phí UI/test.

## Quyết định

Buyer dùng **web storefront** làm giao diện gốc. Demo desktop là một **Tauri 2 window** mở storefront local tại `http://localhost:3000` trong WebView2 trên Windows; không có UI, design system hay business logic thứ hai. Seller và Admin tiếp tục chỉ dùng web.

- `apps/mobile` và adapter `ExpoSession` bị gỡ khỏi workspace.
- Desktop chỉ dành cho buyer; không có seller/admin desktop.
- Trạng thái hiện tại: `apps/desktop` có Tauri demo chạy storefront/API local trên Windows; không đóng gói MSI và không phát hành ứng dụng.
- Desktop dùng cùng API base URL và CORS origin local như web; phiên dùng refresh cookie HttpOnly + CSRF của webview, không thêm cơ chế token riêng.
- Workflow Windows riêng chạy Node và Rust checks cho desktop; desktop không được thêm vào baseline root `build`/`test`/`dev`.

## Phương án bị loại

- **React Native/Expo cho buyer:** nhân đôi UI, design tokens và test; không cần cho mục tiêu web + desktop; đã gỡ.
- **Desktop riêng cho seller:** seller/admin là console vận hành trên web; không có nhu cầu sản phẩm đã xác nhận.
- **Viết lại storefront bằng React/Vite cho Tauri:** trái với một design system duy nhất và làm lệch hành vi so với web.
- **Electron:** nặng hơn, không cần Node runtime trong app; Tauri dùng webview hệ điều hành và asset nhỏ hơn.

## Hệ quả

- Một nguồn UI duy nhất: thay đổi storefront tự động có trên desktop; không có test matrix riêng cho từng UI.
- Desktop demo phụ thuộc storefront/API local trên máy Windows; launcher mặc định dùng `http://localhost:3000` và từ chối remote origins.
- Để chạy demo cần Rust stable, MSVC C++ Build Tools và WebView2 trên Windows.
- Không đổi backend, Prisma enum `DESKTOP`/`MOBILE`, OpenAPI hay generated client.

## Bằng chứng cần có trước khi đánh dấu hoàn tất

- `tauri.conf.json` trỏ đúng storefront URL, CSP/allow-list tối thiểu, không mở shell tùy ý.
- Chạy demo trên Windows; ghi OS, WebView2 và toolchain.
- Luồng buyer: đăng nhập → tìm/chi tiết → giỏ → checkout đa shop → đơn/thanh toán mua lại → đánh giá, cùng reload/session restore.
- Xác nhận cookie HttpOnly/CSRF hoạt động trong webview và không có token trong log/local storage.
