# Research — Marketplace MVP

Ngày khảo sát: 2026-10-20. Đây là quyết định thiết kế, chưa cài dependency hoặc chứng minh
build thành công. Nguồn dự án: spec.md và ../../.specify/memory/constitution.md.
Mọi phiên bản patch, package phụ trợ và image digest phải được khóa khi thực hiện foundation,
kiểm tra peer dependencies, advisory và smoke build; không dùng tag latest trong CI/deploy.

## R-01 — Runtime và các baseline tương thích

**Decision:** Node.js 24 LTS, tối thiểu 24.15 để đáp ứng CLI Nest hiện hành; pnpm 12;
Turborepo 2. Next.js 16/React 19.2 cho web; Tauri 2 cho desktop buyer (wrapper quanh storefront,
kế hoạch); NestJS 12 + Prisma 7 + PostgreSQL 17 cho API. Không có client mobile.
Backend TypeScript 6 theo CLI Nest 12; compiler của web/desktop khóa riêng theo peer range
của framework, không ép một phiên bản compiler cho toàn monorepo. Strict mode ở mọi package.
React/React DOM web dùng patch an toàn tương thích Next; desktop dùng đúng patch React của web.

**Rationale:** Các phiên bản major trên có tài liệu stable hiện hành. Node 24 đáp ứng yêu cầu
Prisma 7 (Node 24 hoặc các nhánh khác được hỗ trợ), pnpm installer
(>=22.13), Next (>=20.9) và Nest CLI (Node24 >=24.15). PostgreSQL17 được Prisma7 hỗ trợ
và còn được PostgreSQL hỗ trợ đến 2029-11-08. Chọn database trưởng thành thay vì đổi major
chỉ vì mới hơn. Nest12/Prisma7 dùng ESM cần spike adapter PostgreSQL, generate/build và test
runner trước khi tạo feature; dùng adapter pg của Prisma7, không sao chép setup Prisma6.
Baseline không phải tuyên bố toàn tổ hợp đã được test. Sprint1 quyết định ADR và Sprint2
smoke build là gate trước merge foundation; thay major chỉ sau ghi nhận lý do/review.

**Alternatives considered:** Node22 mới nhất đủ floor nhưng thời gian hỗ trợ ngắn hơn;
Nest11/Prisma6 có nhiều ví dụ cũ nhưng không mặc định là lựa chọn còn được bảo trì tốt nhất;
React Native/Expo đã bị loại cùng app mobile. Không dùng canary hoặc beta.

