# T130 — bằng chứng Expo spike

## Phạm vi và môi trường (2026-10-28–29)

Nhánh từ `origin/main` d741f4b. Chỉ login, session native và danh sách sản phẩm; không sửa backend. Hành trình Android emulator với API thật đã pass ngày 2026-10-29. Theo quyết định của người dùng ngày 2026-10-29, tạm hoãn nghiệm thu iOS và ưu tiên Android trong T130; không ghi iOS pass. T130 **giữ mở**, W032 vẫn 2 PD: Android chưa được kiểm chứng HTTPS/native release, không suy rộng kết quả Expo Go sang các mục này.

- Windows 11 (NT 10.0.26200.0), Node 24.21.0, pnpm 12.14.0 qua Corepack, Java 17.0.8.
- Expo 57.0.30, React Native 0.86.3, React 19.2.3.
- SDK tại `C:/Users/letro/AppData/Local/Android/Sdk`, platform/build-tools 36/36.0.0, adb 37.0.1, emulator 37.2.12, system image google_apis x86_64 revision 7. AVD Marketplace_API_36 (profile Pixel 6, ro.product.model sdk_gphone64_x86_64), Android 16/API 36; sys.boot_completed=1. WHPX khả dụng, SwiftShader, 2 CPU/1536 MB RAM, màn hình giảm còn 480×800/density 160 do thiếu RAM. iOS simulator không khả dụng trên Windows.

## Lần chuẩn bị kiểm chứng Android sau khi cài SDK

- Expo Go 57.0.9 (versionCode 444) tải bằng URL chính thức do `npx expo-go url android 57 --json` trả về, `adb install` thành công.
- PostgreSQL 18 tại loopback:55439, database mới `mobile_spike_disposable`; migrate deploy 8 migrations pass; seed identity/shops/catalog pass. Chỉ sửa fixture trong DB disposable để có sản phẩm ACTIVE tên `T130 Android discovery product`, không sửa backend/seed repo.
- API nguyên trạng nhánh T130 chạy cổng 4000; GET /products trả một sản phẩm thật từ DB. API-only native login → refresh rotation → logout 204 pass. Kiểm tra log API không chứa các token thực tế vừa nhận pass (lần đầu lỗi đọc file đang mở, đã chạy lại bằng Get-Content với ErrorActionPreference=Stop).
- Emulator truy cập `http://10.0.2.2:4000/health/live` qua toybox nc: HTTP 200, status ok. Đây là kiểm tra kết nối, không phải UI flow.
- Công cụ ban đầu chặn lệnh Expo (`blocked by policy`); người dùng đã khởi động/restart server thủ công. Manifest lần đầu có apiBaseUrl rỗng; đã tạo `apps/mobile/.env.local` bị Git bỏ qua và xác nhận manifest sau restart có URL đúng. Không commit file local này.
- Expo localhost chỉ bind `::1:8081`, IPv4 localhost từ chối; gây Expo Go `Failed to download remote update`. Cầu TCP ngoài repo chỉ bind `127.0.0.1:8082` → `::1:8081`, kết hợp `adb reverse tcp:8081 tcp:8082`, đã giải quyết kết nối. API app vẫn dùng `10.0.2.2:4000`. Không đổi firewall hoặc publish port ra Internet.
- Emulator ban đầu có System UI ANR; giảm độ phân giải và đóng ứng dụng theo thao tác người dùng. Sau khi công cụ cửa sổ bấm lệch, người dùng chọn rõ ADB/UIAutomator cho hành trình sau đây.

## Hành trình Android thật — 2026-10-29

Các thao tác dưới đây chạy trên Expo Go 57.0.9 và API thật/DB disposable nêu trên, không mock HTTP. `uiautomator dump` xác nhận text/bounds; `screencap` lưu ảnh trong `assets/t130/`. Account thử nghiệm `t130-buyer@example.test`, password sinh ngẫu nhiên giữ ngoài repo, không ghi vào bằng chứng.

