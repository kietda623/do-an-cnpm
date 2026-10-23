"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizeFormError } from "@marketplace/api-client";
import type { ApiPath } from "@marketplace/api-client";
import { webSession } from "../../app/auth-form";
import { formatVnd } from "../money";

type Payment = {
  id: string;
  status: string;
  settlementKind: string;
  amount: string;
  transactionCode: string;
  refunds: Array<{ amount: string; reason: string }>;
};
type Props = {
  orderId: string;
  method: string;
  status: string;
  paymentStatus: string;
  outstandingAmount: string;
  deadline: string | null;
  onChange: () => Promise<void>;
};
export function PaymentPanel({
  orderId,
  method,
  status,
  paymentStatus,
  outstandingAmount,
  deadline,
  onChange,
}: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const reload = useCallback(async () => {
    const data = await webSession.api.request<Payment[]>(`/payments?orderId=${orderId}` as ApiPath);
    setPayments(data);
  }, [orderId]);
  useEffect(() => {
    void reload().catch((cause) => setError(normalizeFormError(cause)));
  }, [reload]);

  async function mockPay(outcome: "SUCCEEDED" | "FAILED") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const startIntentKey = `marketplace.payment.start.${orderId}`;
      let attempt: Payment | undefined;
      const storedAttempt = sessionStorage.getItem(startIntentKey);
      if (storedAttempt) attempt = JSON.parse(storedAttempt) as Payment;
      if (attempt) {
        const currentPayments = await webSession.api.request<Payment[]>(
          `/payments?orderId=${orderId}` as ApiPath,
        );
        setPayments(currentPayments);
        attempt = currentPayments.find((payment) => payment.id === attempt?.id) ?? attempt;
      }
      if (attempt && attempt.status !== "PENDING") {
        if (attempt.status === "SUCCEEDED") {
          await Promise.all([reload(), onChange()]);
          setMessage("Thanh toán thử nghiệm đã được ghi nhận.");
          return;
        }
        sessionStorage.removeItem(startIntentKey);
        attempt = undefined;
      }
      if (!attempt) {
        let key = sessionStorage.getItem(`${startIntentKey}.key`);
        if (!key) {
          key = crypto.randomUUID();
          sessionStorage.setItem(`${startIntentKey}.key`, key);
        }
        attempt = await webSession.api.request<Payment>("/payments/mock-attempts", {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ orderId }),
        });
        sessionStorage.setItem(startIntentKey, JSON.stringify(attempt));
        sessionStorage.removeItem(`${startIntentKey}.key`);
      }
      const order = await webSession.api.request<{ version: number }>(
        `/orders/${orderId}` as ApiPath,
      );
      const intentKey = `marketplace.payment.result.${attempt.id}.${outcome}`;
      let key = sessionStorage.getItem(`${intentKey}.key`);
      if (!key) {
        key = crypto.randomUUID();
        sessionStorage.setItem(`${intentKey}.key`, key);
      }
      let eventId = sessionStorage.getItem(`${intentKey}.event`);
      if (!eventId) {
        eventId = crypto.randomUUID();
        sessionStorage.setItem(`${intentKey}.event`, eventId);
      }
      let expectedVersion = sessionStorage.getItem(`${intentKey}.version`);
      if (!expectedVersion) {
        expectedVersion = String(order.version);
        sessionStorage.setItem(`${intentKey}.version`, expectedVersion);
      }
      await webSession.api.request(`/payments/${attempt.id}/mock-result` as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ eventId, outcome, expectedVersion: Number(expectedVersion) }),
      });
      sessionStorage.removeItem(`${intentKey}.key`);
      sessionStorage.removeItem(`${intentKey}.event`);
      sessionStorage.removeItem(`${intentKey}.version`);
      sessionStorage.removeItem(startIntentKey);
      setMessage(
        outcome === "SUCCEEDED"
          ? "Thanh toán thử nghiệm thành công."
          : "Giao dịch thất bại; anh có thể thử lại.",
      );
      await Promise.all([reload(), onChange()]);
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border p-5" aria-label="Thanh toán">
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="font-semibold">Thanh toán</h2>
        <span>{paymentStatus}</span>
      </div>
      <p>
        {method === "COD" ? "Thanh toán khi nhận hàng" : "Thanh toán mô phỏng"} · Còn phải trả{" "}
        {formatVnd(outstandingAmount)}
      </p>
      {deadline && (
        <p className="text-sm text-neutral-600">
          Hạn thanh toán: {new Date(deadline).toLocaleString("vi-VN")} · Còn{" "}
          {Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1_000))} giây (máy chủ quyết
          định trạng thái hết hạn)
        </p>
      )}
      {payments.map((payment) => (
        <div key={payment.id} className="text-sm">
          {payment.transactionCode} · {payment.status} · {formatVnd(payment.amount)}
          {payment.refunds.map((refund, index) => (
            <span key={index}>
              {" "}
              · Hoàn {formatVnd(refund.amount)} ({refund.reason})
            </span>
          ))}
        </div>
      ))}
      {method === "MOCK" &&
        status !== "CANCELLED" &&
        paymentStatus !== "PAID" &&
        paymentStatus !== "REFUNDED" && (
          <div className="flex flex-wrap gap-2">
            <button
              disabled={busy}
              className="min-h-10 rounded-lg border px-4 disabled:opacity-50"
              onClick={() => void mockPay("SUCCEEDED")}
            >
              Mô phỏng thanh toán thành công
            </button>
            <button
              disabled={busy}
              className="min-h-10 rounded-lg border px-4 disabled:opacity-50"
              onClick={() => void mockPay("FAILED")}
            >
              Mô phỏng thất bại
            </button>
          </div>
        )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
