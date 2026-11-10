"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  SelectField,
  TextareaField,
  TextField,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { Category } from "../../lib/types";
import { uploadAsset } from "../shop/shop-register-form";
import { emptyVariant, variantsPayload } from "./variant-draft";
import { VariantEditor } from "./variant-editor";

export function ProductCreateForm({
  shopId,
  onCreated,
}: {
  shopId: string;
  onCreated: () => Promise<void>;
}) {
  const { api } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [variantDrafts, setVariantDrafts] = useState(() => [
    emptyVariant("variant-1"),
  ]);

  useEffect(() => {
    let live = true;
    void api
      .request<Category[]>("/categories" as ApiPath)
      .then((rows) => {
        if (live) setCategories(rows);
      })
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const targetForm = event.currentTarget;
    const form = new FormData(targetForm);
    try {
      const variants = variantsPayload(variantDrafts);
      const file = form.get("image");
      if (!(file instanceof File) || !file.size)
        throw new Error("Chọn ảnh sản phẩm trước nhé.");
      const image = await uploadAsset(api, file, "PRODUCT_IMAGE", shopId);
      await api.request(`/shops/${shopId}/products` as ApiPath, {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          categoryId: String(form.get("categoryId")),
          imageAssetIds: [image.id],
          selling: true,
          variants,
        }),
      });
      targetForm.reset();
      setName("");
      setDescription("");
      setVariantDrafts([emptyVariant("variant-1")]);
      await onCreated();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mp-form" onSubmit={submit} aria-label="Tạo sản phẩm">
      <div className="mp-form-grid">
        <TextField
          label="Tên"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={200}
          disabled={busy}
        />
        <SelectField
          label="Danh mục"
          name="categoryId"
          required
          defaultValue=""
          disabled={busy}
        >
          <option value="" disabled>
            Chọn danh mục
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextareaField
        label="Mô tả"
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        required
        rows={3}
        disabled={busy}
      />
      <label className="mp-file-field">
        <span className="mp-field__label">Ảnh sản phẩm</span>
        <input
          className="mp-field__input mp-field__input--file"
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          disabled={busy}
        />
      </label>
      <VariantEditor
        variants={variantDrafts}
        onChange={setVariantDrafts}
        disabled={busy}
      />
      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}
      <div className="mp-form-actions">
        <Button type="submit" loading={busy}>
          Tạo và đăng bán
        </Button>
      </div>
    </form>
  );
}
