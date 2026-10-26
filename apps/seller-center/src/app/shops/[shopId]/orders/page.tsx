"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type Shipment = {
  id: string;
  status: string;
  version: number;
  history: Array<{ toStatus: string; createdAt: string }>;
};
type SellerOrder = {
  id: string;
  status: string;
  version: number;
  orderId: string;
  originalTotal: string;
  outstandingAmount: string;
  shopNameSnapshot: string;
  shipment: Shipment | null;
  items: Array<{ productName: string; quantity: number; lineTotal: string }>;
};
type Page = {
  data: SellerOrder[];
  meta: { page: number; pageSize: number; total: number };
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string, init?: RequestInit) =>
  api.request<T>(path as ApiPath, init);

export default function SellerOrdersPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useSession();
  const [rows, setRows] = useState<SellerOrder[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const refresh = useCallback(async () => {
    const query = status ? `?status=${status}` : "";
    const page = await request<Page>(`/shops/${shopId}/orders${query}`);
    setRows(page.data);
    setError("");
  }, [shopId, status]);
  useEffect(() => {
    if (user)
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, refresh]);

  async function perform(
    row: SellerOrder,
    action:
      | "confirm"
      | "pack"
      | "reject"
      | "PICKED_UP"
      | "IN_TRANSIT"
      | "DELIVERED"
      | "FAILED"
      | "retry"
      | "cod",
  ) {
    setBusy(row.id);
    try {
      const shipment = row.shipment;
      const reason =
        action === "FAILED" || action === "retry" || action === "reject"
          ? window.prompt("Lý do", "")
          : null;
      if (
        (action === "FAILED" || action === "retry" || action === "reject") &&
        !reason?.trim()
      )
        return;
      const path =
        action === "cod"
          ? `/payments/seller-orders/${row.id}/cod-collection`
          : action === "confirm" || action === "pack" || action === "reject"
            ? `/shops/${shopId}/orders/${row.id}/${action}`
            : `/shipments/${shipment?.id}/${action === "retry" ? "retry" : "events"}`;
      const body =
        action === "cod"
          ? { eventId: crypto.randomUUID(), expectedVersion: row.version }
          : action === "confirm" || action === "pack"
            ? { expectedVersion: row.version }
            : action === "reject"
              ? { reason, expectedVersion: row.version }
              : action === "retry"
                ? { reason, expectedVersion: shipment?.version }
                : {
                    eventId: crypto.randomUUID(),
                    event: action,
                    reason: reason || undefined,
                    expectedVersion: shipment?.version,
                  };
      await request(path, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        await refresh();
        setError(
          "Đơn đã thay đổi. Hãy kiểm tra trạng thái mới trước khi thử lại.",
        );
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Đơn của cửa hàng</h1>
        <p>Xử lý các đơn đã tạo, kể cả khi cửa hàng đang tạm ngưng.</p>
      </header>
      <label className="flex gap-3">
        Trạng thái{" "}
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
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
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <section className="space-y-4" aria-label="Danh sách đơn">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl border p-5 space-y-3">
            <h2 className="font-semibold">
              {row.shopNameSnapshot} · {row.status}
            </h2>
            <p className="text-sm">Mã phần đơn: {row.id}</p>
            <ul>
              {row.items.map((item, index) => (
                <li key={index}>
                  {item.productName} × {item.quantity} · {item.lineTotal} ₫
                </li>
              ))}
            </ul>
            <p>Tổng: {row.originalTotal} ₫</p>
            {row.shipment && (
              <div>
                <p>Vận chuyển: {row.shipment.status}</p>
                <ol className="list-inside list-decimal text-sm">
                  {row.shipment.history.map((event, index) => (
                    <li key={index}>
                      {event.toStatus} ·{" "}
                      {new Date(event.createdAt).toLocaleString("vi-VN")}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(row.status === "PENDING"
                ? ["confirm", "reject"]
                : row.status === "CONFIRMED"
                  ? ["pack"]
                  : row.shipment?.status === "WAITING_PICKUP"
                    ? ["PICKED_UP"]
                    : row.shipment?.status === "PICKED_UP"
                      ? ["IN_TRANSIT"]
                      : row.shipment?.status === "IN_TRANSIT"
                        ? ["DELIVERED", "FAILED"]
                        : row.shipment?.status === "FAILED"
                          ? ["retry"]
                          : []
              ).map((action) => (
                <button
                  key={action}
                  disabled={busy === row.id}
                  onClick={() =>
                    void perform(row, action as Parameters<typeof perform>[1])
                  }
                  className="rounded border px-3 py-2 disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
              {row.status === "DELIVERED" && row.outstandingAmount !== "0" && (
                <button
                  disabled={busy === row.id}
                  onClick={() => void perform(row, "cod")}
                  className="rounded border px-3 py-2 disabled:opacity-50"
                >
                  Thu COD
                </button>
              )}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