| Bước                | Thao tác / kết quả thật                                                                                                                                                                                                                                                                                                            | Ảnh                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Discovery           | `adb shell am start -W -a android.intent.action.VIEW -d exp://127.0.0.1:8081 -p host.exp.exponent`; UI hiển thị `T130 Android discovery product`; API GET /products 200, các lần sau 304 qua cache HTTP.                                                                                                                           | [Danh sách](assets/t130/android-products.png)                 |
| Login               | Nhập tài khoản bằng ADB từ biến local, không in password. POST /auth/login 200; UI đổi thành ĐĂNG XUẤT, có sản phẩm.                                                                                                                                                                                                               | [Đăng nhập thành công](assets/t130/android-login-success.png) |
| SecureStore         | Expo Go không debuggable nên run-as bị từ chối; chỉ trên emulator disposable, `adb root` cho phép đọc preferences scoped của project. Có đúng một entry `key_v1-marketplace.refresh.v1`, payload mã hóa gồm ct/iv/tlen/scheme/keystoreAlias; không có entry access token. Không ghi ciphertext/token vào repo/log.                 | Kiểm tra cấu trúc và số lượng, không chụp giá trị             |
| Force-stop / reopen | `am force-stop host.exp.exponent` xác nhận tiến trình dừng; mở project lại. Trong Expo Go cần gửi deep link lần thứ hai sau cold LauncherActivity để tới ExperienceActivity. POST /auth/refresh 200; không nhập lại password; UI ĐĂNG XUẤT và sản phẩm. Fingerprint ciphertext refresh thay đổi, chứng minh ghi rotation.          | [Khôi phục phiên](assets/t130/android-restored-session.png)   |
| Logout              | Bấm ĐĂNG XUẤT: API 204, về form login trống, refresh entry=0, active test sessions=0. Force-stop/reopen tiếp theo chỉ có ĐĂNG NHẬP, không phát sinh refresh request. Không có cache persistent của spike; danh sách cũ unmount khi chuyển login.                                                                                   | [Logout](assets/t130/android-logout.png)                      |
| Refresh 401         | Login mới; thu hồi session của đúng account trong DB disposable; force-stop/reopen. API refresh 401 với mã REFRESH_REUSE của backend gốc; UI về login, refresh entry=0. Logger chỉ hiện mã lỗi đã làm sạch.                                                                                                                        | [401](assets/t130/android-refresh-401.png)                    |
| Lỗi mạng + retry    | Login mới; dừng đúng API process disposable; force-stop/reopen. UI báo không khôi phục được; ciphertext refresh giữ nguyên. Sau sửa safe area bên dưới, chạy lại: khởi động API, bấm THỬ LẠI tại bounds `[28,175][452,194]` → refresh 200, UI đăng nhập + sản phẩm. Kết thúc bằng logout; refresh entry=0, active test sessions=0. | [Retry đã sửa](assets/t130/android-network-retry-fixed.png)   |
| Log                 | Quét ReactNativeJS và cả ba log API của lần chạy: 0 JWT-pattern, 0 trường accessToken/refreshToken có giá trị, không có password thử nghiệm. Trước đó API-only test cũng so sánh trực tiếp các token nhận được với log và không thấy. Đây không phải chứng minh bao quát mọi log của mọi hệ thống.                                 | Không lưu log thô hoặc token vào Git                          |

## Lỗi UI tìm thấy trên emulator và red/green

Màn loading/retry nằm ngoài Stack và chưa áp dụng safe area. Lúc API đã chạy lại, nút retry vẫn ở `[8,27][472,46]` trong vùng system bar; bấm không tạo request. [Ảnh trước sửa](assets/t130/android-network-retry.png). Test mới `test/session-provider.smoke.spec.tsx` chạy đỏ: Expected top padding >=96, received 0. Sau đó thêm SafeAreaProvider tại root và insets +20 cho loading/retry; 4/4 smoke pass. Chạy lại lỗi mạng thật sau sửa: nút ở y175–194, bấm tạo refresh 200 và về màn authenticated. Rà soát độc lập không có finding quan trọng còn lại. Không sửa backend.

## Red / green thực tế

Test được viết trước implementation. Native session ban đầu đỏ vì refresh 401 vẫn giữ `refresh-secret` thay vì xóa; smoke đỏ vì chưa tìm thấy trường Email và danh sách sản phẩm trong màn hình stub. Sau implementation:

