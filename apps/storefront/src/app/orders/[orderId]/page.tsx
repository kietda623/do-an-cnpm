"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, type SessionUser } from "@marketplace/ui-web";
import type { ApiPath } from "@marketplace/api-client";
import { webSession } from "../../auth-form";
import { formatVnd } from "../../../features/money";
import { PaymentPanel } from "../../../features/orders/payment-panel";
import { CancelDialog } from "../../../features/orders/cancel-dialog";

type Order = {
  orderNumber: string;
  status: string;
  paymentMethod: string;
  originalTotal: string;
  paymentDeadline: string | null;
  paymentStatus: string;
  outstandingAmount: string;
  version: number;
  createdAt: string;
  sellerOrders: Array<{
    id: string;
    shopNameSnapshot: string;
    status: string;
    originalTotal: string;
    version: number;
    cancelledAt: string | null;
    cancelReason: string | null;
    capturedAmount: string;
    refundedAmount: string;
    outstandingAmount: string;
    shipment: {
      status: string;
      trackingCode: string;
      history: Array<{
        toStatus: string;
        reason: string | null;
        createdAt: string;
      }>;
    } | null;
    addressSnapshot: {
      recipientName: string;
      phone: string;
      line1: string;
      ward: string;
      district: string;
      province: string;
    };
    items: Array<{
      productId: string;
      productName: string;
      sku: string;
      attributes: Record<string, string>;
      quantity: number;
      unitPrice: string;
      lineTotal: string;
    }>;
  }>;
};
export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const { user, setUser } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [receiving, setReceiving] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!user) setUser(await webSession.restore<SessionUser>());
        const value = await webSession.api.request<Order>(
          `/orders/${orderId}` as ApiPath,
        );
        if (active) setOrder(value);
      } catch {
        if (active) {
          setError(true);
          router.replace("/login?returnTo=%2Forders");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [orderId]);
  async function refreshOrder() {
    const value = await webSession.api.request<Order>(
      `/orders/${orderId}` as ApiPath,
    );
    setOrder(value);
  }
  async function receive(sellerId: string, version: number) {
    setReceiving(sellerId);
    setActionError("");
    try {
      await webSession.api.request(
        `/orders/${orderId}/seller-orders/${sellerId}/receive` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ expectedVersion: version }),
        },
      );
      await refreshOrder();
    } catch {
      setActionError(
        "Chưa thể xác nhận nhận hàng. Hãy tải lại đơn và kiểm tra trạng thái giao, thanh toán.",
      );
      await refreshOrder();
    } finally {
      setReceiving("");
    }
  }
  if (loading)
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <p role="status">Đang tải đơn hàng…</p>
      </main>
    );
  if (error || !order)
    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <p role="alert">Không tìm thấy đơn hàng.</p>
        <Link className="underline" href="/orders">
          Danh sách đơn hàng
        </Link>
      </main>
    );
  const address = order.sellerOrders[0]?.addressSnapshot;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <header>
        <Link className="text-sm underline" href="/orders">
          ← Đơn hàng của tôi
        </Link>
        <h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1>
        <p className="mt-1 text-neutral-600">
          {order.status} · {new Date(order.createdAt).toLocaleString("vi-VN")}
        </p>
      </header>
      {address && (
        <section className="rounded-xl border p-5">
          <h2 className="font-semibold">Địa chỉ giao hàng</h2>
          <p className="mt-2">
            {address.recipientName} · {address.phone}
          </p>
          <p>
            {address.line1}, {address.ward}, {address.district},{" "}
            {address.province}
          </p>
        </section>
      )}
      {order.sellerOrders.map((seller) => (
        <section key={seller.id} className="rounded-xl border p-5">
          <div className="flex justify-between gap-3">
            <h2 className="font-semibold">{seller.shopNameSnapshot}</h2>
            <span>{seller.status}</span>
          </div>
          <div className="mt-3 divide-y">
            {seller.items.map((item, index) => (
              <article
                key={`${item.productId}-${index}`}
                className="flex justify-between gap-4 py-3"
              >
                <div>
                  <Link
                    className="font-medium underline"
                    href={`/products/${item.productId}`}
                  >
                    {item.productName}
                  </Link>
                  <p className="text-sm text-neutral-600">
                    {Object.values(item.attributes).join(" / ") || item.sku} ·{" "}
                    {formatVnd(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <strong>{formatVnd(item.lineTotal)}</strong>
              </article>
            ))}
          </div>
          <p className="text-right font-semibold">
            Tổng cửa hàng: {formatVnd(seller.originalTotal)}
          </p>
          {seller.capturedAmount !== undefined && (
            <p className="text-right text-sm text-neutral-600">
              Đã thu {formatVnd(seller.capturedAmount)} · Đã hoàn{" "}
              {formatVnd(seller.refundedAmount)}
            </p>
          )}
          {seller.status === "CANCELLED" && (
            <p className="text-right text-sm">
              Đã hủy{seller.cancelReason ? `: ${seller.cancelReason}` : ""}
            </p>
          )}
          {seller.shipment && (
            <section
              className="mt-4 border-t pt-4"
              aria-label={`Vận chuyển ${seller.shopNameSnapshot}`}
            >
              <h3 className="font-semibold">
                Vận chuyển · {seller.shipment.status}
              </h3>
              <p className="text-sm">
                Mã theo dõi: {seller.shipment.trackingCode}
              </p>
              <ol className="mt-2 list-inside list-decimal text-sm">
                {seller.shipment.history.map((event, index) => (
                  <li key={index}>
                    {event.toStatus} ·{" "}
                    {new Date(event.createdAt).toLocaleString("vi-VN")}
                    {event.reason ? ` · ${event.reason}` : ""}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {seller.status === "DELIVERED" &&
            seller.outstandingAmount === "0" && (
              <button
                disabled={receiving === seller.id}
                onClick={() => void receive(seller.id, seller.version)}
                className="mt-4 rounded border px-4 py-2 disabled:opacity-50"
              >
                Xác nhận đã nhận hàng
              </button>
            )}
        </section>
      ))}
      {actionError && (
        <p role="alert" className="text-red-700">
          {actionError}
        </p>
      )}
      <PaymentPanel
        orderId={orderId}
        method={order.paymentMethod}
        status={order.status}
        paymentStatus={order.paymentStatus}
        outstandingAmount={order.outstandingAmount}
        deadline={order.paymentDeadline}
        onChange={refreshOrder}
      />
      <CancelDialog
        orderId={orderId}
        orderVersion={order.version}
        parts={order.sellerOrders}
        status={order.status}
        onDone={refreshOrder}
      />
      <section className="rounded-xl bg-neutral-50 p-5">
        <p className="mt-2 flex justify-between text-lg">
          <span>Tổng đơn hàng</span>
          <strong>{formatVnd(order.originalTotal)}</strong>
        </p>
      </section>
    </main>
  );
}
