"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Panel,
  TextareaField,
  TextField,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath, type ApiTransport } from "@marketplace/api-client";
import type { Asset } from "../../lib/types";

export async function uploadAsset(
  api: ApiTransport,
  file: File,
  purpose: "SHOP_LOGO" | "SHOP_BANNER" | "PRODUCT_IMAGE",
  shopId?: string,
): Promise<Asset> {
  const upload = new FormData();
  upload.set("file", file);
  upload.set("purpose", purpose);
  if (shopId) upload.set("shopId", shopId);
  return api.request<Asset>("/users/me/assets" as ApiPath, { method: "POST", body: upload });
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function ShopRegisterForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const file = form.get("logo");
      if (!(file instanceof File) || !file.size) throw new Error("Anh chọn ảnh logo trước nhé.");
      const logo = await uploadAsset(api, file, "SHOP_LOGO");
      await api.request("/shops" as ApiPath, {
        method: "POST",
        body: JSON.stringify({
          name: text(form, "name"),
          slug: text(form, "slug").toLowerCase(),
          description: text(form, "description"),
          logoAssetId: logo.id,
          contactAddress: text(form, "contactAddress"),
          phone: text(form, "phone"),
        }),
      });
      await onCreated();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Gửi hồ sơ người bán"
      description="Tài khoản mua hàng cũng có thể đăng ký mở cửa hàng. Hồ sơ được duyệt trước khi gian hàng hiển thị."
    >
      <form className="mp-form" onSubmit={submit} aria-label="Hồ sơ đăng ký cửa hàng">
        <div className="mp-form-grid">
          <TextField label="Tên cửa hàng" name="name" required maxLength={150} />
          <TextField
            label="Đường dẫn"
            name="slug"
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            hint="Chỉ gồm chữ thường, số và dấu gạch nối."
          />
        </div>
        <TextareaField label="Mô tả" name="description" required maxLength={5000} rows={4} />
        <div className="mp-form-grid">
          <TextField label="Địa chỉ liên hệ" name="contactAddress" required maxLength={500} />
          <TextField
            label="Số điện thoại"
            name="phone"
            required
            minLength={8}
            maxLength={20}
            inputMode="tel"
          />
        </div>
        <label className="mp-file-field">
          <span className="mp-field__label">Logo cửa hàng (JPEG, PNG hoặc WebP)</span>
          <input
            className="mp-field__input mp-field__input--file"
            name="logo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </label>
        {error ? (
          <p role="alert" className="mp-alert-inline">
            {error}
          </p>
        ) : null}
        <div className="mp-form-actions">
          <Button type="submit" size="lg" loading={busy}>
            Gửi hồ sơ đăng ký
          </Button>
        </div>
      </form>
    </Panel>
  );
}
