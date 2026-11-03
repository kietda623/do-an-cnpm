"use client";

import { useState, type FormEvent } from "react";
import {
  Button,
  Panel,
  TextareaField,
  TextField,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { Shop } from "../../lib/types";
import { uploadAsset } from "./shop-register-form";

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function ShopProfileForm({
  shop,
  onSaved,
}: {
  shop: Shop;
  onSaved: () => Promise<void>;
}) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const logoFile = form.get("logo");
      const bannerFile = form.get("banner");
      const logo = logoFile instanceof File && logoFile.size ? uploadAsset(api, logoFile, "SHOP_LOGO") : null;
      const banner =
        bannerFile instanceof File && bannerFile.size ? uploadAsset(api, bannerFile, "SHOP_BANNER") : null;
      const [logoAsset, bannerAsset] = await Promise.all([logo, banner]);
      await api.request(`/shops/${shop.id}` as ApiPath, {
        method: "PATCH",
        body: JSON.stringify({
          name: text(form, "name"),
          slug: text(form, "slug").toLowerCase(),
          description: text(form, "description"),
          contactAddress: text(form, "contactAddress"),
          phone: text(form, "phone"),
          expectedVersion: shop.version,
          ...(logoAsset ? { logoAssetId: logoAsset.id } : {}),
          ...(bannerAsset ? { bannerAssetId: bannerAsset.id } : {}),
        }),
      });
      await onSaved();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="Thông tin cửa hàng"
      description={
        shop.approvedAt
          ? "Đường dẫn đã khóa sau khi cửa hàng được duyệt."
          : "Bạn có thể chỉnh sửa hồ sơ cho đến khi được duyệt."
      }
    >
      <form className="mp-form" onSubmit={save} aria-label="Thông tin cửa hàng">
        <div className="mp-form-grid">
          <TextField label="Tên cửa hàng" name="name" required maxLength={150} defaultValue={shop.name} />
          <TextField
            label="Đường dẫn"
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            readOnly={Boolean(shop.approvedAt)}
            defaultValue={shop.slug}
          />
        </div>
        <TextareaField
          label="Mô tả"
          name="description"
          required
          maxLength={5000}
          rows={4}
          defaultValue={shop.description}
        />
        <div className="mp-form-grid">
          <TextField
            label="Địa chỉ liên hệ"
            name="contactAddress"
            required
            maxLength={500}
            defaultValue={shop.contactAddress}
          />
          <TextField
            label="Số điện thoại"
            name="phone"
            required
            minLength={8}
            maxLength={20}
            inputMode="tel"
            defaultValue={shop.phone}
          />
        </div>
        <div className="mp-form-grid">
          <label className="mp-file-field">
            <span className="mp-field__label">Đổi logo</span>
            <input
              className="mp-field__input mp-field__input--file"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
          <label className="mp-file-field">
            <span className="mp-field__label">Đổi ảnh bìa</span>
            <input
              className="mp-field__input mp-field__input--file"
              name="banner"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </label>
        </div>
        {error ? (
          <p role="alert" className="mp-alert-inline">
            {error}
          </p>
        ) : null}
        <div className="mp-form-actions">
          <Button type="submit" loading={busy}>
            Lưu thông tin
          </Button>
        </div>
      </form>
    </Panel>
  );
}