| Lệnh                                                                                   | Kết quả quan sát                                                                                                      |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm install --frozen-lockfile`                                              | Pass khi thiết lập worktree.                                                                                          |
| `corepack pnpm lint:workspaces`                                                        | Pass, 11 workspace tasks.                                                                                             |
| `corepack pnpm typecheck`                                                              | Pass, 11 workspace tasks.                                                                                             |
| `corepack pnpm format:check`                                                           | Fail: 93 file có sẵn ngoài phần mobile/session mới; không format hàng loạt.                                           |
| `corepack pnpm test`                                                                   | Lần cuối 2026-10-29 pass: API 59 test (Turbo cache), api-client 17 và mobile 4 chạy mới; 3 tasks thành công.          |
| `corepack pnpm build`                                                                  | Pass cả 4 target API/Web; đây không phải Android native build.                                                        |
| `corepack pnpm --filter @marketplace/api-client test`                                  | Rerun cuối: 17/17 pass (thêm test logger, logout đua refresh và lỗi xóa SecureStore).                                 |
| `corepack pnpm --filter @marketplace/mobile test`                                      | Rerun cuối sau sửa safe area: 4/4 pass, 2 suites. Đây là component test; device journey là bảng riêng phía trên.      |
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

Mọi refresh 401 xóa token local và báo provider xóa user, điều hướng login; không rẽ nhánh theo error code. Test riêng chứng minh network/timeout/429/5xx giữ refresh để thử lại, gồm automatic refresh. Logger chỉ nhận mã lỗi thuộc allowlist, không truyền message/body/token. Logout chỉ clear sau khi API xác nhận thành công; lỗi tạm thời giữ phiên và UI báo lỗi/cho thử lại. Nếu refresh trong luồng logout trả 401, phiên đã bị invalidation và không retry logout hoặc clear lần hai. Không thêm cache persistent; state danh sách được bỏ khi màn hình unmount.

## Chốt review logout — 2026-10-29

Đối chiếu FR-03 và contracts/api.md Identity: logout thành công phải vô hiệu phiên server (204). Vì vậy chấp nhận finding [CodeRabbit](https://github.com/kietda623/do-an-cnpm/pull/24#discussion_r4404239585): không biến network/timeout/429/5xx thành logout local thành công trong khi session server có thể còn hoạt động. Đây là làm rõ điều kiện thành công của logout, không thay đổi yêu cầu mọi refresh401 phải clear local.

CodeRabbit đã sửa service trong commit `48cc2a2`: clear sau remote success, giữ credentials khi lỗi tạm thời. Kiểm tra vẫn thấy Home gọi `void logout()` không catch; người dùng không được báo lỗi/thử lại và có unhandled rejection. Test component được viết/chạy trước sửa: đỏ với `TypeError: network unavailable` và không tìm được thông báo lỗi. Sau đó Home bắt lỗi, giữ UI signed-in, hiện thông báo chung và nút retry; test chứng minh gọi lại logout, xóa thông báo khi thành công.

Kiểm tra cuối cho quyết định này: api-client 24/24, mobile 5/5 (2 suites), mobile lint/typecheck và Prettier các file thay đổi pass. Có test logout network/timeout/429/500 giữ refresh/callback không invalidation; logout thành công clear; refresh401 không retry/clear lặp; refresh thành công dùng credentials đã rotation. Hành vi logout failure mới có unit/component evidence, chưa chạy lại riêng failure journey trên emulator sau commit này; bảng device phía trên là lần chạy trước đó.

## Điểm lệch phát hiện

### Ghi SecureStore thất bại sau rotation — quyết định 2026-10-29

Đã đối chiếu finding ngoài diff của CodeRabbit và tái hiện: server trả refresh mới, `setItemAsync` lỗi, lần restore kế tiếp gửi lại refresh cũ rồi nhận 401. Người dùng chọn **xóa phiên local, yêu cầu đăng nhập lại**, không dùng đề xuất giữ `retainedTokens` dự phòng trong memory; vẫn giữ quy tắc refresh chỉ persist trong SecureStore.

Sửa tại TokenStore.write dùng chung cho login, restore và automatic refresh: khi ghi lỗi, chạy cleanup ngoài storage queue để tránh tự deadlock, xóa access trong memory, invalidation callback, thử xóa refresh trong SecureStore và ném `SessionStorageError` với thông báo sạch. Đây là lỗi client storage, không giả thành HTTP401. Provider nhận lỗi này thì mount navigator và điều hướng login; không mắc ở màn network retry. Generation guard tránh cleanup nhầm phiên đã thay đổi; read bỏ qua credentials đã invalidation cả trước/sau đọc bất đồng bộ.

Red evidence trước sửa: cả 6 ca login/restore/automatic refresh × deletion success/failure đều nhận callback count0 thay vì1; component không gọi router.replace('/login'). Green sau sửa: api-client **30/30**, mobile **6/6**, lint/typecheck của cả hai package pass, Prettier file thay đổi và git diff --check pass. Test còn chứng minh không gọi refresh cũ lần hai trong tiến trình, không gửi bearer cũ, và đăng nhập mới phục hồi bình thường. Các test network/timeout/429/5xx giữ token và mọi refresh401 clear vẫn xanh. Reviewer độc lập không có finding quan trọng.

Android Metro/Hermes export sau sửa pass (2.7 MB). Lần đầu thiếu EXPO_PUBLIC_API_URL bị config từ chối; chạy lại với `EXPO_PUBLIC_API_URL=https://example.test/api/v1` qua process env thành công. URL này chỉ dùng kiểm tra bundle, không gọi API và không chứng minh HTTPS journey. Root test pass: API59 qua Turbo cache, api-client30 và mobile6 chạy mới.

