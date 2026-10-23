# Quickstart and Validation Guide — Marketplace MVP

## Trạng thái và mục đích

Đây là run guide và acceptance contract, KHÔNG phải xác nhận toàn repo đã chạy được.
Repo có workspace manifests/lockfile, shared TypeScript config, ba Next.js shell, shared web UI/tokens,
OpenAPI API client, Prisma foundation, disposable PostgreSQL integration harness và Docker Compose local.
Domain features, database demo seed và CI gates vẫn đang được triển khai theo tasks.md.

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

## Scripts và services hiện có

Root đã cấu hình `lint`, `lint:workspaces`, `typecheck`, `format`, `format:check`;
`dev`, `build`, `test`, `clean` chạy qua Turbo; ba web shell có `dev`, `build`, `start`.
API package `@marketplace/api` có `test:unit` và `test:integration` (Jest/Supertest), Prisma schema,
migration và `prisma:migrate:dev|deploy|status`; integration test chỉ nhận `TEST_DATABASE_URL` riêng.
`@marketplace/api-client` có `generate:types` và `test`; `@marketplace/contracts` là workspace package cho OpenAPI/examples.
Database demo seed, contract/E2E/concurrency/security, performance và expiry suites sẽ được bổ sung ở các task tương ứng.
`@marketplace/mobile`: start. `@marketplace/desktop`: tauri, build:desktop.
Compose services: postgres, api, storefront, seller-center, admin-panel; profile `test` có PostgreSQL/API test riêng.
Contract này là công việc W011/015–17/033/040/057.

Ports mục tiêu: storefront3000, seller3001, admin3002, API4000; Compose PostgreSQL development bind
127.0.0.1:55432 và test database riêng bind 127.0.0.1:55433, không dùng database `cnpm`.
Mobile/native PUBLIC_API_URL theo thiết bị;
Web apps dùng cùng scheme/site với API ở demo để cookie SameSite hợp lệ.

## Local setup sau khi foundation/feature code có đủ

Compose và API service đã có; database demo seed vẫn chưa triển khai. Dùng đúng pnpm 12.14.0.
Database Compose development và test có volume/tên riêng, tách khỏi PostgreSQL cài trực tiếp trên máy.

PowerShell từ repository root, không từ folder specs:

```powershell
Copy-Item .env.compose.example .env.compose
# Đổi POSTGRES_PASSWORD và JWT_SIGNING_SECRET; mật khẩu DB phải dùng ký tự URL-safe.
corepack pnpm install --frozen-lockfile
docker compose --env-file .env.compose up -d --build postgres api storefront seller-center admin-panel
docker compose --env-file .env.compose run --rm api pnpm prisma:migrate:deploy
Invoke-RestMethod http://localhost:4000/health/live
Invoke-RestMethod http://localhost:4000/health/ready
```

Expected: migration deploy exit0 và không reset; readiness success sau DB ready;
Web 3000/3001/3002 truy cập được, API docs `/api/docs` có schema v1.
Chưa có lệnh seed demo, nên chưa thể tạo Admin/SellerA/SellerB/Buyer1/Buyer2 fixtures.

Chạy migration integration trên PostgreSQL test riêng của Compose bằng lệnh sau; suite reset toàn bộ
database `marketplace_test` trên volume `marketplace-test-postgres-data`, không đổi URL sang `cnpm`:

```powershell
docker compose --env-file .env.compose --profile test run --rm api-test
```

Có thể chạy `pnpm dev` thay app containers cho hot reload; không chạy hai app cùng port.
Default database env của root host và API container khác host name (`localhost`/`postgres`),
Compose env mapping tách host URL khỏi container hostname. Test database/bucket namespace riêng.

## Foundation quality gates

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm lint:workspaces
corepack pnpm typecheck
corepack pnpm --filter @marketplace/api-client generate:types
git diff --exit-code -- packages/api-client/src/generated/index.ts
corepack pnpm test
corepack pnpm build
corepack pnpm --filter @marketplace/api test:integration
corepack pnpm --filter @marketplace/api prisma:schema:check
```

`pnpm test` chạy unit suites. Pull request chạy cùng các gate trong `.github/workflows/ci.yml` với PostgreSQL
ephemeral. Workflow cấp `contents: read`, không dùng secret hoặc quyền ghi cho mã từ fork.

Trước integration, tạo database riêng có hậu tố `_test` hoặc `_disposable`, copy `.env.test.example` thành `.env.test`,
điền `TEST_DATABASE_URL` và giữ `TEST_DATABASE_NAME_CONFIRMATION` trùng chính xác tên database.
Integration harness reset database đã xác nhận rồi áp migrations; không dùng `DATABASE_URL` làm fallback.

`prisma:schema:check` dùng `.env.test`, yêu cầu hậu tố `_test`/`_disposable` và xác nhận chính xác tên database;
nó so sánh database với schema ở chế độ read-only. OpenAPI type regeneration và git diff phát hiện generated type drift.
E2E Web chưa được triển khai nên chưa thể xác nhận checkout/payment persistence.
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
