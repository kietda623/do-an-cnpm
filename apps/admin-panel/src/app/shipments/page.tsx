"use client";
import { useState } from "react";
import {
  WebSession,
  normalizeFormError,
  type ApiPath,
} from "@marketplace/api-client";
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
type Shipment = {
  id: string;
  status: string;
  version: number;
  trackingCode: string;
  history: Array<{ id: string; toStatus: string; reason?: string }>;
};
export default function ReturnConfirmationPage() {
  const [id, setId] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setError("");
    try {
      setShipment(await api.request<Shipment>(`/shipments/${id}` as ApiPath));
    } catch (cause) {
      setError(normalizeFormError(cause));
    }
  }
  async function confirm() {
    if (!shipment) return;
    setBusy(true);
    setError("");
    const storage = `return:${shipment.id}:${shipment.version}:${reason}`;
    let key = sessionStorage.getItem(storage);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storage, key);
    }
    try {
      await api.request(
        `/admin/shipments/${shipment.id}/return-confirmation` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ reason, expectedVersion: shipment.version }),
        },
      );
      sessionStorage.removeItem(storage);
      await load();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-bold">Xác nhận hàng hoàn</h1>
      <label>
        Mã shipment{" "}
        <input
          className="rounded border p-2"
          value={id}
          onChange={(e) => setId(e.target.value)}
        />
      </label>
      <button onClick={() => void load()}>Tra cứu</button>
      {error && <p role="alert">{error}</p>}
      {shipment && (
        <section className="space-y-3 rounded border p-4">
          <p>
            {shipment.trackingCode} · {shipment.status}
          </p>
          <ul>
            {shipment.history.map((e) => (
              <li key={e.id}>
                {e.toStatus} {e.reason}
              </li>
            ))}
          </ul>
          <p>Chỉ xác nhận sau khi đã kiểm tra hàng thực tế hoàn về.</p>
          <label>
            Lý do{" "}
            <textarea
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button
            disabled={busy || shipment.status !== "FAILED" || !reason.trim()}
            onClick={() => void confirm()}
          >
            Xác nhận hàng đã hoàn về và hủy đơn
          </button>
        </section>
      )}
    </main>
  );
}
