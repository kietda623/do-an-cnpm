import { formatVnd } from "../money";

type Quote = { expiresAt: string; total: string; valid: boolean };

export function CheckoutConfirm({
  quote,
  pending,
  onConfirm,
}: {
  quote: Quote;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-neutral-50 p-5">
      <div>
        <h2 className="font-semibold">Xác nhận đơn hàng</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Báo giá có hiệu lực đến {new Date(quote.expiresAt).toLocaleTimeString("vi-VN")}.
        </p>
      </div>
      <p className="flex justify-between text-lg">
        <span>Tổng cộng</span>
        <strong>{formatVnd(quote.total)}</strong>
      </p>
      <button
        disabled={pending || !quote.valid}
        onClick={onConfirm}
        className="min-h-11 w-full rounded-lg bg-marketplace-accent px-5 font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Đang xử lý…" : "Đặt hàng"}
      </button>
      <p className="text-xs text-neutral-600">
        Báo giá đã được lưu để có thể tiếp tục nếu cần thử lại.
      </p>
    </section>
  );
}
