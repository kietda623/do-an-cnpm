"use client";

import { useState, type FormEvent } from "react";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;

type Result = {
  shipment: { id: string; status: string; version: number };
  affectedResourceIds: string[];
};

export function ReturnConfirmation() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const shipmentId = String(form.get("shipmentId") ?? "").trim();
    const reason = String(form.get("reason") ?? "").trim();
    const expectedVersion = Number(form.get("expectedVersion"));
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.request<Result>(
        `/admin/shipments/${shipmentId}/return-confirmation` as ApiPath,
        {
          method: "POST",
          headers: { "Idempotency-Key": crypto.randomUUID() },
          body: JSON.stringify({ reason, expectedVersion }),
        },
      );
      setNotice(
        `Đã xác nhận kiện hàng trả về. Trạng thái: ${result.shipment.status}; mã phần đơn: ${result.affectedResourceIds.join(", ")}.`,
      );
      formElement.reset();
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
    <section className="max-w-2xl space-y-4 rounded-xl border p-5">
      <h2 className="text-xl font-semibold">Xác nhận hàng hoàn về</h2>
      <p>
        Chỉ xác nhận kiện FAILED đã thực sự quay về kho. Tồn kho và hoàn mô
        phỏng được cập nhật một lần.
      </p>
      <form className="grid gap-3" onSubmit={submit}>
        <label className="grid gap-1">
          Mã shipment
          <input
            name="shipmentId"
            required
            type="text"
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Phiên bản shipment
          <input
            name="expectedVersion"
            required
            type="number"
            min="0"
            step="1"
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Lý do
          <input
            name="reason"
            required
            minLength={1}
            maxLength={500}
            className="rounded border p-2"
          />
        </label>
        <button
          disabled={busy}
          className="w-fit rounded bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Xác nhận trả về
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
