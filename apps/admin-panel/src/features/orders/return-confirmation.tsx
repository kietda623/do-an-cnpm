"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Panel,
  StatusMessage,
  TextField,
  TextareaField,
  shipmentStatuses,
  StatusBadge,
  useApi,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";

type Result = {
  affectedResourceIds: string[];
  resultingOrder: {
    status: string;
    sellerOrders: Array<{
      id: string;
      status: string;
      shipment: { id: string; status: string } | null;
    }>;
  };
  replay: boolean;
};

type Shipment = {
  id: string;
  status: string;
  version: number;
  trackingCode: string;
  history: Array<{ id: string; toStatus: string; reason?: string }>;
};

export function ReturnConfirmation() {
  const { api } = useApi();
  const [shipmentId, setShipmentId] = useState("");
  const [expectedVersion, setExpectedVersion] = useState("");
  const [reason, setReason] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function lookup() {
    if (!shipmentId.trim()) return;
    setLoading(true);
    setLookupError("");
    try {
      const found = await api.request<Shipment>(
        `/shipments/${shipmentId.trim()}` as ApiPath,
      );
      setShipment(found);
      setExpectedVersion(String(found.version));
    } catch (cause) {
      setShipment(null);
      setLookupError(normalizeFormError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.request<Result>(
        `/admin/shipments/${shipmentId.trim()}/return-confirmation` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ reason: reason.trim(), expectedVersion: Number(expectedVersion) }),
        },
      );
      const part = result.resultingOrder.sellerOrders.find(
        (sellerOrder) => sellerOrder.id === result.affectedResourceIds[0],
      );
      setNotice(
        `Đã xác nhận kiện hàng trả về. Trạng thái: ${part?.status ?? result.resultingOrder.status}; mã phần đơn: ${result.affectedResourceIds.join(", ")}.`,
      );
      setShipment(null);
      setReason("");
      setExpectedVersion("");
    } catch (cause) {
      setError(
        cause instanceof ApiClientError && cause.status === 409
          ? "Trạng thái kiện hàng đã thay đổi hoặc không đủ điều kiện trả về. Tải lại thông tin trước khi thử lại."
          : normalizeFormError(cause),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mp-stack mp-stack--loose">
      <Panel
        title="Xác nhận hàng hoàn về"
        description="Chỉ xác nhận kiện FAILED đã thực sự quay về kho. Tồn kho và hoàn mô phỏng được cập nhật một lần."
      >
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Mã shipment"
              name="shipmentId"
              value={shipmentId}
              onChange={(event) => setShipmentId(event.target.value)}
              required
              hint="UUID kiện hàng cần xác nhận."
            />
            <TextField
              label="Phiên bản shipment"
              name="expectedVersion"
              type="number"
              min={0}
              step={1}
              value={expectedVersion}
              onChange={(event) => setExpectedVersion(event.target.value)}
              required
              hint="Nhập tay hoặc tra cứu để điền tự động."
            />
            <TextareaField
              label="Lý do"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={1}
              maxLength={500}
              rows={2}
            />
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={busy}>
              Xác nhận trả về
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={loading}
              disabled={!shipmentId.trim()}
              onClick={() => void lookup()}
            >
              Tra cứu kiện hàng
            </Button>
          </div>
        </form>

        {lookupError ? (
          <p role="alert" className="mp-alert-inline">
            {lookupError}
          </p>
        ) : null}

        {shipment ? (
          <section className="mp-panel__pad mp-stack" aria-label="Thông tin kiện hàng">
            <p className="mp-inline">
              <StatusBadge status={shipment.status} map={shipmentStatuses} />
              <span className="mp-muted">{shipment.trackingCode}</span>
              <span className="mp-code">{shipment.id}</span>
            </p>
            <ul className="mp-stack">
              {shipment.history.map((entry) => (
                <li key={entry.id} className="mp-muted">
                  {entry.toStatus} {entry.reason ?? ""}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {error ? (
          <StatusMessage tone="error" title="Không xác nhận được">
            <p>{error}</p>
          </StatusMessage>
        ) : null}
        {notice ? (
          <StatusMessage tone="success" title="Đã xác nhận kiện hàng trả về">
            <p>{notice}</p>
          </StatusMessage>
        ) : null}
      </Panel>
    </div>
  );
}
