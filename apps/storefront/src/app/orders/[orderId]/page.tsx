"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  OrderRail,
  orderRailCurrent,
  orderRailSteps,
  PageHeader,
  Panel,
  StatusBadge,
  StatusMessage,
  formatDateTime,
  formatVnd,
  marketplaceOrderStatuses,
  paymentMethods,
  paymentStatuses,
  useApi,
  usePolling,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../../../lib/session";
import { PaymentPanel } from "../../../features/orders/payment-panel";
import { CancelDialog } from "../../../features/orders/cancel-dialog";
import {
  TrackingTimeline,
  type Tracking,
} from "../../../features/orders/tracking-timeline";
import { ReceiveButton } from "../../../features/orders/receive-button";
import { ReviewForm } from "../../../features/reviews/review-form";

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
    shipment: Tracking | null;
    addressSnapshot: {
      recipientName: string;
      phone: string;
      line1: string;
      ward: string;
      district: string;
      province: string;
    };
    items: Array<{
      id: string;
      reviewId?: string | null;
      review?: { rating: number; comment: string; createdAt: string } | null;
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
  const { status } = useApi();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadOrder = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const value = await webSession.api.request<Order>(`/orders/${orderId}` as ApiPath);
        if (alive.current) setOrder(value);
        return value;
      } catch (cause) {
        if (!silent && alive.current) {
          if (cause instanceof ApiClientError && cause.status === 401) {
            router.replace("/login?returnTo=%2Forders");
            return undefined;
          }
          setError(normalizeFormError(cause));
        }
        throw cause;
      } finally {
        if (!silent && alive.current) setLoading(false);
      }
    },
    [orderId, router],
  );

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login?returnTo=%2Forders");
      return;
    }
    void loadOrder().catch(() => {});
  }, [loadOrder, router, status]);

  const refreshOrder = useCallback(async () => {
    await loadOrder({ silent: true });
  }, [loadOrder]);

  usePolling(loadOrder, {
    intervalMs: 30_000,
    enabled:
      status === "authenticated" &&
      order !== null &&
      order.status !== "COMPLETED" &&
      order.status !== "CANCELLED",
    pauseWhile: loading,
  });

  if (loading)
    return (
      <div className="mp-container mp-order-detail" aria-busy="true">
        <PageHeader title="Đang tải đơn hàng…" />
        <span className="mp-skeleton mp-order-detail__skeleton" />
        <p className="mp-visually-hidden" role="status">
          Đang tải đơn hàng…
        </p>
      </div>
    );

  if (error || !order)
    return (
      <div className="mp-container mp-order-detail">
        <StatusMessage tone="error" title="Không mở được đơn hàng">
          {error || "Không tìm thấy đơn hàng."}{" "}
          <Link className="mp-link" href="/orders">
            Danh sách đơn hàng
          </Link>
        </StatusMessage>
      </div>
    );

  const address = order.sellerOrders[0]?.addressSnapshot;

  return (
    <div className="mp-container mp-order-detail">
      <Link className="mp-backlink" href="/orders">
        <ArrowLeft size={15} aria-hidden="true" />
        Đơn hàng của tôi
      </Link>
      <PageHeader
        title={order.orderNumber}
        description={formatDateTime(order.createdAt)}
        meta={
          <>
            <StatusBadge status={order.status} map={marketplaceOrderStatuses} />
            <StatusBadge status={order.paymentStatus} map={paymentStatuses} />
            <span>{paymentMethods[order.paymentMethod]?.label ?? order.paymentMethod}</span>
          </>
        }
      />

      {address && (
        <section className="mp-order-address" aria-labelledby="order-address">
          <h2 id="order-address">
            <MapPin size={16} aria-hidden="true" />
            Địa chỉ giao hàng
          </h2>
          <p className="mp-order-address__name">
            {address.recipientName} · {address.phone}
          </p>
          <p>
            {address.line1}, {address.ward}, {address.district}, {address.province}
          </p>
        </section>
      )}

      <div className="mp-order-detail__shops">
        {order.sellerOrders.map((seller) => (
          <Panel
            key={seller.id}
            title={seller.shopNameSnapshot}
            actions={<StatusBadge status={seller.status} map={marketplaceOrderStatuses} />}
          >
            <OrderRail
              label={`Trạng thái đơn của ${seller.shopNameSnapshot}`}
              steps={orderRailSteps(seller.status)}
              currentId={orderRailCurrent(seller.status)}
            />
            <ul className="mp-order-items">
              {seller.items.map((item, index) => (
                <li key={`${item.productId}-${index}`}>
                  <div className="mp-order-items__info">
                    <Link href={`/products/${item.productId}`}>{item.productName}</Link>
                    <p>
                      {Object.values(item.attributes).join(" / ") || item.sku} ·{" "}
                      {formatVnd(item.unitPrice)} × {item.quantity}
                    </p>
                    {seller.status === "COMPLETED" && item.id && (
                      <ReviewForm
                        orderItemId={item.id}
                        reviewId={item.reviewId}
                        review={item.review}
                        onDone={refreshOrder}
                      />
                    )}
                  </div>
                  <strong data-numeric>{formatVnd(item.lineTotal)}</strong>
                </li>
              ))}
            </ul>

            <TrackingTimeline shipment={seller.shipment} />

            {seller.status === "DELIVERED" && seller.outstandingAmount === "0" && (
              <ReceiveButton
                orderId={orderId}
                sellerOrderId={seller.id}
                version={seller.version}
                onDone={refreshOrder}
              />
            )}

            <dl className="mp-order-totals">
              <div>
                <dt>Tổng cửa hàng</dt>
                <dd data-numeric>{formatVnd(seller.originalTotal)}</dd>
              </div>
              {seller.capturedAmount !== undefined && (
                <>
                  <div>
                    <dt>Đã thu</dt>
                    <dd data-numeric>{formatVnd(seller.capturedAmount)}</dd>
                  </div>
                  <div>
                    <dt>Đã hoàn</dt>
                    <dd data-numeric>{formatVnd(seller.refundedAmount)}</dd>
                  </div>
                </>
              )}
            </dl>

            {seller.status === "CANCELLED" && (
              <p className="mp-order-cancelled">
                Đã hủy{seller.cancelReason ? `: ${seller.cancelReason}` : ""}
              </p>
            )}
          </Panel>
        ))}
      </div>

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
      <section className="mp-order-summary" aria-label="Tổng đơn hàng">
        <span>Tổng đơn hàng</span>
        <strong data-numeric>{formatVnd(order.originalTotal)}</strong>
      </section>
    </div>
  );
}
