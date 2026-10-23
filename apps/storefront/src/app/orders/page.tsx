"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession, type SessionUser } from "@marketplace/ui-web";
import { webSession } from "../auth-form";
import { formatVnd } from "../../features/money";

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
  const { user, setUser } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!user) setUser(await webSession.restore<SessionUser>());
        const response = await webSession.api.request<Order[]>("/orders");
        if (active) setOrders(response);
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
  }, []);
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <header>
        <p className="text-sm text-neutral-600">Tài khoản</p>
        <h1 className="text-3xl font-bold">Đơn hàng của tôi</h1>
      </header>
      {loading ? (
        <p role="status">Đang tải đơn hàng…</p>
      ) : error ? (
        <p role="alert">Không tải được đơn hàng.</p>
      ) : orders.length === 0 ? (
        <section className="rounded-xl border p-8 text-center">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link className="mt-3 inline-block underline" href="/products">
            Khám phá sản phẩm
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-xl border p-5 hover:bg-neutral-50"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{order.orderNumber}</strong>
                <span>{order.status}</span>
              </div>
              <p className="mt-2 text-sm text-neutral-600">
                {new Date(order.createdAt).toLocaleString("vi-VN")} · {order.paymentStatus}
              </p>
              <p className="mt-2 font-semibold">{formatVnd(order.originalTotal)}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
