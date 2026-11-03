# Bằng chứng US6: thanh toán và hủy đơn

## Môi trường

- Windows, Node.js 24.21.0, pnpm 12.14.0 qua Corepack; nhánh từ `origin/main` commit `5d76a4b`.
- PostgreSQL 18 cluster riêng `127.0.0.1:55439`, database `us6_acceptance_disposable`; test nhận `TEST_DATABASE_URL` và `TEST_DATABASE_NAME_CONFIRMATION` đúng tên. Test reset chỉ database disposable này. CI PostgreSQL 17 cần xác minh riêng.

## Kết quả thực tế

| Lệnh | Kết quả |
| --- | --- |
| `corepack pnpm lint:workspaces` | Baseline đạt, 11 tác vụ, có cache. |
| `corepack pnpm typecheck` | Đạt; lần cuối chạy không dùng cache, 11 tác vụ. |
| `corepack pnpm test` | Đạt không cache: 59 unit API và 5 test client. |
| `corepack pnpm --filter @marketplace/api test:contracts` | Đạt 9 suite / 221 test; có kiểm tra settlementKind và originalAttemptId trong OpenAPI. |
| `corepack pnpm --filter @marketplace/api test:integration` | Đạt 12 suite / 59 test trên database disposable. Lần baseline ban đầu bị dừng trước khi hoàn tất để xử lý mâu thuẫn contract; đây là kết quả sau thay đổi. |
| `corepack pnpm --filter @marketplace/api prisma:schema:check` | Đạt: No difference detected, trên database disposable. |
| `corepack pnpm build` | Đạt không cache: 4 tác vụ. |
| `corepack pnpm test:expiry` | Đạt 1 test, 1 test khác skipped theo bộ lọc. Fixture được backdate, worker mới chạy scan khởi động dùng DB clock; chưa chứng minh restart toàn bộ process/server. |
| `corepack pnpm --filter @marketplace/api test:integration --testPathPatterns=payment-cancellation.spec.ts` | Đạt 2 test PostgreSQL: 10 request đồng thời cùng key cho tạo attempt, kết quả và hủy; khác payload 409; payment/cancel race có đúng một thành công, tồn không hoàn hai lần. |
| `corepack pnpm exec eslint` trên test concurrency, contract, seeds và kiểm tra snapshot | Đạt sau khi sửa lỗi lint của test mới. |

## Red/green và lỗi được phát hiện

1. Kết quả muộn: test PostgreSQL trước sửa kỳ vọng `LATE_COMPENSATION/SUCCEEDED` với `originalAttemptId` nhưng nhận `NORMAL/CANCELLED` từ attempt gốc. Sau sửa, test xác nhận DTO bù trừ, cùng event ID hoặc cùng key trả cùng body/id, history có cả hai, event giữ attempt nguồn, allocation/refund một lần. Commit `5449855`.
2. Kết quả mâu thuẫn: test trước sửa nhận 200 khi replay cùng key sau lần đầu 409. Sau sửa, lần đầu, replay cùng key và cùng event khác key đều 409 cùng code/message; không thêm event/hiệu ứng hoặc tăng version lần nữa; SUCCESS trùng trạng thái vẫn 200. Commit `27f6e4c`.
3. Builder: test viết trước, chạy với stub chỉ trả input: 10 test thất bại vì không từ chối input sai. Sau triển khai 13 test builder/kiểm tra các điểm ghi đạt. Hai shop: hủy một phần làm attempt cũ CANCELLED; callback muộn hoàn cả snapshot gốc, không đổi trạng thái hoặc tồn. Một test hết hạn xác nhận hoàn khi toàn bộ phần đã hủy. SQL test xác nhận trigger chặn UPDATE, CHECK chặn JSON không phải array và NOT NULL chặn NULL.

## Quyết định snapshot và giới hạn

DB bảo đảm NOT NULL, JSON array và trigger bất biến; không kiểm hình dạng từng phần tử. Service/builder và test bảo đảm ID UUID, tiền chuỗi chữ số VND dương, không trùng, tổng khớp và phần thuộc Order. Chế độ NEW từ chối phần CANCELLED; LATE_COMPENSATION so sánh nguyên snapshot attempt gốc và cho phép phần đã CANCELLED. Nếu cần CHECK DB cho từng phần tử, tạo task riêng; không sửa migration trong PR này. Kiểm tra source dùng TypeScript AST cho property assignment và shorthand; không phải phân tích mọi SQL hay dynamic assignment.

