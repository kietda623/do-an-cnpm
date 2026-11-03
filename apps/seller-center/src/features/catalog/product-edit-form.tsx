"use client";

import { useState, type FormEvent } from "react";
import { Button, TextareaField, TextField, useApi } from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { CatalogProduct } from "../../lib/types";
import { uploadAsset } from "../shop/shop-register-form";

export function ProductEditForm({
  shopId,
  product,
  onSaved,
  onCancel,
}: {
  shopId: string;
  product: CatalogProduct;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const imageFiles = form
        .getAll("images")
        .filter((value): value is File => value instanceof File && value.size > 0);
      const uploadedImages = await Promise.all(
        imageFiles.map((file) => uploadAsset(api, file, "PRODUCT_IMAGE", shopId)),
      );
      await api.request(`/shops/${shopId}/products/${product.id}` as ApiPath, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description"),
          ...(uploadedImages.length
            ? {
                imageAssetIds: [
                  ...product.images.map((image) => image.assetId),
                  ...uploadedImages.map((image) => image.id),
                ],
              }
            : {}),
          expectedVersion: product.version,
        }),
      });
      await onSaved();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Sản phẩm đã đổi. Đã tải lại; hãy mở sửa lại.");
        await onSaved();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mp-form mp-inline-form" onSubmit={submit} aria-label={`Sửa ${product.name}`}>
      <div className="mp-form-grid">
        <TextField label="Tên" name="name" defaultValue={product.name} required maxLength={200} />
        <label className="mp-file-field">
          <span className="mp-field__label">Thêm ảnh vào thư viện</span>
          <input
            className="mp-field__input mp-field__input--file"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
          />
        </label>
      </div>
      <TextareaField label="Mô tả" name="description" defaultValue={product.description} rows={3} />
      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}
      <div className="mp-form-actions">
        <Button type="submit" loading={busy}>
          Lưu thay đổi
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
