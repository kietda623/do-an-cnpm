"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  EmptyState,
  Package,
  PageHeader,
  StatusBadge,
  StatusMessage,
  formatDateTime,
  formatVnd,
  marketplaceOrderStatuses,
  paymentStatuses,
  useApi,
  usePolling,
} from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";
import { webSession } from "../../lib/session";

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  originalTotal: string;
  createdAt: string;
};
export default function OrdersPage() {
  const router = useRouter();
  const { status } = useApi();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadOrders = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await webSession.api.request<Order[]>("/orders");
      if (alive.current) setOrders(response);
    } catch (cause) {
      if (!silent && alive.current) setError(normalizeFormError(cause));
      throw cause;
    } finally {
      if (!silent && alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login?returnTo=%2Forders");
      return;
    }
    void loadOrders().catch(() => {});
  }, [loadOrders, router, status]);

  usePolling(loadOrders, {
    intervalMs: 30_000,
    enabled: status === "authenticated",
    pauseWhile: loading,
  });

  return (
    <div className="mp-container mp-orders">
      <PageHeader
        title="Đơn hàng của tôi"
        description="Mỗi đơn có thể gồm nhiều cửa hàng; theo dõi và xử lý từng phần riêng."
      />
      {loading ? (
        <div className="mp-orders__list" aria-busy="true">
          {[0, 1].map((index) => (
            <span key={index} className="mp-skeleton mp-orders__skeleton" />
          ))}
          <p className="mp-visually-hidden" role="status">
            Đang tải đơn hàng…
          </p>
        </div>
      ) : error ? (
        <StatusMessage tone="error" title="Không tải được đơn hàng">
          {error}
        </StatusMessage>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Package size={22} />}
          title="Bạn chưa có đơn hàng nào."
          description="Đơn hàng sẽ xuất hiện ở đây sau khi anh đặt hàng thành công."
          action={
            <Link className="mp-button mp-button--primary" href="/products">
              Khám phá sản phẩm
            </Link>
          }
        />
      ) : (
        <ul className="mp-orders__list mp-stagger">
          {orders.map((order, index) => (
            <li key={order.id} style={{ "--i": index } as CSSProperties}>
              <Link className="mp-order-card" href={`/orders/${order.id}`}>
                <div className="mp-order-card__top">
                  <div>
                    <p className="mp-order-card__number">{order.orderNumber}</p>
                    <p className="mp-order-card__date">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <StatusBadge status={order.status} map={marketplaceOrderStatuses} />
                </div>
                <div className="mp-order-card__bottom">
                  <StatusBadge status={order.paymentStatus} map={paymentStatuses} />
                  <span className="mp-order-card__total" data-numeric>
                    {formatVnd(order.originalTotal)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