Một số task vẫn mở: chưa có test riêng chứng minh restart toàn bộ API process, mọi thứ tự thắng race, replay hoàn tiền COD trong tình huống hợp lệ, đầy đủ các phân nhánh UI và V06–V08 end-to-end. `payment-panel.tsx` không dùng DTO của mock-result nên không phụ thuộc ID attempt gốc; tuy nhiên thông báo thành công dựa vào outcome yêu cầu, chưa được xác minh UX cho callback muộn bị hoàn. Không coi test clock fixture là đã chờ thật 15 phút.

Rà soát tĩnh cancel/reject, COD collection và shipment events: lỗi 409 được throw trong transaction nên idempotency claim rollback thay vì lưu response; gửi lại cùng key có thể được đánh giá lại sau khi trạng thái đổi. Chưa chứng minh mọi tình huống bằng test, đề xuất task riêng đối chiếu contract replay status/body; không sửa hàng loạt ở đây.

## Review remediation (2026-11-02)

C1: `expireDueOrders` chỉ tăng `version`, không ghi `marketplace_orders.status = PENDING` → `CANCELLED`, nên đơn hết hạn vẫn còn PENDING ở cột gốc và bị bỏ khỏi truy vấn Admin `?status=CANCELLED`.

- Red: `corepack pnpm test:expiry` thất bại với `Expected: "CANCELLED", Received: "PENDING"` khi đọc cột `marketplace_orders.status`; danh sách Admin lọc CANCELLED không chứa đơn vừa hết hạn.
- Green: sau khi hủy các phần PENDING trong transaction, service đọc lại trạng thái toàn bộ seller-order và ghi `deriveMarketplaceOrderStatus(...)` cùng `version: { increment: 1 }`; nếu không còn phần PENDING thì bỏ qua sớm để không tạo audit sai trong race. `test:expiry` đạt 1 test; test Admin thấy đơn trong danh sách CANCELLED.
- Migration `0009_backfill_expired_order_status` là data-only/idempotent, chỉ sửa đơn MOCK đã quá `payment_deadline`, không còn seller-order khác CANCELLED và không có attempt `NORMAL/SUCCEEDED`. `database-migrations.spec.ts` chạy SQL hai lần: lần đầu `rowCount` 1, lần hai 0; đơn chưa hết hạn và đơn đã thanh toán giữ nguyên PENDING.
- Giới hạn: migration bỏ qua đơn có trạng thái phần đơn hỗn hợp (không tự đoán), không ghi audit row; đây là sửa dữ liệu một lần, không thay logic sweep.
- Xác minh lại: `test:integration` đạt 13 suite / 62 test; `prisma:schema:check` "No difference detected".

## Review remediation (2026-11-03): T088, T090, T100 và CI

Môi trường: Windows, Node.js 24.21.0, pnpm 12.14.0 qua Corepack; PostgreSQL disposable `cnpm_test` tại `localhost:5432`, `TEST_DATABASE_NAME_CONFIRMATION=cnpm_test`.

### T088 — ma trận contract payments/cancellation

- Red: thêm test `keeps payment allocations and refunds closed with exact VND fields`; thất bại vì `Payment.allocations.items.additionalProperties` là `undefined` và `Payment.refunds.items` còn `additionalProperties: true`.
- Green: thêm schema đóng `PaymentAllocation` và `PaymentRefund` (`amount` khớp `^[0-9]+$`, `reason` enum `CANCELLATION|LATE_SUCCESS|CONFIRMED_RETURN`), trỏ `Payment.allocations/refunds` sang `$ref`; regenerate `packages/api-client/src/generated/index.ts`.
- Bổ sung ma trận lỗi 400/401/403/404/409 trả `ErrorEnvelope` cho cả 8 operation payment/cancellation.
- Kết quả: `corepack pnpm test:contracts` đạt 10 suite / 235 test; riêng spec payments 25/25.

### T090 — DB, race, retry và COD

- Thêm `serializes a successful result racing with the expiry sweep without double settlement`: gửi mock-result `SUCCEEDED` đồng thời `expireDueOrders()`. Quan sát thực tế: nếu expiry thắng, mock-result trả 409 `VERSION_CONFLICT` và order `CANCELLED`/`UNPAID`/refund 0; nếu success thắng, expiry trả 0 và order `PAID`; nếu late compensation xảy ra, order `CANCELLED`/`REFUNDED`/refund 2500. Bất biến: RESTORE ≤ 1, refund ≤ 1.
- Thêm `retries a failed mock attempt on the same order before the deadline`: FAILED → attempt mới PENDING → SUCCEEDED, đúng một allocation.
- Mở rộng test COD collection: replay cùng key/cùng event trả cùng payment; event replay với key khác trả cùng payment; event mới cùng seller order bị 409 `COD_ALREADY_COLLECTED`; còn đúng một allocation.
- Các nhánh đã có trước đó vẫn xanh: DB clock/restart sweep, late compensation/refund, partial cancel invalidates attempt, key conflict 10-way và cancel-vs-success race.
- Kết quả: `payment.integration.spec.ts` 6/6; concurrency 3/3; toàn bộ `test:integration` 13 suite / 65 test.

