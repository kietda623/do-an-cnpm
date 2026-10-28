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
