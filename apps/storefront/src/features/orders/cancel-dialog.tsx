"use client";

import { useState } from "react";
import { Button, Dialog, StatusMessage, TextareaField } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";
import type { ApiPath } from "@marketplace/api-client";
import { webSession } from "../../lib/session";

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
    <section className="mp-cancel">
      <header>
        <h2>Hủy đơn</h2>
        <p>Chỉ các phần đang chờ cửa hàng xác nhận mới có thể hủy.</p>
      </header>
      <div className="mp-cancel__actions">
        {eligible.length === parts.filter((part) => part.status !== "CANCELLED").length && (
          <Button variant="secondary" onClick={() => setTarget("ALL")}>
            Hủy toàn đơn
          </Button>
        )}
        {eligible.map((part) => (
          <Button
            key={part.id}
            variant="secondary"
            onClick={() => {
              setError("");
              setTarget(part);
            }}
          >
            Hủy riêng {part.shopNameSnapshot}
          </Button>
        ))}
      </div>

      <Dialog
        open={target !== null}
        onClose={() => {
          if (busy) return;
          setTarget(null);
          setError("");
        }}
        title={`Xác nhận hủy ${target === "ALL" ? "toàn bộ đơn" : (target?.shopNameSnapshot ?? "")}`}
        description="Hệ thống sẽ kiểm tra trạng thái mới nhất, hoàn kho và ghi nhận hoàn tiền nếu đã thu."
        footer={
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setTarget(null);
                setError("");
              }}
            >
              Đóng
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={!reason.trim()}
              onClick={() => void submit()}
            >
              Xác nhận hủy
            </Button>
          </>
        }
      >
        <TextareaField
          label="Lý do"
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {error && (
          <StatusMessage tone="error" onDismiss={() => setError("")}>
            {error}
          </StatusMessage>
        )}
      </Dialog>
    </section>
  );
}
