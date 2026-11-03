# ADR-0004: Desktop buyer là Tauri wrapper quanh web storefront

- **Trạng thái:** Accepted — implementation planned, chưa triển khai
- **Ngày:** 2026-11-03
- **Ngữ cảnh:** Sản phẩm cần buyer dùng web và app desktop, không dùng app mobile. Repo trước đây có `apps/mobile` (Expo/React Native) và định nghĩa desktop cho seller. Hai hướng đó trái với mục tiêu sản phẩm và nhân đôi chi phí UI/test.

## Quyết định

Buyer dùng **web storefront** làm giao diện gốc. App desktop là một **Tauri 2 window** mở chính storefront URL trong webview hệ điều hành; không có UI, design system hay business logic thứ hai. Seller và Admin tiếp tục chỉ dùng web.

- `apps/mobile` và adapter `ExpoSession` bị gỡ khỏi workspace.
- Desktop chỉ dành cho buyer; không có seller/admin desktop.
- Trạng thái hiện tại: `apps/desktop` chỉ còn scaffold manifest/tsconfig, **chưa có** `tauri.conf.json`, Rust crate hay script build. Không có bằng chứng build/chạy desktop.
- Khi triển khai, desktop dùng cùng API base URL và CORS origin như web; phiên dùng refresh cookie HttpOnly + CSRF của webview, không thêm cơ chế token riêng.
- CI hiện tại không yêu cầu Rust/MSVC vì desktop chưa nằm trong `build`/`test`/`dev`.

## Phương án bị loại

- **React Native/Expo cho buyer:** nhân đôi UI, design tokens và test; không cần cho mục tiêu web + desktop; đã gỡ.
- **Desktop riêng cho seller:** seller/admin là console vận hành trên web; không có nhu cầu sản phẩm đã xác nhận.
- **Viết lại storefront bằng React/Vite cho Tauri:** trái với một design system duy nhất và làm lệch hành vi so với web.
- **Electron:** nặng hơn, không cần Node runtime trong app; Tauri dùng webview hệ điều hành và asset nhỏ hơn.

## Hệ quả

- Một nguồn UI duy nhất: thay đổi storefront tự động có trên desktop; không có test matrix riêng cho từng UI.
- Desktop phụ thuộc URL/API reachable từ máy người dùng; cần cấu hình môi trường rõ ràng khi đóng gói và kiểm tra CORS/cookie trên webview.
- Để build desktop cần Rust stable, MSVC C++ Build Tools và WebView2 trên Windows (hoặc Xcode/Rust targets trên macOS). Máy hiện tại chưa có Rust/MSVC, nên mọi tuyên bố "desktop supported" phải để ở trạng thái planned.
- Không đổi backend, Prisma enum `DESKTOP`/`MOBILE`, OpenAPI hay generated client.

## Bằng chứng cần có trước khi đánh dấu hoàn tất

- `tauri.conf.json` trỏ đúng storefront URL, CSP/allow-list tối thiểu, không mở shell tùy ý.
- Build và chạy trên OS mục tiêu; ghi OS, toolchain, app/API SHA.
- Luồng buyer: đăng nhập → tìm/chi tiết → giỏ → checkout đa shop → đơn/thanh toán mua lại → đánh giá, cùng reload/session restore.
- Xác nhận cookie HttpOnly/CSRF hoạt động trong webview và không có token trong log/local storage.
