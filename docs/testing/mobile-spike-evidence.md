# T130 — bằng chứng Expo spike

## Phạm vi và môi trường (2026-10-28)

Nhánh từ `origin/main` d741f4b. Chỉ login, session native và danh sách sản phẩm; không sửa backend. T130 **giữ mở**, W032 vẫn 2 PD: chưa chạy hành trình với API thật trên emulator/thiết bị.

- Windows 11 (NT 10.0.26200.0), Node 24.21.0, pnpm 12.14.0 qua Corepack, Java 17.0.8.
- Expo 57.0.30, React Native 0.86.3, React 19.2.3.
- ANDROID_HOME/ANDROID_SDK_ROOT trỏ tới `C:/Users/letro/AppData/Local/Android/Sdk` nhưng thư mục không tồn tại; không có adb/emulator. Model/API level: chưa có. iOS simulator không khả dụng trên Windows.

## Red / green thực tế

Test được viết trước implementation. Native session ban đầu đỏ vì refresh 401 vẫn giữ `refresh-secret` thay vì xóa; smoke đỏ vì chưa tìm thấy trường Email và danh sách sản phẩm trong màn hình stub. Sau implementation:

| Lệnh                                                                                   | Kết quả quan sát                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                              | Pass khi thiết lập worktree.                                                                                          |
| `corepack pnpm lint:workspaces`                                                        | Pass, 11 workspace tasks.                                                                                             |
| `corepack pnpm typecheck`                                                              | Pass, 11 workspace tasks.                                                                                             |
| `corepack pnpm format:check`                                                           | Fail: 93 file có sẵn ngoài phần mobile/session mới; không format hàng loạt.                                           |
| `corepack pnpm test`                                                                   | Pass: API 59 test; api-client 14 test ở lần chạy toàn bộ; mobile 3 test.                                              |
| `corepack pnpm build`                                                                  | Pass cả 4 target API/Web; đây không phải Android native build.                                                        |
| `corepack pnpm --filter @marketplace/api-client test`                                  | Rerun cuối: 17/17 pass (thêm test logger, logout đua refresh và lỗi xóa SecureStore).                                 |
| `corepack pnpm --filter @marketplace/mobile test`                                      | Rerun cuối: 3/3 pass; component smoke mock transport/provider, không phải device E2E.                                 |
| `corepack pnpm --filter @marketplace/mobile typecheck` và `lint`                       | Rerun cuối pass.                                                                                                      |
| `expo export --platform android` qua `corepack pnpm --filter @marketplace/mobile exec` | Metro/Hermes Android export pass. Không phải APK hoặc hành trình native. Output ngoài repo.                           |
| `expo config --type public`                                                            | Dev HTTP được cấu hình và origin được chuẩn hóa thêm `/api/v1`; HTTP khi không bật dev bị từ chối.                    |
| `npx expo install --check`                                                             | Cảnh báo Expo 57.0.30 đang pin sẵn, khuyến nghị ~57.0.31; không tự nâng SDK trong spike.                              |
| `corepack pnpm peers check`                                                            | Còn peer có sẵn: openapi-typescript yêu cầu TypeScript ^5, repo pin TypeScript 6. Không còn cảnh báo peer native mới. |

## Dependencies và Metro

Dùng `npx expo install` để chọn các phiên bản SDK 57: router 57.0.29, secure-store 57.0.4, constants 57.0.22, linking 57.0.13, build-properties 57.0.22, screens 4.26.2, safe-area-context 5.7.0, reanimated 4.5.1, worklets 0.10.1, metro-config 0.86.3; exact pin trong package mobile và lockfile, dùng catalog hiện có cho React/TypeScript/ESLint. Test: jest 29.7.0, jest-expo 57.0.6, testing-library/react-native 13.3.3, react-test-renderer 19.2.3 (khớp React).

pnpm launcher toàn cục trên máy lỗi; khi Expo cần gọi pnpm đã dùng wrapper ngoài repo gọi `corepack pnpm`, không sửa cấu hình toàn cục. Metro mặc định của Expo resolve được workspace api-client qua pnpm symlink; không cần sửa node-linker/watchFolders hoặc thêm metro.config. Root Turbo tự chạy script test mobile; không đổi CI workflow.

## Cách chạy và bảo mật

`app.config.ts` đọc `EXPO_PUBLIC_API_URL` vào `extra.apiBaseUrl`. Đây là địa chỉ công khai, không chứa secret. Production dùng HTTPS, ví dụ `https://api.example.test/api/v1`. Cấu hình từ chối URL có credentials/query/fragment hoặc đường dẫn API khác.

Android emulator dev: đặt `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1`, `APP_VARIANT=development`, `EXPO_ALLOW_HTTP=1`, rồi `corepack pnpm --filter @marketplace/mobile exec expo start`. Thiết bị thật thay host bằng IP LAN của máy API; cần cùng mạng và API bind interface phù hợp. HTTP chỉ được bật tường minh ở cấu hình dev; release không đặt các cờ này, Android usesCleartextTraffic=false. HTTPS vẫn là cấu hình ưu tiên. Sau thay đổi native plugin cần tạo lại dev build.

ExpoSession dùng ApiTransport hiện có và kiểu sinh từ OpenAPI. Native gửi clientPlatform ANDROID/IOS và refresh trong body, credentials omit, không cookie/CSRF. Access chỉ nằm trong bộ nhớ; refresh chỉ persist qua SecureStore, không AsyncStorage/plaintext. TTL 10 phút/7 ngày do API quản lý. Refresh rotation ghi token mới; restore được gộp cho các lần mount đồng thời.

Mọi refresh 401 xóa token local và báo provider xóa user, điều hướng login; không rẽ nhánh theo error code. Test riêng chứng minh network/timeout/429/5xx giữ refresh để thử lại, gồm automatic refresh. Logger chỉ nhận mã lỗi thuộc allowlist, không truyền message/body/token. Logout gọi API rồi clear trong finally. Không thêm cache persistent; state danh sách được bỏ khi màn hình unmount.

## Điểm lệch phát hiện

Main trả REFRESH_REUSE khi dùng lại refresh trong khi contract yêu cầu SESSION_REVOKED; INVALID_REFRESH cần được mô tả rõ cho token sai/hết hạn. Sửa riêng ở [PR #23](https://github.com/kietda623/do-an-cnpm/pull/23), không thay backend/contract trong PR T130. Native xử lý theo status 401 nên độc lập việc merge PR đó.

## Chưa kiểm chứng trên thiết bị

- Login và GET /products với API thật; trạng thái loading/empty/error/retry mới có component evidence.
- Quan sát log runtime không có token; kiểm tra SecureStore thực chứa refresh và không chứa access.
- Logout thực xóa SecureStore, bộ nhớ và state; tắt/mở app thực khôi phục qua refresh rotation.
- Android model/API level, iOS, native APK/dev build và hành vi mạng LAN/HTTPS.

Không đánh dấu các mục này pass bằng unit test hoặc Metro export. Reviewer đề xuất: M3 theo T130.

Rà soát độc lập phát hiện thêm hai lỗi trong spike, đều tái hiện đỏ trước khi sửa: callback invalidation bằng 0 khi SecureStore.delete lỗi (expected 1), và refresh hoàn tất sau logout ghi lại r1 (expected null). Đã thêm generation guard và tuần tự hóa thao tác storage; callback UI chạy trong finally. Hai regression test xanh. Nếu hệ điều hành từ chối xóa SecureStore thì không thể chứng minh token đã xóa; UI vẫn về login, cần kiểm tra lại trên thiết bị.
