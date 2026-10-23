"use client";

import { useState } from "react";
import { normalizeFormError } from "@marketplace/api-client";
import type { ApiPath } from "@marketplace/api-client";
import { webSession } from "../../app/auth-form";

type Part = { id: string; shopNameSnapshot: string; status: string; version: number };
export function CancelDialog({
  orderId,
  orderVersion,
  parts,
  status,
  onDone,
}: {
  orderId: string;
  orderVersion: number;
  parts: Part[];
  status: string;
  onDone: () => Promise<void>;
}) {
  const [target, setTarget] = useState<Part | "ALL" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = parts.filter((part) => part.status === "PENDING");
  async function submit() {
    if (!target || !reason.trim()) return;
    setBusy(true);
    setError("");
    const route =
      target === "ALL"
        ? `/orders/${orderId}/cancel`
        : `/orders/${orderId}/seller-orders/${target.id}/cancel`;
    const expectedVersion = target === "ALL" ? orderVersion : target.version;
    const intentKey = `marketplace.cancel.${orderId}.${target === "ALL" ? "all" : target.id}`;
    const payload = JSON.stringify({ reason: reason.trim(), expectedVersion });
    try {
      const previous = sessionStorage.getItem(intentKey);
      const intent = previous ? (JSON.parse(previous) as { key: string; payload: string }) : null;
      const key = intent?.payload === payload ? intent.key : crypto.randomUUID();
      sessionStorage.setItem(intentKey, JSON.stringify({ key, payload }));
      await webSession.api.request(route as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: payload,
      });
      sessionStorage.removeItem(intentKey);
      setTarget(null);
      setReason("");
      await onDone();
    } catch (cause) {
      const payload =
        cause && typeof cause === "object" && "payload" in cause ? cause.payload : undefined;
      const envelope =
        payload && typeof payload === "object" && "error" in payload ? payload.error : undefined;
      const details =
        envelope &&
        typeof envelope === "object" &&
        "details" in envelope &&
        Array.isArray(envelope.details)
          ? envelope.details
          : [];
      const blockedIds = details
        .filter(
          (item): item is { field: string; message: string } =>
            !!item &&
            typeof item === "object" &&
            "field" in item &&
            item.field === "blockingSellerOrderIds" &&
            "message" in item &&
            typeof item.message === "string",
        )
        .map((item) => item.message);
      const names = blockedIds.map(
        (id) => parts.find((part) => part.id === id)?.shopNameSnapshot ?? id,
      );
      setError(
        `${normalizeFormError(cause)}${names.length ? ` Cửa hàng đang xử lý: ${names.join(", ")}.` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  if (status === "CANCELLED" || !eligible.length) return null;
  return (
    <section className="space-y-3 rounded-xl border p-5">
      <h2 className="font-semibold">Hủy đơn</h2>
      <div className="flex flex-wrap gap-2">
        {eligible.length === parts.filter((part) => part.status !== "CANCELLED").length && (
          <button className="rounded-lg border px-4 py-2" onClick={() => setTarget("ALL")}>
            Hủy toàn đơn
          </button>
        )}
        {eligible.map((part) => (
          <button
            key={part.id}
            className="rounded-lg border px-4 py-2"
            onClick={() => setTarget(part)}
          >
            Hủy riêng {part.shopNameSnapshot}
          </button>
        ))}
      </div>
      {target && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận hủy đơn"
          className="space-y-3 rounded-lg bg-neutral-50 p-4"
        >
          <h3 className="font-semibold">
            Xác nhận hủy {target === "ALL" ? "toàn bộ đơn" : target.shopNameSnapshot}
          </h3>
          <p>
            Hệ thống sẽ kiểm tra trạng thái mới nhất, hoàn kho và ghi nhận hoàn tiền nếu đã thu.
          </p>
          <label className="grid gap-1">
            Lý do
            <textarea
              className="min-h-20 rounded border p-2"
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || !reason.trim()}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
              onClick={() => void submit()}
            >
              {busy ? "Đang xử lý…" : "Xác nhận hủy"}
            </button>
            <button
              disabled={busy}
              className="rounded-lg border px-4 py-2"
              onClick={() => setTarget(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
