"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  CreditCard,
  StatusBadge,
  StatusMessage,
  formatVnd,
  paymentAttemptStatuses,
  paymentMethods,
  paymentStatuses,
  usePolling,
} from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";
import type { ApiPath } from "@marketplace/api-client";
import { webSession } from "../../lib/session";

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
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const reload = useCallback(async () => {
    const data = await webSession.api.request<Payment[]>(
      `/payments?orderId=${orderId}` as ApiPath,
    );
    setPayments(data);
  }, [orderId]);

  useEffect(() => {
    void reload().catch((cause) => setError(normalizeFormError(cause)));
  }, [reload]);

  usePolling(reload, {
    intervalMs: 10_000,
    enabled:
      method === "MOCK" &&
      status !== "CANCELLED" &&
      paymentStatus !== "PAID" &&
      paymentStatus !== "REFUNDED",
    pauseWhile: busy,
  });

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
        body: JSON.stringify({
          eventId,
          outcome,
          expectedVersion: Number(expectedVersion),
        }),
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

  const remainingSeconds =
    deadline && now !== null
      ? Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1_000))
      : null;
  const canMock =
    method === "MOCK" && status !== "CANCELLED" && paymentStatus !== "PAID" && paymentStatus !== "REFUNDED";

  return (
    <section className="mp-payment" aria-label="Thanh toán">
      <header className="mp-payment__head">
        <div>
          <h2>
            <CreditCard size={17} aria-hidden="true" />
            Thanh toán
          </h2>
          <p>{paymentMethods[method]?.label ?? method}</p>
        </div>
        <StatusBadge status={paymentStatus} map={paymentStatuses} />
      </header>

      <dl className="mp-payment__facts">
        <div>
          <dt>Còn phải trả</dt>
          <dd data-numeric>{formatVnd(outstandingAmount)}</dd>
        </div>
        {deadline && (
          <div>
            <dt>Hạn thanh toán</dt>
            <dd>
              {new Date(deadline).toLocaleString("vi-VN")}
              {remainingSeconds !== null ? (
                <span className="mp-payment__countdown">
                  {" "}
                  · Còn {remainingSeconds} giây
                </span>
              ) : null}
            </dd>
          </div>
        )}
      </dl>
      <p className="mp-payment__note">Máy chủ quyết định trạng thái hết hạn của đơn.</p>

      {payments.length > 0 && (
        <ul className="mp-payment__attempts">
          {payments.map((payment) => (
            <li key={payment.id}>
              <div>
                <p className="mp-payment__code">{payment.transactionCode}</p>
                <p className="mp-payment__settlement">{payment.settlementKind}</p>
              </div>
              <StatusBadge status={payment.status} map={paymentAttemptStatuses} />
              <span data-numeric>{formatVnd(payment.amount)}</span>
              {payment.refunds.length > 0 && (
                <div className="mp-payment__refunds">
                  {payment.refunds.map((refund, index) => (
                    <Badge key={index} tone="info">
                      Hoàn {formatVnd(refund.amount)} ({refund.reason})
                    </Badge>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canMock && (
        <div className="mp-payment__actions">
          <Button loading={busy} onClick={() => void mockPay("SUCCEEDED")}>
            Mô phỏng thanh toán thành công
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => void mockPay("FAILED")}>
            Mô phỏng thất bại
          </Button>
        </div>
      )}

      {message && (
        <p role="status" className="mp-payment__message">
          {message}
        </p>
      )}
      {error && (
        <StatusMessage tone="error" onDismiss={() => setError("")}>
          {error}
        </StatusMessage>
      )}
    </section>
  );
}