### T100 — V06–V08 và COD

- V06: thêm `replays a concurrent checkout ten times with one order and one stock effect` — 10 request cùng key trả cùng Order, một SALE movement, stock 6 → 4, key cũ với quote khác trả 409; cộng với replay 10-way payment/cancel hiện có.
- V07: success/fail/retry/expiry/late compensation chạy trong payment integration; `test:expiry` dùng DB clock và job khởi động lại.
- V08: hủy một phần PENDING chỉ hủy phần đó; hủy tổng khi có CONFIRMED trả 409 và không đổi phần nào; snapshot/version giữ nguyên.
- COD: happy path sau `DELIVERED` trong fulfillment integration và nhánh replay/duplicate ở trên; không tạo shipment giả.
- Seed: chạy `PAYMENT_FIXTURE_ORDER_ID=<uuid> corepack pnpm --filter @marketplace/api seed:payments` tạo attempt PENDING cho đơn MOCK 450 VND / 2 seller order; guard chỉ cho DB `_test|_disposable` với confirmation khớp.
- E2E full-stack: `corepack pnpm exec playwright test --config=playwright.fulfillment.config.ts` đạt 1 test (MOCK/COD/cancel/retry/return/restart) trên API thật + PostgreSQL thật.

### CI (M8)

- `.github/workflows/ci.yml` thêm bước contract tests, concurrency, cài Playwright Chromium và chạy checkout E2E + fulfillment E2E. Integration đã bao gồm `tests/concurrency`; bước riêng giúp evidence tường minh.
- Root scripts mới: `test:contracts`, `test:concurrency`.
- Kết quả cục bộ: checkout E2E 3/3 (16.4s); fulfillment E2E 1/1 (57.4s); contract 235/235; concurrency 3/3.
- `playwright.fulfillment.config.ts` chuyển webServer sang `corepack pnpm` để tránh pnpm 12.15 toàn cục; CI dùng pnpm 12.14 đã activate.

### Giới hạn

- T099 (trạng thái UI payment/cancel) vẫn mở theo phạm vi frontend. T091–T098 đã được đối chiếu và tick ở mục "Đối chiếu T091–T098 (2026-11-03)" bên dưới.
- T152 (release CI/desktop artifacts) vẫn mở; batch này chỉ bổ sung contract/E2E vào CI kiểm thử. Desktop buyer chưa có build nên chưa thể đưa artifact vào CI.

## Review remediation (2026-11-03): I3 shape contract và I5 replay sau mất quyền

Môi trường: Windows, Node.js 24.21.0, pnpm 12.14.0 qua Corepack; PostgreSQL disposable `cnpm_test` tại `localhost:5432`, `TEST_DATABASE_NAME_CONFIRMATION=cnpm_test`. Batch chỉ sửa API/contract/test, không sửa frontend.

### I3 — kiểm shape response toàn cục và parity runtime categories

- Spec mới `tests/contracts/response-shape.contract.spec.ts` quét toàn bộ operation 2xx của OpenAPI: mọi nhánh `data` phải resolve về object đóng (`additionalProperties: false`, đủ `required`) hoặc array có item đóng; mọi component object phải đóng; mọi response 400/401/403/404/409 phải dùng `ErrorEnvelope`.
- Red: spec thất bại với `CategoryTreeNode` (`Expected: false, Received: undefined`) ở `GET /categories` và `GET /admin/categories`; danh sách component mở chỉ có `CategoryTreeNode`.
- Spec mới `tests/contracts/catalog-response.contract.spec.ts` boot `AppModule` với `CatalogService`/guard override và so khớp key thực tế của flat list, tree, admin tree, POST 201, PATCH 200 với schema.
- Red: flat/POST/PATCH thất bại vì schema yêu cầu `createdAt`/`updatedAt` trong khi runtime trả projection `{id,name,parentId,visible,version}`; tree/admin thất bại vì `CategoryTreeNode.additionalProperties` là `undefined`.
- Green: `Category` trong OpenAPI đổi sang projection runtime (bỏ timestamp, thêm `version` bắt buộc); `CategoryTreeNode` đóng schema, `version` bắt buộc, `children` đệ quy; `specs/001-marketplace-mvp/contracts/api.md` dòng Category cập nhật theo; regenerate `packages/api-client/src/generated/index.ts`.
- Kết quả: `corepack pnpm test:contracts` đạt 12 suite / 319 test, gồm 2 spec mới.

