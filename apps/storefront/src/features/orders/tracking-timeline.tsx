"use client";

import {
  StatusBadge,
  Truck,
  formatDateTime,
  shipmentStatuses,
  statusLabel,
} from "@marketplace/ui-web";

export type Tracking = {
  id: string;
  status: string;
  trackingCode: string;
  attemptNumber: number;
  version: number;
  history: Array<{
    id?: string;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};

export function TrackingTimeline({ shipment }: { shipment: Tracking | null }) {
  if (!shipment)
    return (
      <p className="mp-tracking mp-tracking--empty">
        <Truck size={16} aria-hidden="true" />
        Chưa đóng gói để giao.
      </p>
    );

  return (
    <section className="mp-tracking" aria-label="Vận chuyển">
      <header className="mp-tracking__head">
        <div>
          <h3>
            <Truck size={16} aria-hidden="true" />
            Vận chuyển {shipment.trackingCode}
          </h3>
          <p>Lần giao {shipment.attemptNumber}</p>
        </div>
        <StatusBadge status={shipment.status} map={shipmentStatuses} />
      </header>
      {shipment.status === "FAILED" && (
        <p role="status" className="mp-tracking__notice">
          Giao hàng chưa thành công. Cửa hàng sẽ xử lý giao lại hoặc xác nhận hàng hoàn.
        </p>
      )}
      <ol className="mp-tracking__timeline">
        {shipment.history.map((event, index) => (
          <li key={event.id ?? `${event.toStatus}-${event.createdAt}-${index}`}>
            <span className="mp-tracking__dot" aria-hidden="true" />
            <div>
              <p>
                {statusLabel(shipmentStatuses, event.toStatus)}
                {event.reason ? ` · ${event.reason}` : ""}
              </p>
              <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
