"use client";

import { useEffect, useState } from "react";
import { Button, Clock, formatVnd } from "@marketplace/ui-web";

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
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining =
    now === null
      ? null
      : Math.max(0, Math.ceil((new Date(quote.expiresAt).getTime() - now) / 1_000));
  const expired = remaining !== null && remaining <= 0;

  return (
    <section className="mp-confirm" aria-labelledby="checkout-confirm">
      <header>
        <div>
          <h2 id="checkout-confirm">Xác nhận đơn hàng</h2>
          <p>
            Báo giá có hiệu lực đến{" "}
            {new Date(quote.expiresAt).toLocaleTimeString("vi-VN")}.
          </p>
        </div>
        {!expired && remaining !== null ? (
          <span className="mp-confirm__timer" role="status">
            <Clock size={15} aria-hidden="true" />
            Còn {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        ) : null}
      </header>
      <dl className="mp-confirm__total">
        <div>
          <dt>Tổng cộng</dt>
          <dd data-numeric>{formatVnd(quote.total)}</dd>
        </div>
      </dl>
      <Button
        size="lg"
        fullWidth
        loading={pending}
        disabled={!quote.valid || expired}
        onClick={onConfirm}
      >
        Đặt hàng
      </Button>
      <p className="mp-confirm__note">
        Báo giá đã được lưu để có thể tiếp tục nếu cần thử lại.
      </p>
      {expired ? (
        <p className="mp-confirm__expired" role="alert">
          Báo giá đã hết hiệu lực. Cập nhật báo giá để tiếp tục.
        </p>
      ) : null}
    </section>
  );
}
