"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";
import {
  InventoryEditor,
  ProductEditor,
  type CatalogProduct,
} from "@marketplace/ui-web/seller/catalog/product-editor";

const api = new WebSession(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").api;
const request = <T,>(path: string, init?: RequestInit) => api.request<T>(path as ApiPath, init);

export default function ProductsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useSession();
  const [rows, setRows] = useState<CatalogProduct[]>([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState("");
  const [editingVariant, setEditingVariant] = useState("");
  const refresh = useCallback(async () => {
    try {
      setRows(await request<CatalogProduct[]>(`/shops/${shopId}/management/products`));
      setError("");
    } catch (cause) {
      setError(normalizeFormError(cause));
    }
  }, [shopId]);
  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);
  async function toggle(product: CatalogProduct) {
    try {
      await request(`/shops/${shopId}/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ selling: !product.selling, expectedVersion: product.version }),
      });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Sản phẩm vừa được sửa ở nơi khác. Đã tải lại dữ liệu mới.");
        await refresh();
      } else setError(normalizeFormError(cause));
    }
  }
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Sản phẩm của cửa hàng</h1>
        <p>Quản lý ảnh, biến thể, giá bán và tồn kho.</p>
      </header>
      <ProductEditor shopId={shopId} onCreated={refresh} />
      {error && <p role="alert">{error}</p>}
      <section className="grid gap-4" aria-label="Danh sách sản phẩm">
        {rows.map((product) => (
          <article className="grid gap-3 rounded-lg border p-4" key={product.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{product.name}</h2>
                <p>
                  {product.selling ? "Đang bán" : "Đã dừng bán"} · {product.variants.length} biến
                  thể
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(editing === product.id ? "" : product.id)}>
                  Sửa
                </button>
                <button onClick={() => void toggle(product)}>
                  {product.selling ? "Dừng bán" : "Đăng bán lại"}
                </button>
              </div>
            </div>
            {editing === product.id && (
              <form
                className="grid gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const targetForm = event.currentTarget;
                  const form = new FormData(targetForm);
                  try {
                    const imageFiles = form
                      .getAll("images")
                      .filter((value): value is File => value instanceof File && value.size > 0);
                    const uploadedImages = await Promise.all(
                      imageFiles.map(async (file) => {
                        const upload = new FormData();
                        upload.set("file", file);
                        upload.set("purpose", "PRODUCT_IMAGE");
                        upload.set("shopId", shopId);
                        return request<{ id: string }>("/users/me/assets", {
                          method: "POST",
                          body: upload,
                        });
                      }),
                    );
                    await request(`/shops/${shopId}/products/${product.id}`, {
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
                    setEditing("");
                    await refresh();
                  } catch (cause) {
                    if (cause instanceof ApiClientError && cause.status === 409) {
                      setError("Sản phẩm đã đổi. Đã tải lại; hãy mở sửa lại.");
                      await refresh();
                    } else setError(normalizeFormError(cause));
                  }
                }}
              >
                <label>
                  Tên
                  <input name="name" defaultValue={product.name} required />
                </label>
                <label>
                  Mô tả
                  <textarea name="description" defaultValue={product.description} />
                </label>
                <label>
                  Thêm ảnh vào thư viện
                  <input
                    name="images"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                  />
                </label>
                <button>Lưu thay đổi</button>
              </form>
            )}
            <div className="flex gap-2" aria-label="Thư viện ảnh">
              {product.images.map(
                (image) =>
                  image.objectKey && (
                    <img
                      key={image.assetId}
                      src={`${process.env.NEXT_PUBLIC_ASSET_PUBLIC_READ_BASE ?? ""}/${image.objectKey}`}
                      alt={`Ảnh ${product.name}`}
                      className="h-20 w-20 rounded object-cover"
                    />
                  ),
              )}
            </div>
            <ul className="grid gap-2">
              {product.variants.map((variant) => (
                <li key={variant.id} className="rounded border p-3">
                  {editingVariant === variant.id ? (
                    <form
                      className="grid gap-2"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        const form = new FormData(event.currentTarget);
                        try {
                          await request(`/shops/${shopId}/variants/${variant.id}`, {
                            method: "PATCH",
                            body: JSON.stringify({
                              sku: form.get("sku"),
                              price: form.get("price"),
                              selling: form.get("selling") === "on",
                              expectedVersion: variant.version,
                            }),
                          });
                          setEditingVariant("");
                          await refresh();
                        } catch (cause) {
                          if (cause instanceof ApiClientError && cause.status === 409) {
                            setError("Biến thể đã đổi. Đã tải lại dữ liệu để anh kiểm tra.");
                            await refresh();
                          } else setError(normalizeFormError(cause));
                        }
                      }}
                    >
                      <label>
                        SKU
                        <input name="sku" defaultValue={variant.sku} required />
                      </label>
                      <label>
                        Giá VND
                        <input
                          name="price"
                          inputMode="numeric"
                          pattern="[0-9]+"
                          defaultValue={variant.price}
                          required
                        />
                      </label>
                      <label>
                        <input type="checkbox" name="selling" defaultChecked={variant.selling} />{" "}
                        Đang bán
                      </label>
                      <button>Lưu biến thể</button>
                    </form>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {variant.sku} · {variant.price} VND · tồn {variant.availableQuantity} ·{" "}
                        {variant.selling ? "đang bán" : "đã dừng"}
                      </span>
                      <button onClick={() => setEditingVariant(variant.id)}>Sửa biến thể</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <InventoryEditor shopId={shopId} product={product} onChanged={refresh} />
          </article>
        ))}
      </section>
    </main>
  );
}
