# Marketplace MVP

Nền tảng thương mại điện tử đa người bán cho thị trường Việt Nam. Người mua tìm kiếm sản phẩm từ nhiều cửa hàng, đặt một đơn gồm nhiều shop, thanh toán COD hoặc MOCK, theo dõi và xác nhận nhận hàng; người bán quản lý cửa hàng, catalog, tồn kho và xử lý đơn; quản trị viên duyệt cửa hàng/sản phẩm, khóa tài khoản, xử lý hoàn trả và tra cứu audit log.

Giao diện tiếng Việt, tiền tệ VND, múi giờ Asia/Saigon.

Giao diện Buyer, Seller và Admin dùng chung hệ thiết kế sáng trung tính + cyan, hỗ trợ theme tối/sáng. Quy tắc màu, font, layout và chuyển động nằm trong [DESIGN.md](DESIGN.md); token dùng chung nằm tại `packages/design-tokens/src/styles.css`. Dữ liệu rỗng được hiển thị đúng trạng thái, không tự tạo sản phẩm hoặc số liệu mẫu.

## Phạm vi chức năng

- **Buyer (storefront):** discovery theo danh mục và từ khóa, chi tiết sản phẩm, giỏ hàng, checkout một đơn nhiều shop, theo dõi đơn, xác nhận đã nhận hàng và gửi đánh giá.
- **Seller (seller-center):** onboarding và cập nhật cửa hàng, quản lý catalog gồm biến thể và ảnh, điều chỉnh tồn kho, xử lý đơn, xem doanh thu, đọc đánh giá và cấu hình cửa hàng. Danh sách sản phẩm hỗ trợ tìm kiếm theo tên, lọc theo trạng thái bán và trạng thái bị quản trị ẩn, phân trang dựa trên `meta.total` trả về từ server.
- **Admin (admin-panel):** duyệt/từ chối/tạm ngưng cửa hàng, duyệt hoặc ẩn sản phẩm, quản lý danh mục, khóa/mở khóa tài khoản kèm lý do, theo dõi đơn và vận chuyển, xử lý yêu cầu hoàn trả tại `/orders/returns`, tra cứu audit log.

### Giới hạn đã biết

- Thanh toán chỉ có `COD` và `MOCK`; giao dịch MOCK được đánh dấu `simulated: true` và không gọi cổng thanh toán thật.
- Chưa có voucher/promotion engine, báo cáo GMV theo tháng hay phân bố điểm đánh giá.
- Không có app mobile; buyer desktop mới ở mức kế hoạch ([ADR-0004](docs/adr/0004-buyer-desktop-webview-wrapper.md)).

## Nền tảng

| Đối tượng | Bề mặt | Trạng thái |
| --- | --- | --- |
| Buyer | Web storefront — `apps/storefront` | Có |
| Seller | Web console — `apps/seller-center` | Có |
| Admin | Web console — `apps/admin-panel` | Có |
| Buyer desktop | Tauri wrapper quanh storefront | Kế hoạch, chưa có mã ([ADR-0004](docs/adr/0004-buyer-desktop-webview-wrapper.md)) |

Không có app mobile (Android/iOS); `apps/mobile` đã được gỡ khỏi workspace.

## Kiến trúc và công nghệ

- **Monorepo:** pnpm workspace + Turborepo, Node.js 24.18.0, pnpm 12.14.0.
- **API:** NestJS 12 modular monolith, Prisma 7 + PostgreSQL 17, migrations trong `apps/api/prisma/migrations`.
- **Web:** Next.js 16 App Router, React 19, Tailwind CSS 4; ba app dùng chung `@marketplace/ui-web` và `@marketplace/design-tokens`.
- **Hợp đồng API:** OpenAPI 3.0.3 tại `packages/contracts/openapi.yaml`; type client được sinh tự động, không chỉnh tay.
- **Phiên đăng nhập:** JWT access token ngắn hạn + refresh session; web gửi `X-CSRF-Token` cho request ghi.
- **Tiền tệ và thời gian:** VND, thời gian nghiệp vụ theo Asia/Saigon; thanh toán chỉ có `COD` và `MOCK` (số liệu MOCK được đánh dấu `simulated`).

