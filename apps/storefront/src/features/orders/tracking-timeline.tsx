"use client";

export type Tracking = {
  id: string;
  status: string;
  trackingCode: string;
  attemptNumber: number;
  version: number;
  history: Array<{
    id: string;
    toStatus: string;
    reason: string | null;
    createdAt: string;
  }>;
};
export function TrackingTimeline({ shipment }: { shipment: Tracking | null }) {
  if (!shipment)
    return <p className="text-sm text-neutral-600">Chưa đóng gói để giao.</p>;
  return (
    <section className="mt-4 rounded border p-3">
      <h3 className="font-semibold">Vận chuyển {shipment.trackingCode}</h3>
      <p>
        {shipment.status} · Lần giao {shipment.attemptNumber}
      </p>
      {shipment.status === "FAILED" && (
        <p role="status">
          Giao hàng chưa thành công. Cửa hàng sẽ xử lý giao lại hoặc xác nhận
          hàng hoàn.
        </p>
      )}
      <ol className="mt-2 space-y-1">
        {shipment.history.map((event) => (
          <li key={event.id}>
            {new Date(event.createdAt).toLocaleString("vi-VN")} ·{" "}
            {event.toStatus}
            {event.reason ? ` · ${event.reason}` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}
