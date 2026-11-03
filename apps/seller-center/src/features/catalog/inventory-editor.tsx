"use client";

import { useState } from "react";
import { Button, PackageSearch, useApi } from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { CatalogProduct } from "../../lib/types";

export function InventoryEditor({
  shopId,
  product,
  onChanged,
}: {
  shopId: string;
  product: CatalogProduct;
  onChanged: () => Promise<void>;
}) {
  const { api } = useApi();
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("Kiểm kê kho");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(variant: CatalogProduct["variants"][number]) {
    setBusy(true);
    setError("");
    try {
      await api.request(`/shops/${shopId}/variants/${variant.id}/inventory-adjustments` as ApiPath, {
        method: "POST",
        body: JSON.stringify({
          delta: Number(delta),
          reason,
          expectedVersion: variant.inventoryVersion,
        }),
      });
      await onChanged();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Tồn kho đã đổi. Danh sách đang tải lại; kiểm tra số mới rồi thử lại.");
        await onChanged();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mp-inventory" aria-label={`Điều chỉnh kho ${product.name}`}>
      <header className="mp-inventory__head">
        <PackageSearch size={16} aria-hidden="true" />
        <h3>Điều chỉnh tồn kho</h3>
      </header>
      <div className="mp-inventory__fields">
        <label className="mp-field">
          <span className="mp-field__label">Số lượng thay đổi</span>
          <input
            className="mp-field__input"
            aria-label="Số lượng thay đổi"
            type="number"
            step="1"
            value={delta}
            onChange={(event) => setDelta(event.target.value)}
          />
        </label>
        <label className="mp-field">
          <span className="mp-field__label">Lý do</span>
          <input
            className="mp-field__input"
            aria-label="Lý do"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      </div>
      <ul className="mp-inventory__variants">
        {product.variants.map((variant) => (
          <li key={variant.id}>
            <span>
              {variant.sku}: {variant.availableQuantity}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !Number(delta)}
              onClick={() => void submit(variant)}
            >
              Cập nhật kho
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}
    </section>
  );
}
