"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  partiallyCancelled: boolean;
  originalTotal: string;
  outstandingAmount: string;
  paymentStatus: string;
  createdAt: string;
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string) => api.request<T>(path as ApiPath);

export default function AdminOrdersPage() {
  const { user } = useSession();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [filters, setFilters] = useState({
    q: "",
    buyerId: "",
    shopId: "",
    status: "",
    from: "",
    to: "",
  });
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    for (const [key, value] of Object.entries(filters))
      if (value.trim())
        params.set(
          key,
          key === "from" || key === "to"
            ? new Date(value).toISOString()
            : value.trim(),
        );
    setOrders(await request<OrderSummary[]>(`/admin/orders?${params}`));
    setError("");
  }, [filters]);
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, refresh]);
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để tra cứu đơn.</p>
        <Link href="/login">Đăng nhập</Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền tra cứu đơn hàng.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Tra cứu đơn hàng</h1>
        <p>Chế độ chỉ đọc; đơn đã hoàn tất không thể sửa.</p>
      </header>
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <label className="grid gap-1">
          Mã đơn / người mua
          <input
            aria-label="Tìm kiếm đơn hàng"
            value={filters.q}
            onChange={(event) =>
              setFilters({ ...filters, q: event.target.value })
            }
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Buyer ID
          <input
            aria-label="Buyer ID"
            value={filters.buyerId}
            onChange={(event) =>
              setFilters({ ...filters, buyerId: event.target.value })
            }
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Shop ID
          <input
            aria-label="Shop ID"
            value={filters.shopId}
            onChange={(event) =>
              setFilters({ ...filters, shopId: event.target.value })
            }
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Trạng thái
          <select
            aria-label="Lọc trạng thái đơn"
            value={filters.status}
            onChange={(event) =>
              setFilters({ ...filters, status: event.target.value })
            }
            className="rounded border p-2"
          >
            <option value="">Tất cả</option>
            {[
              "PENDING",
              "CONFIRMED",
              "PACKING",
              "SHIPPING",
              "DELIVERED",
              "COMPLETED",
              "CANCELLED",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          Tạo từ
          <input
            aria-label="Đơn từ ngày"
            type="datetime-local"
            value={filters.from}
            onChange={(event) =>
              setFilters({ ...filters, from: event.target.value })
            }
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Tạo đến
          <input
            aria-label="Đơn đến ngày"
            type="datetime-local"
            value={filters.to}
            onChange={(event) =>
              setFilters({ ...filters, to: event.target.value })
            }
            className="rounded border p-2"
          />
        </label>
        <button className="w-fit rounded border px-4 py-2 md:col-span-4">
          Tìm đơn
        </button>
      </form>
      {orders.map((order) => (
        <article key={order.id} className="rounded border p-4">
          <h2 className="text-xl font-semibold">
            <Link className="underline" href={`/orders/${order.id}`}>
              {order.orderNumber}
            </Link>
          </h2>
          <p>
            {order.status} · Thanh toán {order.paymentStatus} ·{" "}
            {order.originalTotal} VND
          </p>
          <p>
            {order.partiallyCancelled
              ? "Đã hủy một phần"
              : "Không hủy một phần"}{" "}
            · Còn phải thu {order.outstandingAmount} VND
          </p>
          <time>{new Date(order.createdAt).toLocaleString("vi-VN")}</time>
        </article>
      ))}
      {orders.length === 0 && !error && <p>Không có đơn phù hợp.</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
