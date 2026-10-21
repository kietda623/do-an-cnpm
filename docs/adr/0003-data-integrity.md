# ADR-0003: Toàn vẹn dữ liệu giao dịch marketplace

- **Trạng thái:** Accepted as MVP design baseline
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

Các mục trên là tiêu chí thiết kế; chưa có bằng chứng thực thi vì chưa tạo source schema/migration. Xem [data design](../database/data-design.md) và [model/transaction detail](../../specs/001-marketplace-mvp/data-model.md).
