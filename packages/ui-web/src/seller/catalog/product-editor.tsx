"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";
export type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  selling: boolean;
  version: number;
  images: Array<{ assetId: string; objectKey?: string }>;
  variants: Array<{
    id: string;
    sku: string;
    attributes: Record<string, string>;
    price: string;
    selling: boolean;
    version: number;
    availableQuantity: number;
    inventoryVersion: number;
  }>;
};
const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;
const request = <T,>(path: string, init?: RequestInit) => api.request<T>(path as ApiPath, init);
export function InventoryEditor({
  shopId,
  product,
  onChanged,
}: {
  shopId: string;
  product: CatalogProduct;
  onChanged: () => Promise<void>;
}) {
  const [delta, setDelta] = useState("1"),
    [reason, setReason] = useState("Kiểm kê kho"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(variant: CatalogProduct["variants"][number]) {
    setBusy(true);
    setError("");
    try {
      await request(`/shops/${shopId}/variants/${variant.id}/inventory-adjustments`, {
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
    <section
      aria-label={`Điều chỉnh kho ${product.name}`}
      className="grid gap-2 rounded border p-3"
    >
      <h3 className="font-semibold">Điều chỉnh tồn kho</h3>
      <label>
        Số lượng thay đổi
        <input
          aria-label="Số lượng thay đổi"
          type="number"
          step="1"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
        />
      </label>
      <label>
        Lý do
        <input aria-label="Lý do" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {product.variants.map((v) => (
        <div key={v.id} className="flex items-center gap-3">
          <span>
            {v.sku}: {v.availableQuantity}
          </span>
          <button disabled={busy || !Number(delta)} onClick={() => void submit(v)}>
            Cập nhật kho
          </button>
        </div>
      ))}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
export function ProductEditor({
  shopId,
  onCreated,
}: {
  shopId: string;
  onCreated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    void request<Array<{ id: string; name: string }>>("/categories")
      .then(setCategories)
      .catch((e) => setError(normalizeFormError(e)));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const targetForm = event.currentTarget;
    const form = new FormData(targetForm);
    try {
      const file = form.get("image");
      if (!(file instanceof File) || !file.size) throw new Error("Chọn ảnh sản phẩm trước nhé.");
      const upload = new FormData();
      upload.set("file", file);
      upload.set("purpose", "PRODUCT_IMAGE");
      upload.set("shopId", shopId);
      const image = await request<{ id: string }>("/users/me/assets", {
        method: "POST",
        body: upload,
      });
      const variants = JSON.parse(String(form.get("variants"))) as CatalogProduct["variants"];
      await request(`/shops/${shopId}/products`, {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          categoryId: String(form.get("categoryId")),
          imageAssetIds: [image.id],
          selling: true,
          variants: variants.map((v) => ({
            sku: v.sku,
            attributes: v.attributes,
            price: v.price,
            stock: Number(v.availableQuantity ?? 0),
            selling: v.selling,
          })),
        }),
      });
      targetForm.reset();
      setName("");
      setDescription("");
      await onCreated();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded border p-4" aria-label="Tạo sản phẩm">
      <h2 className="text-lg font-semibold">Thêm sản phẩm</h2>
      <label>
        Tên
        <input
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label>
        Mô tả
        <textarea
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </label>
      <label>
        Danh mục
        <select name="categoryId" required defaultValue="">
          <option value="" disabled>
            Chọn danh mục
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Ảnh sản phẩm
        <input name="image" type="file" accept="image/jpeg,image/png,image/webp" required />
      </label>
      <label>
        Biến thể (JSON)
        <textarea
          name="variants"
          defaultValue={
            '[{"sku":"SKU-S","attributes":{"size":"S"},"price":"150000","availableQuantity":1,"selling":true},{"sku":"SKU-M","attributes":{"size":"M"},"price":"160000","availableQuantity":5,"selling":true}]'
          }
          required
        />
      </label>
      <button disabled={busy}>{busy ? "Đang lưu…" : "Tạo và đăng bán"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
