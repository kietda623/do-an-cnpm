"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  WebSession,
  normalizeFormError,
  type ApiPath,
} from "@marketplace/api-client";

type Shipment = {
  id: string;
  status: string;
  version: number;
  attemptNumber: number;
  trackingCode: string;
};
type Part = {
  id: string;
  orderId: string;
  status: string;
  version: number;
  originalTotal: string;
  outstandingAmount: string;
  shipment: Shipment | null;
  items: Array<{ id: string; productName: string; quantity: number }>;
};
export function SellerOrderList({
  shopId,
  apiUrl,
}: {
  shopId: string;
  apiUrl: string;
}) {
  const api = useMemo(() => new WebSession(apiUrl).api, [apiUrl]);
  const [rows, setRows] = useState<Part[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const refresh = useCallback(async () => {
    setRows(
      await api.request<Part[]>(
        `/shops/${shopId}/orders${status ? `?status=${status}` : ""}` as ApiPath,
      ),
    );
  }, [api, shopId, status]);
  useEffect(() => {
    void refresh().catch((cause) => setError(normalizeFormError(cause)));
  }, [refresh]);
  async function action(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const intent = `${path}:${JSON.stringify({ ...body, eventId: undefined })}`;
    let key = sessionStorage.getItem(intent);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(intent, key);
    }
    try {
      if (body.eventId) body.eventId = key;
      await api.request(path as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify(body),
      });
      sessionStorage.removeItem(intent);
      await refresh();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-bold">Xử lý đơn hàng</h1>
      {error && <p role="alert">{error}</p>}
      <label>
        Lọc trạng thái{" "}
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
      <label className="block">
        Lý do cho từ chối/giao thất bại/giao lại{" "}
        <input
          className="ml-2 rounded border p-2"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {rows.map((part) => (
        <section key={part.id} className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">
            {part.id} · {part.status}
          </h2>
          <ul>
            {part.items.map((item) => (
              <li key={item.id}>
                {item.productName} × {item.quantity}
              </li>
            ))}
          </ul>
          <p>
            Tổng {part.originalTotal} VND · Còn phải thu{" "}
            {part.outstandingAmount} VND
          </p>
          <div className="flex flex-wrap gap-3">
            {part.status === "PENDING" && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(`/shops/${shopId}/orders/${part.id}/confirm`, {
                    expectedVersion: part.version,
                  })
                }
              >
                Xác nhận đơn
              </button>
            )}
            {part.status === "CONFIRMED" && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(`/shops/${shopId}/orders/${part.id}/pack`, {
                    expectedVersion: part.version,
                  })
                }
              >
                Đã đóng gói
              </button>
            )}
            {["PENDING", "CONFIRMED"].includes(part.status) && (
              <button
                disabled={busy || !reason.trim()}
                onClick={() =>
                  void action(`/shops/${shopId}/orders/${part.id}/reject`, {
                    reason,
                    expectedVersion: part.version,
                  })
                }
              >
                Từ chối đơn
              </button>
            )}
            {part.status === "DELIVERED" && part.outstandingAmount !== "0" && (
              <button
                disabled={busy}
                onClick={() =>
                  void action(
                    `/payments/seller-orders/${part.id}/cod-collection`,
                    {
                      eventId: crypto.randomUUID(),
                      expectedVersion: part.version,
                    },
                  )
                }
              >
                Ghi nhận đã thu COD
              </button>
            )}
            {part.shipment && (
              <>
                <p>
                  {part.shipment.trackingCode} · {part.shipment.status} · Lần{" "}
                  {part.shipment.attemptNumber}
                </p>
                {(part.shipment.status === "WAITING_PICKUP"
                  ? ["PICKED_UP"]
                  : part.shipment.status === "PICKED_UP"
                    ? ["IN_TRANSIT"]
                    : part.shipment.status === "IN_TRANSIT"
                      ? ["DELIVERED", "FAILED"]
                      : []
                ).map((event) => (
                  <button
                    key={event}
                    disabled={busy || (event === "FAILED" && !reason.trim())}
                    onClick={() =>
                      void action(`/shipments/${part.shipment!.id}/events`, {
                        eventId: crypto.randomUUID(),
                        event,
                        expectedVersion: part.shipment!.version,
                        ...(reason ? { reason } : {}),
                      })
                    }
                  >
                    {event}
                  </button>
                ))}
                {part.shipment.status === "FAILED" && (
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      void action(`/shipments/${part.shipment!.id}/retry`, {
                        expectedVersion: part.shipment!.version,
                        reason,
                      })
                    }
                  >
                    Giao lại
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      ))}
      {!rows.length && <p>Chưa có đơn hàng phù hợp.</p>}
    </main>
  );
}