### I5 — idempotency không bị đốt và replay phải kiểm quyền

- Thêm test fulfillment `keeps a COD collection key usable after a rejected version`: gửi COD với `expectedVersion + 1` nhận 409 `VERSION_CONFLICT`; dùng lại đúng key với version đúng nhận 200; replay nhận cùng payment; chỉ một allocation `COD_COLLECTION`.
- Thêm test `keeps a shipment key usable after rejection and denies replay once membership is revoked`: retry sai version nhận 409; dùng lại key nhận 200 (attempt 2); replay 200 cùng version; sau khi `ShopMember` bị `REVOKED`, replay cùng key nhận 404.
- Kết luận điều tra: claim idempotency nằm trong `OrderTransaction.run`, nên 401/403/404/409 rollback và không đốt key; `collectCod` đã kiểm user/permission trước nhánh replay. Lỗ hổng còn lại là `ShippingService.perform` trả `{replay:true}` trước khi kiểm quyền, dựa vào `get()` để chặn đọc — đúng về HTTP nhưng phụ thuộc chính sách đọc.
- Fix phòng thủ: tách `authorize(tx, userId, action, shopId)` (user `ACTIVE`, `RETURN` cần quyền admin, còn lại cần `manageShipments` hoặc membership `ACTIVE` của shop) và gọi trước `return { replay: true }`; `preview` bổ sung `shopId`. Nhánh ghi vẫn giữ thứ tự khóa cũ và gọi cùng helper.
- Kết quả: `fulfillment.integration.spec.ts` 15/15; toàn bộ `test:integration` 13 suite / 67 test.

### Xác minh lại

- `corepack pnpm test:contracts`: 12 suite / 319 test đạt.
- `corepack pnpm --filter @marketplace/api test:unit`: 14 suite / 62 test đạt.
- `corepack pnpm --filter @marketplace/api test:integration`: 13 suite / 67 test đạt trên DB disposable.
- `corepack pnpm --filter @marketplace/api lint`, `--filter @marketplace/api-client lint`, typecheck API và api-client: đạt; api-client 105 test đạt.
- Giới hạn: chưa có unit test riêng cho `ShippingService`; hành vi replay được chứng minh ở mức HTTP. Claim idempotency vẫn ghi trước kiểm quyền nhưng nằm trong transaction nên rollback — không thay đổi kiến trúc này trong batch.

## Đối chiếu T091–T098 (2026-11-03)

Môi trường: Windows, Node.js 24.21.0, PostgreSQL disposable `cnpm_test` tại `localhost:5432` với `TEST_DATABASE_NAME_CONFIRMATION=cnpm_test`. Batch chỉ sửa backend/test, không sửa frontend.

### T091/T092 — ràng buộc DB cho PaymentAttempt/Allocation/Event/Refund

- Thêm 2 test vào `apps/api/test/integration/database-migrations.spec.ts`:
  - `declares nullable payment attempt fields and the US6 partial uniques/indexes`: kiểm `information_schema.columns` (NOT NULL cho `payment_id`, `attempt_number`, `provider`, `settlement_kind`, `status`, `target_seller_orders_snapshot`, `amount`, `operation_key`; nullable cho `original_attempt_id`, `compensates_event_id`, `external_transaction_id`, `expires_at`, `settled_at`) và `pg_indexes` (các unique/index/deadline index, 4 partial index có `WHERE`).
  - `enforces payment attempt, event, allocation, and refund constraints`: insert thật rồi assert mã lỗi — `23514` cho amount > 0, snapshot phải là array, settlement link NORMAL/LATE, digest hex, late fields, refund status; `23505` cho unique `(payment_id, attempt_number)`, operation key, `(provider, external_transaction_id)` khi có, một PENDING MOCK NORMAL, một SUCCEEDED MOCK NORMAL, `compensates_event_id`, `(attempt_id, seller_order_id)`, COD_COLLECTION một lần/phần, refund `allocation_id`, event `(provider, external_event_id)`; `P0001` cho snapshot bất biến, allocation cần attempt SUCCEEDED, refund phải khớp allocation và append-only của allocations/refunds/events.