## Cấu trúc repository

| Đường dẫn | Nội dung |
| --- | --- |
| `apps/api` | API NestJS (admin, cart, catalog, identity, inventory, order, payment, review, shipping, shop), Prisma schema/migrations/seed |
| `apps/storefront` | Web cho buyer: discovery, giỏ hàng, checkout, đơn hàng, đánh giá |
| `apps/seller-center` | Web cho seller: onboarding shop, catalog, tồn kho, đơn, doanh thu |
| `apps/admin-panel` | Web cho admin: duyệt shop/sản phẩm, người dùng, danh mục, đơn, hoàn trả, audit |
| `packages/api-client` | Transport gọi API, quản lý token/session, type sinh từ OpenAPI |
| `packages/contracts` | `openapi.yaml` và ví dụ request/response |
| `packages/ui-web` | Component dùng chung cho ba web app |
| `packages/design-tokens` | Token màu, typography, spacing |
| `packages/validation` | Khung package dùng chung (chưa có mã) |
| `packages/config` | ESLint/TypeScript/typecheck dùng chung |
| `tests/e2e` | Playwright cho storefront, seller và admin |
| `specs/001-marketplace-mvp` | Spec, plan, task list, quickstart |
| `docs` | Kiến trúc, database, thiết kế, kiểm thử, ADR |

## Yêu cầu môi trường

| Thành phần | Phiên bản |
| --- | --- |
| Node.js | 24.18.0 (`.nvmrc`; engine `>=24.15.0 <25`) |
| pnpm | 12.14.0 (pin trong `packageManager`; bật bằng `corepack enable`) |
| Docker + Compose plugin | Cho PostgreSQL và stack đầy đủ |
| PostgreSQL | 17 (Compose dùng `postgres:17.11-bookworm`) |

## Chạy nhanh bằng Docker Compose

```bash
cp .env.compose.example .env.compose
# Sửa POSTGRES_PASSWORD và JWT_SIGNING_SECRET trước khi chạy
corepack pnpm install --frozen-lockfile
docker compose --env-file .env.compose up -d --build postgres api storefront seller-center admin-panel
docker compose --env-file .env.compose run --rm api pnpm prisma:migrate:deploy
```

| Dịch vụ | URL |
| --- | --- |
| Storefront | http://localhost:3000 |
| Seller Center | http://localhost:3001 |
| Admin Panel | http://localhost:3002 |
| API | http://localhost:4000/api/v1 |
| Swagger | http://localhost:4000/api/docs |
| Liveness / Readiness | `/health/live`, `/health/ready` |

PostgreSQL development của Compose bind `127.0.0.1:55432`; test database bind `127.0.0.1:55433` và chỉ chạy với profile `test`.

## Chạy từ source (không Docker)

Cần một PostgreSQL 17 đang chạy. Nếu dùng PostgreSQL của Compose, kết nối từ host qua port `55432`.

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env
# Điền DATABASE_URL và JWT_SIGNING_SECRET trong .env
```

Chạy API (package API không có script `dev`; build rồi start):

```bash
corepack pnpm --filter @marketplace/api prisma:migrate:deploy
corepack pnpm --filter @marketplace/api build
corepack pnpm --filter @marketplace/api start
```

Mở ba terminal riêng, đặt `NEXT_PUBLIC_API_URL` trong mỗi terminal rồi chạy một web app với port cố định để khớp `CORS_ORIGINS` mặc định (`3000,3001,3002`):

```bash
export NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
corepack pnpm --filter @marketplace/storefront exec next dev --hostname 0.0.0.0 --port 3000
corepack pnpm --filter @marketplace/seller-center exec next dev --hostname 0.0.0.0 --port 3001
corepack pnpm --filter @marketplace/admin-panel exec next dev --hostname 0.0.0.0 --port 3002
```

Trên PowerShell, thay dòng `export` bằng `$env:NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"`. Có thể mở cả ba app bằng `localhost` hoặc `127.0.0.1` trên các cổng này. API client tự khớp hostname local và thêm `/api/v1` nếu URL API chỉ có host và cổng. Khi sửa biến môi trường, khởi động lại tiến trình tương ứng. Root có script `pnpm dev` chạy song song ba app, nhưng nên dùng lệnh riêng ở trên khi cần port ổn định.

