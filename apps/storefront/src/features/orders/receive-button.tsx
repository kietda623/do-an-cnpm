"use client";
import { useState } from "react";
import { Button, StatusMessage } from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../../lib/session";

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
    <div className="mp-receive">
      <Button loading={busy} onClick={() => void receive()}>
        Xác nhận đã nhận hàng
      </Button>
      <p className="mp-receive__hint">
        Chỉ xác nhận khi đã nhận đủ hàng và thanh toán xong phần của cửa hàng này.
      </p>
      {error && (
        <StatusMessage tone="error" onDismiss={() => setError("")}>
          {error}
        </StatusMessage>
      )}
    </div>
  );
}