- Lỗi phát hiện khi đối chiếu T094: `startMockAttempt` gán `originalAttemptId` của attempt trước cho retry NORMAL (lấy `payment.attempts.at(-1)` không sắp xếp), trái contract "originalAttemptId chỉ dành cho late compensation". Red: test retry nhận `"6f644061-…"` thay vì `null`. Green: bỏ suy luận attempt trước, luôn ghi `original_attempt_id = null` cho NORMAL; `LATE_COMPENSATION` vẫn do `SettlementService.compensateLate` gán về attempt gốc.

### T093–T098 — đối chiếu service/controller với test hiện có

- **T093**: `lockOrderGraph` khóa Order → Payment → SellerOrders; inventory được khóa qua `lockInventory` trước khi restore; `cancelAndRestore`/`compensateLate` chạy trong cùng transaction với OrderEvent/refund. Test race success-vs-expiry và partial cancel chứng minh chỉ một hiệu ứng, RESTORE/refund đúng một lần.
- **T094**: snapshot bất biến ở DB (test mới) và service không ghi đè; retry attempt mới `PENDING` với `originalAttemptId = null`; capture một lần; PaymentEvent dedupe `(provider, externalEventId)`; late success tạo compensation `SUCCEEDED` + allocation + refund đầy đủ. Bổ sung assert attempt gốc vẫn `CANCELLED` và không có allocation sau late success.
- **T095**: policy `buyerCancellationBlockers`/`canCancelSellerOrder` unit test (BUYER chỉ PENDING; SELLER PENDING/CONFIRMED, không PACKING); integration chứng minh all-or-none bị chặn bởi phần CONFIRMED, part cancel vô hiệu attempt PENDING, restore/refund một lần và không đổi phần khác. Seller/Admin reject được kiểm ở fulfillment.
- **T096**: expiry dùng clock DB, sweep 30s bounded, restart catch-up (`new PaymentExpiryJob().onModuleInit()`), cập nhật Order CANCELLED bền vững; test cũng chứng minh DB từ chối sửa snapshot attempt và snapshot sai hình dạng.
- **T097**: `PaymentQueryService` giới hạn buyer sở hữu hoặc quyền xem payment; aggregate dùng BigInt/number string. Bổ sung assert `outstandingAmount` (`"2500"` khi UNPAID, `"0"` khi PAID/REFUNDED/đã hủy) bên cạnh `capturedAmount`/`refundedAmount`; COD collection chỉ hợp lệ khi shipment DELIVERED (fulfillment integration).
- **T098**: controller/DTO dùng `Idempotency-Key` UUID, `expectedVersion`, reason bắt buộc; thêm assert audit: `SELLER_ORDER_CANCELLED_BY_BUYER` đúng actor/target/reason/`orderId`, `ORDER_CANCELLED` chỉ một dòng dù replay key 10 lần, `SELLER_ORDER_REJECTED` và `ADMIN_SELLER_ORDER_REJECTED` đúng actor/target/`shopId`, không nhân bản khi replay.

### Xác minh

- `corepack pnpm --filter @marketplace/api test:integration`: 13 suite / 69 test đạt (tăng 2 test DB constraint) trên DB disposable.
- `corepack pnpm --filter @marketplace/api test:unit`: 14 suite / 62 test đạt.
- `corepack pnpm test:contracts`: 12 suite / 319 test đạt.
- Lint các file thay đổi đạt. `corepack pnpm --filter @marketplace/api typecheck` bị `ERR_PNPM_BAD_PM_VERSION` (Corepack dùng pnpm 12.15.0 trong khi repo ghim 12.14.0), nên typecheck được chạy trực tiếp bằng `apps/api/node_modules/.bin/tsc --noEmit` và đạt; đây là lệch môi trường, không phải lỗi mã.

### Ghi chú còn lại (không chặn tick)

- `original_attempt_id` của attempt NORMAL được bảo đảm bởi service/test, không thêm CHECK DB (schema chỉ yêu cầu nullable FK cho compensation).
- `startMockAttempt`/`mockResult` replay trước kiểm quyền giống pattern cũ, nhưng key idempotency scope theo actor, quyền sở hữu đơn bất biến và AccessGuard chặn tài khoản khóa nên không lộ dữ liệu chéo actor; không mở rộng sửa trong batch này.
- Shipping `RETURN` khóa shipment trước inventory trong khi sơ đồ chung ghi inventory trước shipment; không có luồng nào lấy ngược thứ tự nên không tạo chu trình deadlock.
- `isAttemptTerminal` hiện chỉ được dùng bởi unit test, là dead code phía production.