| App | Địa chỉ local |
| --- | --- |
| Buyer | [localhost:3000](http://localhost:3000) |
| Seller Center | [localhost:3001](http://localhost:3001) |
| Admin | [localhost:3002](http://localhost:3002) |

Theme được đổi bằng nút trên header. Chuyển động tôn trọng thiết lập giảm chuyển động của hệ điều hành. Khi kiểm tra giao diện với dữ liệu hiện tại, không cần chạy seed hoặc reset database. Kết quả kiểm chứng bản redesign nằm trong [cyan-redesign-verification.md](docs/testing/cyan-redesign-verification.md).

Khi cả ba web app đang chạy ở các cổng trên, chạy bộ hồi quy giao diện gồm 57 ca có sẵn bằng `pnpm exec playwright test --config=playwright.presentation.config.ts`. Bộ này dùng API giả lập trong test, không tạo đơn hay duyệt hồ sơ trên database hiện tại. Kiểm tra giao diện với API thật và dữ liệu hiện có dùng `node scripts/capture-cyan-real.mjs buyer` (hoặc `seller`, `admin`); script đọc tài khoản local từ `.env` và lưu ảnh trong `%TEMP%/cnpm-cyan-after`.

## Database và dữ liệu mẫu

- Migration local: `pnpm --filter @marketplace/api prisma:migrate:dev`.
- Migration môi trường đã triển khai: `prisma:migrate:deploy` (không dùng reset).
- Kiểm tra schema: `pnpm --filter @marketplace/api prisma:migrate:status`.

Seed có trong `apps/api/prisma/seed`:

```bash
corepack pnpm --filter @marketplace/api seed:identity
corepack pnpm --filter @marketplace/api seed:shops
corepack pnpm --filter @marketplace/api seed:catalog
corepack pnpm --filter @marketplace/api seed:payments
corepack pnpm --filter @marketplace/api seed:reviews-statistics
```

Chỉ chạy seed trên database local disposable. Các seed fixture kiểm tra `TEST_DATABASE_URL` có hậu tố `_test`/`_disposable` và yêu cầu `TEST_DATABASE_NAME_CONFIRMATION` trùng chính xác tên database; xem [fixture design](docs/testing/fixture-design.md).

`seed:demo` chạy độc lập, không cần gọi `seed:identity`; lệnh chỉ đọc `TEST_DATABASE_URL`, yêu cầu PostgreSQL và tên database kết thúc bằng `_test` hoặc `_disposable`, xác nhận chính xác qua `TEST_DATABASE_NAME_CONFIRMATION`, và không fallback sang `DATABASE_URL`, reset, migrate hay xóa dữ liệu. Database phải được migrate riêng trước khi chạy; wrapper `prisma:migrate:deploy` đọc `DATABASE_URL`, nên khi chuẩn bị DB mới hãy bảo đảm biến đó trỏ đúng cùng database disposable.

Thêm các giá trị dưới đây vào `.env.test` đã bị Git bỏ qua (không commit mật khẩu), rồi chạy lệnh riêng. Ba mật khẩu phải dài 12–128 ký tự:

```bash
TEST_DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/marketplace_demo_disposable
TEST_DATABASE_NAME_CONFIRMATION=marketplace_demo_disposable
DEMO_SELLER_PASSWORD=<mật-khẩu-demo-người-bán>
DEMO_BUYER_PASSWORD=<mật-khẩu-demo-người-mua>
DEMO_LOCKED_BUYER_PASSWORD=<mật-khẩu-demo-tài-khoản-bị-khóa>

corepack pnpm --filter @marketplace/api seed:demo
```

Seed demo tạo 10 shop, 1.000 sản phẩm và bốn order/payment/shipment fixture theo stable IDs; ảnh chỉ là metadata placeholder, không có file ảnh thật. Xem [demo seed evidence](docs/testing/demo-seed-evidence.md).

## Kiểm thử

```bash
# Unit + contract
corepack pnpm test
corepack pnpm test:contracts

# PostgreSQL integration (đọc .env.test, reset database đã xác nhận)
corepack pnpm --filter @marketplace/api test:integration
corepack pnpm test:concurrency
corepack pnpm test:expiry

# E2E (Playwright tự khởi động Next ở port 3100/3101/3102)
corepack pnpm test:e2e
corepack pnpm test:e2e:discovery
corepack pnpm test:e2e:checkout
corepack pnpm test:e2e:seller
corepack pnpm test:e2e:catalog
corepack pnpm test:e2e:admin
corepack pnpm test:e2e:fulfillment
corepack pnpm test:e2e:us8
corepack pnpm test:e2e:us8-live
```

Integration test và `prisma:schema:check` chỉ chấp nhận database disposable: copy `.env.test.example` thành `.env.test`, điền `TEST_DATABASE_URL` và đặt `TEST_DATABASE_NAME_CONFIRMATION` đúng bằng tên database. Không trỏ vào database demo hoặc database dùng chung.

Không bao giờ chạy `prisma migrate reset`, `docker compose down -v` hay xóa volume trên database không phải disposable.

CI tại `.github/workflows/ci.yml` chạy trên PostgreSQL 17 tạm với các bước: lint toàn workspace, typecheck, sinh lại type OpenAPI rồi kiểm tra `git diff --exit-code`, unit, contract, build, integration, concurrency, checkout E2E, fulfillment E2E, và đối chiếu migration/schema lần cuối. Artifact Playwright được upload khi thất bại.

## Quy ước phát triển

- **Hợp đồng trước:** sửa `packages/contracts/openapi.yaml`, sau đó chạy `pnpm --filter @marketplace/api-client generate:types`. Không sửa tay `packages/api-client/src/generated/index.ts`.
- **Envelope API:** response có dạng `{ data, meta? }`. Dùng `request()` khi chỉ cần `data`; dùng `requestEnvelope()` khi cần `meta` (ví dụ phân trang).
- **Danh sách có phân trang:** tham số query chuẩn là `page`, `pageSize` (tối đa 100) và trả `meta { page, pageSize, total }`. Bộ lọc riêng đặt theo tên miền, ví dụ `GET /shops/{shopId}/management/products?q=&selling=&adminHidden=` dùng chung envelope này.
- **Ghi dữ liệu:** dùng `Idempotency-Key` và `expectedVersion`; nhận `409` thì tải lại trước khi thử tiếp.
- **Bí mật:** chỉ đặt trong `.env`/secret store. Không đặt token, mật khẩu database hay access key vào biến `NEXT_PUBLIC_*`.
- **UI:** giữ copy tiếng Việt thống nhất với các Playwright spec (spec chọn theo accessible name).

## Tài liệu

- [Spec](specs/001-marketplace-mvp/spec.md) · [Plan](specs/001-marketplace-mvp/plan.md) · [Tasks](specs/001-marketplace-mvp/tasks.md) · [Quickstart](specs/001-marketplace-mvp/quickstart.md)
- [Kiến trúc: BFD, DFD, use case, ERD, sequence](docs/architecture/README.md)
- [Thiết kế dữ liệu](docs/database/data-design.md) · [Kế hoạch kiểm thử](docs/testing/test-plan.md)
- [Phát triển local](docs/development/local.md) · [Toolchain](docs/development/toolchain.md)
- [ADR-0001 modular monolith](docs/adr/0001-modular-monolith.md) · [ADR-0002 contract naming](docs/adr/0002-contract-naming.md) · [ADR-0003 data integrity](docs/adr/0003-data-integrity.md) · [ADR-0004 desktop wrapper](docs/adr/0004-buyer-desktop-webview-wrapper.md)
- [Product brief](PRODUCT.md) · [Design system](DESIGN.md)