Giới hạn: các lỗi IO mới được fault-inject trong unit/component, chưa tái hiện lỗi phần cứng trên emulator. Nếu hệ điều hành từ chối cả thao tác xóa, ciphertext cũ có thể vẫn còn trên đĩa; không tuyên bố đã xóa vật lý thành công. Tiến trình hiện tại không dùng lại nó; sau restart vẫn phụ thuộc SecureStore và kiểm tra 401 của server. Cleanup local không được báo là đã thu hồi session server thành công.

### Mã lỗi refresh backend

Main tại thời điểm tạo nhánh trả REFRESH_REUSE khi dùng lại refresh trong khi contract yêu cầu SESSION_REVOKED; INVALID_REFRESH cần được mô tả rõ cho token sai/hết hạn. Sửa riêng ở [PR #23](https://github.com/kietda623/do-an-cnpm/pull/23), không thay backend/contract trong PR T130. Native xử lý theo status 401 nên độc lập việc merge PR đó.

## Giới hạn và việc chưa kiểm chứng

- iOS tạm hoãn theo quyết định người dùng ngày 2026-10-29; chưa chạy và không ghi pass. Phần này không chặn nghiệm thu Android của T130, sẽ được xem xét khi tiếp tục phạm vi iOS.
- Chưa build/chạy APK dev/release riêng. Expo Go không chứng minh manifest release thực chặn HTTP hoặc cấu hình backup của app riêng; mới kiểm tra config và hành trình HTTP dev trên emulator.
- HTTPS và IP LAN trên thiết bị thật chưa chạy. Không suy rộng `10.0.2.2` emulator thành LAN pass.
- Discovery empty/error/retry có component test; chưa thao tác riêng mọi trạng thái discovery trên emulator. Refresh timeout/429/5xx có unit test, lỗi mạng và 401 có thêm device evidence.
- Access chỉ memory được đối chiếu mã, cấu trúc SecureStore và việc force-stop phải refresh; không có heap dump để chứng minh tuyệt đối toàn bộ bộ nhớ/storage. Không yêu cầu hoặc ghi token vào heap/log phục vụ bằng chứng.

Không đánh dấu các mục này pass bằng unit test hoặc Metro export. Reviewer đề xuất: M3 theo T130.

Rà soát độc lập phát hiện thêm hai lỗi trong spike, đều tái hiện đỏ trước khi sửa: callback invalidation bằng 0 khi SecureStore.delete lỗi (expected 1), và refresh hoàn tất sau logout ghi lại r1 (expected null). Đã thêm generation guard và tuần tự hóa thao tác storage; callback UI chạy trong finally. Hai regression test xanh. Nếu hệ điều hành từ chối xóa SecureStore thì không thể chứng minh token đã xóa; UI vẫn về login, cần kiểm tra lại trên thiết bị.
