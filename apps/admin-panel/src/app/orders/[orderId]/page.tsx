"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type Order = {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: string;
  originalTotal: string;
  cancelledAmount: string;
  capturedAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  sellerOrders: Array<{
    id: string;
    shopId: string;
    shopNameSnapshot: string;
    status: string;
    version: number;
    originalTotal: string;
    items: Array<{
      id: string;
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
    shipment: {
      status: string;
      trackingCode: string;
      history: Array<{ toStatus: string; reason: string | null }>;
    } | null;
  }>;
  payments: Array<{
    id: string;
    status: string;
    amount: string;
    transactionCode: string;
    refunds: Array<{ amount: string; reason: string }>;
  }>;
};
type Detail = { order: Order; auditReferenceIds: string[] };
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string) => api.request<T>(path as ApiPath);

export default function AdminOrderDetailPage() {
  const { user } = useSession();
  const { orderId } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState<{
    part: Order["sellerOrders"][number];
    action: "confirm" | "pack" | "reject";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(
    async () => setDetail(await request<Detail>(`/admin/orders/${orderId}`)),
    [orderId],
  );
  useEffect(() => {
    if (user?.roles.includes("ADMIN") && orderId)
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, orderId, refresh]);
  async function recover() {
    if (!pendingRecovery) return;
    setBusy(true);
    setError("");
    try {
      const { part, action } = pendingRecovery;
      await api.request(
        `/admin/seller-orders/${part.id}/${action}` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({
            expectedVersion: part.version,
            reason: reason.trim(),
          }),
        },
      );
      setPendingRecovery(null);
      setReason("");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "SellerOrder vừa thay đổi hoặc tài khoản Seller chưa khóa. Đã tải lại dữ liệu; hãy kiểm tra phiên bản và điều kiện recovery.",
        );
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để xem đơn.</p>
        <Link href="/login">Đăng nhập</Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền xem đơn hàng.</p>
      </main>
    );
  if (error)
    return (
      <main className="p-8">
        <p role="alert">{error}</p>
        <Link href="/orders">Quay lại danh sách</Link>
      </main>
    );
  if (!detail)
    return (
      <main className="p-8" aria-busy="true">
        Đang tải đơn hàng…
      </main>
    );
  const { order } = detail;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-8">
      <Link href="/orders" className="underline">
        ← Danh sách đơn
      </Link>
      <header>
        <h1 className="text-3xl font-semibold">{order.orderNumber}</h1>
        <p>
          {order.status} · {order.paymentMethod} · {order.paymentStatus}
        </p>
        <p>Đơn chỉ đọc, bao gồm dữ liệu giao dịch đã hoàn tất.</p>
      </header>
      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">Tổng kết</h2>
        <p>Tổng ban đầu: {order.originalTotal} VND</p>
        <p>Đã hủy: {order.cancelledAmount} VND</p>
        <p>Đã thu: {order.capturedAmount} VND</p>
        <p>Đã hoàn: {order.refundedAmount} VND</p>
        <p>Còn phải thu: {order.outstandingAmount} VND</p>
        <p>Buyer: {order.buyerId}</p>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Các shop và mặt hàng</h2>
        {order.sellerOrders.map((part) => (
          <article key={part.id} className="rounded border p-4">
            <h3 className="font-semibold">
              {part.shopNameSnapshot} · {part.status}
            </h3>
            <p>
              Shop {part.shopId} · SellerOrder {part.id} · version{" "}
              {part.version} · {part.originalTotal} VND
            </p>
            {part.items.map((item) => (
              <p key={item.id}>
                {item.productName} ({item.sku}) × {item.quantity} ·{" "}
                {item.unitPrice} VND · {item.lineTotal} VND
              </p>
            ))}
            {part.shipment && (
              <p>
                Vận chuyển: {part.shipment.status} ·{" "}
                {part.shipment.trackingCode}
              </p>
            )}
            {(part.status === "PENDING" || part.status === "CONFIRMED") && (
              <div
                className="mt-3 flex flex-wrap gap-2"
                aria-label={`Recovery SellerOrder ${part.id}`}
              >
                {part.status === "PENDING" && (
                  <button
                    onClick={() => {
                      setPendingRecovery({ part, action: "confirm" });
                      setReason("");
                    }}
                    className="rounded border px-3 py-2"
                  >
                    Admin xác nhận
                  </button>
                )}
                {part.status === "CONFIRMED" && (
                  <button
                    onClick={() => {
                      setPendingRecovery({ part, action: "pack" });
                      setReason("");
                    }}
                    className="rounded border px-3 py-2"
                  >
                    Admin đóng gói
                  </button>
                )}
                <button
                  onClick={() => {
                    setPendingRecovery({ part, action: "reject" });
                    setReason("");
                  }}
                  className="rounded border px-3 py-2"
                >
                  Admin từ chối
                </button>
                <span className="self-center text-sm">
                  Recovery chỉ hợp lệ khi tài khoản Seller bị khóa.
                </span>
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">Thanh toán</h2>
        {order.payments.map((payment) => (
          <article key={payment.id}>
            <p>
              {payment.status} · {payment.amount} VND ·{" "}
              {payment.transactionCode}
            </p>
            {payment.refunds.map((refund, index) => (
              <p key={`${payment.id}-${index}`}>
                Hoàn {refund.amount} VND · {refund.reason}
              </p>
            ))}
          </article>
        ))}
      </section>
      <section className="rounded border p-4">
        <h2 className="text-xl font-semibold">Audit references</h2>
        {detail.auditReferenceIds.length ? (
          <ul>
            {detail.auditReferenceIds.map((id) => (
              <li key={id} className="font-mono">
                {id}
              </li>
            ))}
          </ul>
        ) : (
          <p>Chưa có audit reference.</p>
        )}
      </section>
      {error && <p role="alert">{error}</p>}
      {pendingRecovery && (
        <dialog
          open
          aria-labelledby="recovery-dialog-title"
          className="fixed inset-0 m-auto w-[min(92vw,34rem)] rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
        >
          <h2 id="recovery-dialog-title" className="text-xl font-semibold">
            Admin{" "}
            {pendingRecovery.action === "confirm"
              ? "xác nhận"
              : pendingRecovery.action === "pack"
                ? "đóng gói"
                : "từ chối"}{" "}
            SellerOrder
          </h2>
          <p>
            {pendingRecovery.part.id} · version {pendingRecovery.part.version}
          </p>
          <label className="my-4 grid gap-1">
            Lý do
            <textarea
              aria-label="Lý do recovery"
              minLength={1}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="rounded border p-2"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingRecovery(null)}
              className="rounded border px-4 py-2"
            >
              Hủy
            </button>
            <button
              disabled={busy || !reason.trim()}
              onClick={() => void recover()}
              className="rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
            >
              Xác nhận hành động
            </button>
          </div>
        </dialog>
      )}
    </main>
  );
}
