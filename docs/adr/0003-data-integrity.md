# ADR-0003: Toàn vẹn dữ liệu giao dịch marketplace

- **Trạng thái:** Accepted as MVP design baseline; migration/restore rehearsal verified 2026-11-10
- **Ngày:** 2026-10-21
- **Ngữ cảnh:** Checkout nhiều shop đồng thời chạm cart, catalog, stock, order và payment; callback, expiry, cancel và retry có thể đua nhau. Cần bảo toàn tiền/tồn/snapshot qua retry và crash.

## Quyết định

PostgreSQL là nguồn sự thật duy nhất. Dùng UUID PK/FK thật, composite shop-scoped FK ở quan hệ nhạy cảm, `NUMERIC(18,0)` cho tiền, integer cho lượng, UTC `timestamptz`, unique/check/index phù hợp. Không hard-delete dữ liệu giao dịch. Snapshot đơn là bất biến.

Checkout, hủy/hoàn kho, settlement/refund và state transition chạy trong transaction với idempotency record durable. Inventory decrement là conditional atomic write. Thứ tự khóa thống nhất: Idempotency → User/Cart → Quote → Order → Payment → SellerOrder(s) → Shop → Category → Product → Variant → Inventory → Shipment. READ COMMITTED + row locks/conditional writes; retry giới hạn chỉ cho lỗi deadlock/serialization, giữ nguyên idempotency key.

Mỗi OrderItem có tối đa một SALE movement và tối đa một RESTORE movement, với unique effect constraint. Payment attempt/event/allocation/refund là lịch sử append-only; refund bám allocation. Callback muộn được ghi nhận và bù trừ riêng, không sửa kết quả cũ hoặc mở lại đơn. Order aggregate được derive từ SellerOrder; payment status được derive từ collection/refund.

Cross-row totals và domain eligibility được kiểm tra trong service cùng transaction; không dựa vào CHECK xuyên bảng. AuditEvent append-only, metadata allowlist, không chứa token/secret/PII thừa. Idempotency key canonical hash: same key/same request trả lại kết quả; same key/different payload conflict.

## Lựa chọn và hệ quả

Row locks và conditional updates phù hợp với quy mô MVP và giữ các invariant gần dữ liệu. Durable event/movement rows giúp điều tra, replay an toàn và kiểm tra reconcile; đổi lại luồng write phải theo thứ tự khóa và integration tests phải chạy trên PostgreSQL thật. Không thêm distributed lock/cache để thay correctness DB.

## Chấp nhận và bằng chứng cần có trước release

- 20 checkout đồng thời cho stock 5 tạo đúng năm thành công, 15 conflict; stock không âm và movement sum chính xác.
- Hai lần hủy/expiry/restore/refund hoặc payment callback chỉ có một hiệu ứng kinh tế.
- Cancellation thắng callback và callback thắng cancellation đều kết thúc nhất quán; late success được bù trừ.
- Cross-shop FK/authorization, snapshot immutability, migration fresh/upgrade và crash/restart idempotency được xác minh bằng PostgreSQL integration tests.

Các mục trên là tiêu chí thiết kế và có phạm vi rộng hơn riêng rehearsal T149. Bằng chứng migration/integrity/restore được ghi riêng bên dưới; concurrency, crash/restart và các luồng nghiệp vụ cần đối chiếu evidence của task tương ứng trước release.

### Bằng chứng migration và restore T149 — 2026-11-10

- Fresh install trên PostgreSQL 18.1 áp dụng đủ chín migration đã commit; deploy lặp lại vẫn up to date. Rehearsal upgrade áp dụng `0001`–`0008`, sau đó Prisma chỉ áp dụng `0009_backfill_expired_order_status`; MOCK order hết hạn đủ điều kiện chuyển thành `CANCELLED`, version 1.
- Migration integration suite PASS 6 tests về FK, unique, check, hình dạng/bất biến payment snapshot, lịch sử append-only và backfill idempotent.
- Backup custom format được restore vào một database disposable trống khác. Migration ledger, schema parity, số constraint/index, số dòng fixture, trạng thái/version order và payment-attempt snapshot đều khớp. Probe FK, unique, check và sửa snapshot đều bị bản restore từ chối.
- Rehearsal dùng cluster local mới chỉ bind loopback và fixture test; không dùng hoặc sửa database ứng dụng, staging hay production, không chỉnh migration đã commit. Môi trường, lệnh, kết quả và giới hạn nằm trong [migration rehearsal](../database/migration-rehearsal.md).

Xem thêm [data design](../database/data-design.md) và [model/transaction detail](../../specs/001-marketplace-mvp/data-model.md).