**Sources:** [Node releases](https://nodejs.org/en/about/previous-releases),
[pnpm installation](https://pnpm.io/installation),
[Next installation](https://nextjs.org/docs/app/getting-started/installation),
[Nest migration/CLI floor](https://docs.nestjs.com/migration-guide),
[Prisma7 requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements),
[Prisma databases](https://www.prisma.io/docs/orm/v7/reference/supported-databases),
[PostgreSQL support](https://www.postgresql.org/support/versioning/).

## R-02 — Modular monolith và sharing

**Decision:** Một Nest process và một PostgreSQL; domain public services rõ ràng;
Order orchestration gọi Inventory/Payment/Shipping qua interface có transaction context.
Share contracts, generated client, validation và design tokens. Web share React components;
desktop buyer dùng lại chính storefront web trong Tauri, không có bộ component thứ hai.
TanStack Query quản lý server state; React state quản lý form/UI, Zustand chỉ khi có nhu cầu thực sự.

**Rationale:** Đủ 5 người/16 tuần, giao dịch nguyên tử dễ chứng minh, tránh phí vận hành hệ phân tán.
**Alternatives considered:** Microservices/Kafka/Kubernetes bị loại theo constitution;
nhân đôi UI sang native/desktop riêng gây chi phí chuyển đổi và hành vi lệch nhau.
**Source:** Hiến chương dự án, spec BR-01–10 và platform coverage.

## R-03 — Desktop buyer là Tauri webview quanh storefront

**Decision:** Buyer desktop dùng Tauri 2 mở chính web storefront URL trong webview hệ điều hành;
không có bundle React riêng, không nhúng Next server, không nhân đôi component.
`build.frontendDist` trỏ storefront URL (hoặc asset tĩnh của storefront nếu chuyển hẳn sang export sau này);
`build.devUrl` trỏ dev server khi phát triển. CSP/allow-list và capability tối thiểu; không shell/filesystem IPC tùy ý.
W008 kiểm toolchain máy build; khi máy có Rust/MSVC/WebView2 mới thêm script build/launch evidence.
Quyết định chi tiết ở [ADR-0004](../../docs/adr/0004-buyer-desktop-webview-wrapper.md).

**Rationale:** Một UI duy nhất giữ hành vi web và desktop đồng nhất, giảm test matrix và tránh
phải duy trì hai bản storefront. Seller/Admin không cần desktop.
**Alternatives considered:** Bundle React/Vite riêng (đã cân nhắc ở bản trước) nhân đôi UI và lệch Next;
Electron nặng hơn và cần Node runtime; React Native/Expo cho buyer đã bị gỡ.
**Source:** [Tauri configuration](https://v2.tauri.app/reference/config/).

## R-04 — Phiên cho Web và Desktop buyer

**Decision:** Access JWT 10 phút, refresh session tối đa 7 ngày, rotate mỗi lần đổi,
chỉ lưu hash refresh phía server, revoke family khi reuse. Đây là giá trị cấu hình ban đầu.
Web dùng access token trong memory, refresh cookie HttpOnly/Secure/SameSite=Lax, cookie
host-only theo API origin; HTTPS, CORS exact allowlist + credentials, CSRF token và kiểm tra
Origin trên thao tác dùng cookie (login/refresh/logout). Không lưu token localStorage.
Local HTTP được ngoại lệ Secure chỉ trong development. Client refresh single-flight,
retry tối đa một lần; không tự retry mutation nếu thiếu idempotency.
Desktop buyer dùng lại webview/cookie của storefront; không có secure store/token store native.
Access token ở memory; refresh chỉ qua auth endpoint, không log token. Logout xóa client secret
và revoke session. Backend kiểm tra user active/session revoked cả khi JWT chưa hết hạn để
khóa tài khoản/đổi mật khẩu có hiệu lực ngay. shop membership kiểm tra tại mọi mutation.

**Rationale:** Cookie giảm khả năng trộm refresh từ JavaScript nhưng cần CSRF; desktop dùng cùng
webview nên thừa hưởng đúng hành vi cookie/CSRF của web thay vì thêm flow thứ hai.
**Alternatives considered:** JWT dài hạn không revoke hoặc localStorage refresh bị loại;
Stronghold/SecureStore chỉ còn ý nghĩa nếu có native client, hiện không có.
**Sources:** [OWASP sessions](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[Tauri WebView](https://v2.tauri.app/reference/webview-versions/).

## R-05 — Checkout đồng thời, idempotency và lịch sử tiền

**Decision:** PostgreSQL transaction ngắn: claim unique (buyerId, idempotencyKey), so khớp
payload hash, khóa variant/inventory theo thứ tự UUID ổn định, kiểm tra lại shop/product/giá,
conditional decrement inventory với quantity >= requested, tạo Order/SellerOrders/items,
xóa đúng số lượng giỏ được checkout rồi commit. Giá và địa chỉ snapshot phía server.
Không có network/storage calls trong transaction. Cùng key khác payload trả 409;
cùng key cùng payload trả cùng Order kể cả sau network timeout. Key đã tạo đơn được giữ
cùng giao dịch, không xóa để một request cũ có thể tạo lại đơn. Lỗi trước commit không tạo đơn.
Unique constraint và bounded retry deadlock/serialization; trả 409 khi hết retry.

Payment/Cancel/Return dùng cùng parent Order lock rồi SellerOrder/inventory locks theo cùng
thứ tự. Ledger inventory có unique (orderItemId, effectType) cho SALE/RESTORE;
Refund unique theo sellerOrderId và cancellation effect. Mock success lock/check deadline,
không overwrite terminal success; failed attempt vẫn cho attempt mới trước hạn.
COD thu theo SellerOrder, unique một collection mỗi phần; tiền NUMERIC, JSON decimal string.
Payment/refund/allocation tách biệt Order status, không xóa lịch sử.

**Rationale:** Điều kiện atomic và transaction chống oversell, uniqueness chống double effects;
đồng bộ lock payment/cancel tránh trả tiền cho phần vừa hủy. BR-04–08 đã quyết định nghiệp vụ.
**Alternatives considered:** Kiểm tra tồn ở frontend hoặc read-then-write ngoài transaction
không an toàn; Redis lock không thay được integrity của PostgreSQL.
**Sources:** [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html),
[Prisma transactions/idempotency](https://www.prisma.io/docs/orm/fundamentals/transactions).

## R-06 — Hết hạn thanh toán bền vững không cần queue

**Decision:** expiresAt = createdAt +15 phút cho Mock; dùng database clock cho mọi kiểm tra.
Một scheduled sweep định kỳ 30 giây trong API, bắt kịp cả record quá hạn sau restart;
khóa Order và hủy các SellerOrder PENDING, restore đúng một lần. Payment/confirm endpoint
chủ động kiểm deadline, vì worker chậm không được kéo dài quyền trả tiền. COD không expire.
Sweep có thể chạy trùng nhưng idempotency vẫn giữ đúng; khi tăng replica dùng advisory lock
hoặc SKIP LOCKED để giảm trùng. Không dựa vào setTimeout giữ trong memory.

**Rationale:** Bảo toàn deadline và recovery không thêm Redis/BullMQ trước khi có nhu cầu.
**Alternatives considered:** BullMQ phù hợp khi cần durable job/rate lớn nhưng dư cho MVP;
chỉ cron không có deadline check ở request có race gây thanh toán muộn.
**Sources:** [Nest scheduling](https://docs.nestjs.com/techniques/task-scheduling),
[PostgreSQL locks](https://www.postgresql.org/docs/current/explicit-locking.html).

## R-07 — Object storage hiện tại

**Decision:** Adapter S3-compatible với Cloudflare R2 hoặc AWS S3 development/demo bucket,
credentials qua secret, namespace riêng môi trường. Local có thể gọi dev bucket; offline test
adapter mock và contract test với bucket thật. Không chọn MinIO community archived làm
production-like mặc định. Nếu yêu cầu local object storage hoàn toàn, spike một giải pháp
còn duy trì và ghi ADR/license trước khi khóa image; không biến việc đó thành dependency cốt lõi.
Upload qua API kiểm quyền shop, JPEG/PNG/WebP signature và decode, tối đa5MB; key ngẫu nhiên,
không nhận arbitrary external URL. Bucket không cho client ghi tùy ý; dùng public read URL
chỉ cho ảnh đã chấp nhận. Dọn orphan bằng tác vụ có kiểm soát, DB không giả vờ atomic với S3.

**Rationale:** MinIO repository chính thức archived/read-only từ 2026-04-25; legacy binary
không còn là giả định bảo trì an toàn. Hiến chương cho phép S3-compatible thay MinIO.
**Alternatives considered:** Local filesystem không là storage demo chính; MinIO legacy chỉ
phù hợp fixture cô lập nếu có đánh giá rõ ràng, không tự phát hành lên mạng.
**Sources:** [MinIO status](https://github.com/minio/minio),
[R2 overview/S3 compatibility](https://developers.cloudflare.com/r2/).

## R-08 — Contract, test, deploy và nền tảng build

**Decision:** OpenAPI contract review trước UI, generated TypeScript client drift check trong CI;
Swagger lấy cùng schema runtime, contract smoke xác nhận responses thực tế. Backend Jest +
Supertest, integration PostgreSQL thật trong Compose/CI; Playwright web, desktop wrapper manual
acceptance khi được triển khai. Concurrency test 20 requests/5 stock cùng barrier;
replay10 lần; fake clock + real DB race payment/expiry. Không mock DB trong bài integrity.

Demo dùng một Linux VPS có Docker Compose + reverse proxy HTTPS + PostgreSQL volume,
Nest API và ba Next apps; storage managed tách biệt. Dự trù 2vCPU/4GB chỉ là giả định đầu
để benchmark, tăng/giảm sau đo; không cam kết giá/free tier. CI lint/typecheck/unit/build,
DB integration và contract; secret không vào PR untrusted. Migration deploy trước app tương
thích schema; backup ngoài VPS, restore drill. Rollback app image cũ với migration additive,
không tự down migration phá dữ liệu. Log structured có requestId, redact tokens/PII.

Windows build cần Rust/MSVC/WebView2; macOS build cần Xcode/Rust targets tương ứng.
Desktop buyer chưa được build nên các tuyên bố desktop phải để ở trạng thái planned/BLOCKED.
Signing/distribution account và budget là điều kiện quản lý phải kiểm khi triển khai;
không coi store publishing là MVP. Windows smoke sớm khi có toolchain; macOS không dồn Sprint8.
pnpm build scripts được allowlist/review, lockfile frozen.

**Rationale:** Phù hợp quy mô sinh viên, vẫn có transaction/security và bằng chứng web thực.
**Alternatives considered:** Serverless nhiều nhà cung cấp/free tiers làm phức tạp cookie,
connection pooling và debug; Kubernetes không cần. Screenshots không chứng minh target-platform acceptance.
**Sources:** [Next deploy](https://nextjs.org/docs/app/getting-started/deploying),
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/),
[GitHub Actions secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

## Research exit gate

Các lựa chọn kỹ thuật đã được chốt ở mức thiết kế, không còn NEEDS CLARIFICATION.
Exact pins, interoperability smoke, ngân sách hosting và quyền truy cập toolchain desktop là đầu ra
verification/gate Sprint1–2; chưa phải kết quả đã thực hiện. Nếu không đạt gate, cập nhật ADR,
effort/risk và kế hoạch trước implementation; không âm thầm bỏ nền tảng hoặc tính năng đã đặc tả.


## Delivery alignment — 2026-11-03

Buyer mobile (Expo) đã bị gỡ khỏi workspace; T130/S4/W032 và SecureStore adapter không còn hiệu lực. Desktop buyer là Tauri wrapper quanh storefront, chưa nằm trong baseline build/CI. Package contract thống nhất packages/contracts, DTO selling và sale_status nội bộ. Không thay các quyết định stack/nghiệp vụ khác của nghiên cứu.
