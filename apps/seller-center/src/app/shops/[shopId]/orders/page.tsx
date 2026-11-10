"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Button,
  EmptyState,
  formatVnd,
  Inbox,
  OrderRail,
  orderRailCurrent,
  orderRailSteps,
  PageHeader,
  Package,
  Panel,
  RefreshCw,
  sellerOrderStatuses,
  shipmentStatuses,
  Skeleton,
  StatusBadge,
  Tabs,
  Truck,
  useApi,
  usePolling,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { SellerPart } from "../../../../lib/types";

const statusFilters = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ xác nhận" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "PACKING", label: "Đang đóng gói" },
  { key: "SHIPPING", label: "Đang giao" },
  { key: "DELIVERED", label: "Đã giao" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "CANCELLED", label: "Đã hủy" },
];

function nextEvents(status: string): string[] {
  if (status === "WAITING_PICKUP") return ["PICKED_UP"];
  if (status === "PICKED_UP") return ["IN_TRANSIT"];
  if (status === "IN_TRANSIT") return ["DELIVERED", "FAILED"];
  return [];
}

export default function SellerOrdersPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api } = useApi();
  const [rows, setRows] = useState<SellerPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [reason, setReason] = useState("");

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const query = status === "ALL" ? "" : `?status=${status}`;
        setRows(await api.request<SellerPart[]>(`/shops/${shopId}/orders${query}` as ApiPath));
      } catch (cause) {
        if (!silent) setError(normalizeFormError(cause));
        throw cause;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, shopId, status],
  );

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  usePolling(refresh, { intervalMs: 30_000, pauseWhile: busy });

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
    <div className="mp-page mp-seller-page">
      <PageHeader
        title="Xử lý đơn hàng"
        description="Xác nhận, đóng gói và cập nhật vận chuyển cho từng phần đơn của cửa hàng."
        actions={
          <Button variant="secondary" onClick={() => void refresh()} leadingIcon={<RefreshCw size={16} />}>
            Làm mới
          </Button>
        }
      />

      <Tabs
        items={statusFilters}
        value={status}
        onChange={(key) => setStatus(key)}
        label="Lọc trạng thái đơn"
      />

      <Panel
        title="Lý do thao tác"
        description="Bắt buộc khi từ chối đơn, giao thất bại hoặc giao lại."
      >
        <label className="mp-field">
          <span className="mp-field__label">Lý do cho từ chối/giao thất bại/giao lại</span>
          <input
            className="mp-field__input"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ví dụ: Người nhận không nghe máy"
          />
        </label>
      </Panel>

      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mp-stack" role="status">
          <span className="mp-visually-hidden">Đang tải đơn hàng…</span>
          <Skeleton className="mp-skeleton--block" />
          <Skeleton className="mp-skeleton--block" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Inbox size={22} />}
          title="Chưa có đơn hàng phù hợp."
          description="Đơn mới sẽ xuất hiện ở đây ngay khi người mua đặt hàng."
        />
      ) : (
        <div className="mp-stack">
          {rows.map((part) => (
            <Panel
              key={part.id}
              className="mp-reveal"
              title={`Đơn ${part.id}`}
              description={`Tổng ${formatVnd(part.originalTotal)} · Còn phải thu ${formatVnd(
                part.outstandingAmount,
              )}`}
              actions={<StatusBadge status={part.status} map={sellerOrderStatuses} />}
            >
              <OrderRail
                label={`Tiến trình đơn ${part.id}`}
                steps={orderRailSteps(part.status)}
                currentId={orderRailCurrent(part.status)}
              />
              <div className="mp-order-part">
                <ul className="mp-order-part__items">
                  {part.items.map((item) => (
                    <li key={item.id}>
                      <span>{item.productName}</span>
                      <span className="mp-muted">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>

                {part.shipment ? (
                  <div className="mp-order-part__shipment">
                    <Truck size={16} aria-hidden="true" />
                    <span>
                      {part.shipment.trackingCode} · Lần {part.shipment.attemptNumber}
                    </span>
                    <StatusBadge status={part.shipment.status} map={shipmentStatuses} />
                  </div>
                ) : (
                  <p className="mp-muted mp-inline">
                    <Package size={14} aria-hidden="true" /> Chưa tạo vận đơn cho phần đơn này.
                  </p>
                )}

                <div className="mp-order-part__actions">
                  {part.status === "PENDING" ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(`/shops/${shopId}/orders/${part.id}/confirm`, {
                          expectedVersion: part.version,
                        })
                      }
                    >
                      Xác nhận đơn
                    </Button>
                  ) : null}
                  {part.status === "CONFIRMED" ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(`/shops/${shopId}/orders/${part.id}/pack`, {
                          expectedVersion: part.version,
                        })
                      }
                    >
                      Đã đóng gói
                    </Button>
                  ) : null}
                  {["PENDING", "CONFIRMED"].includes(part.status) ? (
                    <Button
                      variant="danger"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void action(`/shops/${shopId}/orders/${part.id}/reject`, {
                          reason,
                          expectedVersion: part.version,
                        })
                      }
                    >
                      Từ chối đơn
                    </Button>
                  ) : null}
                  {part.status === "DELIVERED" && part.outstandingAmount !== "0" ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(`/payments/seller-orders/${part.id}/cod-collection`, {
                          eventId: crypto.randomUUID(),
                          expectedVersion: part.version,
                        })
                      }
                    >
                      Ghi nhận đã thu COD
                    </Button>
                  ) : null}
                  {part.shipment
                    ? nextEvents(part.shipment.status).map((event) => (
                        <Button
                          key={event}
                          variant="secondary"
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
                        </Button>
                      ))
                    : null}
                  {part.shipment?.status === "FAILED" ? (
                    <Button
                      variant="secondary"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        void action(`/shipments/${part.shipment!.id}/retry`, {
                          expectedVersion: part.shipment!.version,
                          reason,
                        })
                      }
                    >
                      Giao lại
                    </Button>
                  ) : null}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
