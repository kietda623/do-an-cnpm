# Quickstart and Validation Guide — Marketplace MVP

## Trạng thái và mục đích

Đây là run guide và acceptance contract, KHÔNG phải xác nhận repo hiện chạy được.
Repo đã có workspace manifests/lockfile, shared TypeScript config, lint/format và `.env.example`;
source nghiệp vụ, Docker Compose, migrations và test scripts ứng dụng vẫn chưa được triển khai.
Các lệnh service bên dưới chỉ chạy sau khi các task nền tảng/API cung cấp chúng. W017/016 và các owner feature
phải cập nhật guide cùng implementation nếu đổi tên script/service.

Nguồn: [spec](spec.md), [plan](plan.md), [data model](data-model.md), [API](contracts/api.md).
DoD chỉ đạt khi command/evidence thật được ghi lại; không dùng guide như kết quả test đã pass.

## Prerequisites

- Node24 LTS>=24.15, pnpm12, Git và Docker Compose plugin theo pins của workspace;
  exact patch/version metadata trong lockfile/runtime matrix W008/W017.
- S3-compatible dev/demo bucket với credentials scoped, endpoints/region/namespace cấu hình riêng.
  Unit tests có adapter mock, upload E2E phải có bucket thật; không tự mặc định MinIO legacy.
- Windows Desktop: Rust/MSVC/WebView2 theo Tauri prerequisites; macOS: Rust/Xcode runner.
- Android emulator/device; iOS simulator/device và macOS/Xcode access. Build iOS từ cloud
  không thay bằng chứng chạy iOS. Không yêu cầu đưa app lên store trong MVP.
- CPU/RAM/disk đủ chạy containers; môi trường không trùng tên/database production.
  Thiết bị native phải truy cập được API: URL LAN/HTTPS hợp lệ, không dùng localhost của máy khác.

## Script/service contract cần được implementation cung cấp

Root đã cấu hình `lint`, `lint:workspaces`, `typecheck`, `format`, `format:check`;
`dev`, `build`, `test`, `clean` có lệnh Turbo nhưng package tasks/source tương ứng chưa sẵn sàng.
Các script test:unit, test:integration, test:contract, test:e2e, test:concurrency,
test:security và test:performance là contract cần implementation cung cấp.
API package `@marketplace/api` dự kiến có db:migrate:deploy, db:seed:demo, test:expiry.
`@marketplace/mobile`: start. `@marketplace/desktop`: tauri, build:desktop.
Compose services: postgres, api, storefront, seller-center, admin-panel;
packages expose scripts consistent với Turbo graph. Contract này là công việc W011/015–17/033/040/057.

Ports mục tiêu: storefront3000, seller3001, admin3002, API4000; PostgreSQL5432 chỉ bind local
trong development, không public demo. Mobile/native PUBLIC_API_URL theo thiết bị;
Web apps dùng cùng scheme/site với API ở demo để cookie SameSite hợp lệ.

## Local setup sau khi foundation/feature code có đủ

Compose, migration, seed và API service hiện chưa được triển khai; chưa chạy các lệnh service dưới đây.
Trước khi cài dependencies, dùng đúng pnpm 12.14.0 và chấp thuận build-script policy của workspace.

PowerShell từ repository root, không từ folder specs:

```powershell
Copy-Item .env.example .env
# Điền .env theo plan mục11, không commit secrets.
pnpm install --frozen-lockfile
docker compose up -d postgres
pnpm --filter @marketplace/api db:migrate:deploy
pnpm --filter @marketplace/api db:seed:demo
docker compose up -d --build api storefront seller-center admin-panel
Invoke-RestMethod http://localhost:4000/health/live
Invoke-RestMethod http://localhost:4000/health/ready
```

Expected: migration exit0 không reset; repeat seed không nhân đôi; readiness success sau DB ready;
Web 3000/3001/3002 truy cập được, API docs `/api/docs` có schema v1.
Seed demo cần có Admin/SellerA/SellerB/Buyer1/Buyer2 credentials cấu hình local an toàn,
2 shop active cùng sản phẩm biến thể, và negative fixtures pending/suspended/hidden.
Không in mật khẩu thật/token vào terminal logs hoặc đưa chúng vào báo cáo.

Có thể chạy `pnpm dev` thay app containers cho hot reload; không chạy hai app cùng port.
Default database env của root host và API container khác host name (`localhost`/`postgres`),
W016 phải cung cấp env mapping rõ. Test database/bucket namespace riêng.

## Checks từng lớp

```powershell
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm test:integration
pnpm test:contract
pnpm test:e2e
pnpm test:concurrency
pnpm test:security
pnpm test:performance
pnpm --filter @marketplace/api test:expiry
```

Expected: exit0 cho từng command có test thật. Integration dùng PostgreSQL thật,
contract gate validate OpenAPI/runtime/examples, E2E Web không mock checkout/payment persistence.
Performance test ghi host/network/fixture cùng100 observations, không chỉ số trung bình.
Không bỏ failing test hoặc thay DB mock để báo pass. Chỉ chạy test reset trên disposable test DB
được kiểm tra tên/URL; không áp dụng `migrate reset`/`docker compose down -v` lên dữ liệu demo dùng chung.

## Validation scenarios và expected outcomes

