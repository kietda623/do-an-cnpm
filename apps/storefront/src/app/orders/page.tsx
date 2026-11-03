"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (status === "loading") return;
    if (status === "anonymous") {
      router.replace("/login?returnTo=%2Forders");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    void webSession.api
      .request<Order[]>("/orders")
      .then((response) => {
        if (active) setOrders(response);
      })
      .catch((cause) => {
        if (active) setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router, status]);

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
        <ul className="mp-orders__list">
          {orders.map((order) => (
            <li key={order.id}>
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
