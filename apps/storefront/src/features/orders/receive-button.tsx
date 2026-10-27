"use client";
import { useState } from "react";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../../app/auth-form";

export function ReceiveButton({
  orderId,
  sellerOrderId,
  version,
  onDone,
}: {
  orderId: string;
  sellerOrderId: string;
  version: number;
  onDone: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function receive() {
    setBusy(true);
    setError("");
    const storage = `receive:${sellerOrderId}:${version}`;
    let key = sessionStorage.getItem(storage);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storage, key);
    }
    try {
      await webSession.api.request(
        `/orders/${orderId}/seller-orders/${sellerOrderId}/receive` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": key },
          body: JSON.stringify({ expectedVersion: version }),
        },
      );
      sessionStorage.removeItem(storage);
      await onDone();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3">
      <button
        disabled={busy}
        onClick={() => void receive()}
        className="rounded border px-4 py-2 disabled:opacity-50"
      >
        {busy ? "Đang xác nhận…" : "Tôi đã nhận đủ hàng"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