| ID / mốc | Lệnh hoặc thao tác | Dữ liệu / expected outcome |
| --- | --- | --- |
| V01 S2 | Web register/login/profile/address/password/logout, test:e2e identity | Email duplicate reject, one default address, revoked session không dùng tiếp; US1 |
| V02 S3 | User gửi shop, Admin approve/reject/suspend; Seller publish2variants | PENDING không public, ACTIVE public, suspended không mua mới; SellerB không sửa shopA |
| V03 S4 | Search/filter/sort/cart chọn subset | Min active price, stable pagination, group shop, quantity integer, selected lines đúng |
| V04 S5 | Buyer checkout5lines/2shops bằng quote5min | Một Order/2SellerOrders; NUMERIC totals exact; stock/order/cart cùng commit; price changed reconfirm |
| V05 S5 | `pnpm test:concurrency` với barrier20requests/stock5 | Exactly5 success,15 out-of-stock,stock0; không có partial order; SC003 |
| V06 S5 | Replay checkout/payment/cancel10 cùng key và cùng payload | Same Order/result, one effect; khác payload409; totals/stock khớp xử lý1lần; SC004 |
| V07 S5 | Mock success/fail/cancel/retry/expiry + test:expiry | Retry cùng Order trước15min, một normal success; expiry restore once; late success compensation/refund không fulfill |
| V08 S5 | Hủy một SellerOrder PENDING; hủy tổng khi có CONFIRMED | Part cancel chỉ phần đó; hủy tổng409/no partial changes; snapshot/price/address lịch sử nguyên |
| V09 S5 | Seller confirm→pack→pickup→transit→delivered; COD collect; Buyer receive | Đúng transitions, Buyer only receive, payment/order independent; Seller khác không đọc |
| V10 S5 | FAILED→retry hoặc Admin confirm-return | Retry không trừ tồn; chưa return không restore; return confirmed cancel/restore/refund once |
| V11 S6 | Buyer review completed item rồi gửi lại | Rating1–5,one review/item,wrong buyer/unfinished reject; Seller view-only |
| V12 S6–7 | Dashboard known totals/day/month Asia/Saigon | Revenue chỉ COMPLETED, no parent+part double count; captured/refund/outstanding riêng; SC008 |
| V13 S7 | Direct unauthorized ID/role requests, bad upload, CSRF/reuse tests | Không đổi/lộ tài nguyên, file signature/size check, credential/log redaction; SC007 |
| V14 S7 | 5người,giỏ5dòng/2shop,address sẵn | >=4/5 checkout<=3phút, record thời gian và blockers; SC005 |
| V15 S7 | Performance fixture1000products/10shops/20users/100observations | >=95/100 thấy search/list<=2s, ghi môi trường; SC006 |
| V16 S7 | Cross-device persisted flows, restart server during expiry | Dữ liệu consistent sau reload, deadline job bắt kịp restart; SC009/NFR03 |
| V17 S8 | Fresh-member setup từ clean clone, prerequisites sẵn | <=30phút đến demo, không undocumented step; SC010 |

V07 dùng test clock chỉ trong test process và fixture disposable, không endpoint tùy ý sửa giờ server.
Expiry kiểm tại request và sweep30s; worker trễ không cho payment sau deadline.
Báo cáo tách target expected với observed results, không tick acceptance khi chưa có evidence.

## Native validation

```powershell
pnpm --filter @marketplace/mobile start
pnpm --filter @marketplace/desktop tauri dev
pnpm --filter @marketplace/desktop build:desktop
```

Mobile start mở dev server và chọn Android/iOS trên môi trường tương ứng; production-like acceptance
cần release/dev build phù hợp và API HTTPS/LAN được cấu hình, không giả định localhost.
Win/Mac build chạy trên runner OS đích; Mac/iOS commands thực hiện ở Mac/Xcode, không tuyên bố
build/test iOS đã chạy từ PowerShell Windows hiện tại.

- Android/iOS: US1,4–8 bao gồm addresses/profile/review, search→cart→checkout→tracking;
  refresh SecureStore, logout revoke, app resume refetch, không token plaintext.
- Windows/macOS: US2,3,7,8 toàn Seller screens; Stronghold unlock password không hardcode,
  create/edit/stock/fulfill/revenue/review, wrong shop access denied.
- Trên mỗi target ghi OS/device/tool versions, API release, start/end timestamp, thao tác và response
  redacted, screenshots/video khi phù hợp, record/totals evidence từ server. Build pass không là flow pass.

## Demo release và recovery rehearsal

Chỉ sau khi release được ủy quyền: runbook W063 phải có backup→reviewed migrate deploy→image rollout
→live/ready→smoke→promote. Không có lệnh deploy tự chạy trong guide này.
Backup/restore test dùng database cô lập rồi kiểm counts/FK/snapshots/stock/money;
không restore đè demo dùng chung khi chưa có quyết định dữ liệu.
App rollback về image trước phải qua schema compatibility check; không down migration phá dữ liệu.

Expected RPO24h/RTO2h là target demo để đo, không chứng nhận đã đạt.
W057/W063 lưu ngày backup/checksum, restore duration, expected/actual business totals,
image digests và smoke results. Kiểm tra object assets đọc lại sau restore, không chỉ DB rows.

## Evidence handover template

Mỗi test/run: ticket/FR/SC, release SHA, environment+OS+dataset, exact command,
exit code hoặc thao tác, expected/observed, link sanitized logs/screenshots,
remaining defects và reviewer. Kết luận PASS chỉ từ bằng chứng thực tế.
Nếu không có Mac/device/bucket hoặc command chưa được cung cấp, ghi BLOCKED và owner/date xử lý;
không đánh dấu yêu cầu hoàn tất bằng giả định.
