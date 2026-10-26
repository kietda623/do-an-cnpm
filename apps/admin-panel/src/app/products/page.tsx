"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@marketplace/ui-web";
import {
  ApiClientError,
  normalizeFormError,
  type ApiPath,
  WebSession,
} from "@marketplace/api-client";

type Product = {
  id: string;
  shopId: string;
  name: string;
  description: string;
  selling: boolean;
  adminHidden: boolean;
  hiddenReason: string | null;
  version: number;
  minimumPrice: string | null;
};
const api = new WebSession(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
).api;
const request = <T,>(path: string, init?: RequestInit) =>
  api.request<T>(path as ApiPath, init);

export default function AdminProductsPage() {
  const { user } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState("");
  const [shopId, setShopId] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [pending, setPending] = useState<Product | null>(null);
  const refresh = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "50" });
    if (q.trim()) params.set("q", q.trim());
    if (shopId.trim()) params.set("shopId", shopId.trim());
    if (hidden) params.set("adminHidden", hidden);
    setProducts(await request<Product[]>(`/admin/products?${params}`));
  }, [q, hidden, shopId]);
  useEffect(() => {
    if (user?.roles.includes("ADMIN"))
      void refresh().catch((cause: unknown) =>
        setError(normalizeFormError(cause)),
      );
  }, [user, refresh]);
  async function hide(product: Product) {
    setBusy(product.id);
    setError("");
    try {
      await request(`/admin/products/${product.id}/hide`, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          reason: reason[product.id]?.trim(),
          expectedVersion: product.version,
        }),
      });
      setPending(null);
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "Sản phẩm vừa thay đổi. Danh sách đã tải lại; hãy kiểm tra phiên bản mới.",
        );
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy("");
    }
  }
  if (!user)
    return (
      <main className="p-8">
        <p>Đăng nhập quản trị để kiểm duyệt sản phẩm.</p>
        <Link href="/login">Đăng nhập</Link>
      </main>
    );
  if (!user.roles.includes("ADMIN"))
    return (
      <main className="p-8">
        <p role="alert">Bạn không có quyền kiểm duyệt sản phẩm.</p>
      </main>
    );
  return (
    <main className="mx-auto grid max-w-6xl gap-5 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Kiểm duyệt sản phẩm</h1>
        <p>{products.length} kết quả</p>
      </header>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void refresh();
        }}
      >
        <label className="grid gap-1">
          Tìm kiếm
          <input
            aria-label="Tìm kiếm sản phẩm"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Shop ID
          <input
            aria-label="Shop ID sản phẩm"
            value={shopId}
            onChange={(event) => setShopId(event.target.value)}
            className="rounded border p-2"
          />
        </label>
        <label className="grid gap-1">
          Trạng thái ẩn
          <select
            aria-label="Lọc sản phẩm ẩn"
            value={hidden}
            onChange={(event) => setHidden(event.target.value)}
            className="rounded border p-2"
          >
            <option value="">Tất cả</option>
            <option value="false">Đang hiển thị</option>
            <option value="true">Đã ẩn</option>
          </select>
        </label>
        <button className="self-end rounded border px-4 py-2">Tìm</button>
      </form>
      {products.map((product) => (
        <article
          key={product.id}
          className="grid gap-3 rounded border p-4 md:grid-cols-[1fr_auto]"
        >
          <div>
            <h2 className="text-xl font-semibold">{product.name}</h2>
            <p>
              shop {product.shopId} ·{" "}
              {product.selling ? "Đang bán" : "Ngừng bán"} ·{" "}
              {product.adminHidden ? "Đã ẩn" : "Công khai"} · version{" "}
              {product.version}
            </p>
            <p>{product.description}</p>
            <p>Giá thấp nhất: {product.minimumPrice ?? "Chưa có"} VND</p>
            {product.hiddenReason && <p>Lý do ẩn: {product.hiddenReason}</p>}
          </div>
          {!product.adminHidden && (
            <button
              disabled={busy === product.id}
              onClick={() => setPending(product)}
              className="h-fit rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            >
              Ẩn sản phẩm
            </button>
          )}
        </article>
      ))}
      {pending && (
        <dialog
          open
          aria-labelledby="product-hide-dialog-title"
          className="fixed inset-0 m-auto w-[min(92vw,34rem)] rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
        >
          <h2 id="product-hide-dialog-title" className="text-xl font-semibold">
            Ẩn sản phẩm
          </h2>
          <p>
            {pending.name} · version {pending.version}
          </p>
          <label className="my-4 grid gap-1">
            Lý do ẩn
            <textarea
              aria-label={`Lý do ${pending.name}`}
              required
              minLength={1}
              maxLength={500}
              value={reason[pending.id] ?? ""}
              onChange={(event) =>
                setReason((current) => ({
                  ...current,
                  [pending.id]: event.target.value,
                }))
              }
              className="rounded border p-2"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPending(null)}
              className="rounded border px-4 py-2"
            >
              Hủy
            </button>
            <button
              disabled={busy === pending.id || !reason[pending.id]?.trim()}
              onClick={() => void hide(pending)}
              className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-50"
            >
              Xác nhận ẩn
            </button>
          </div>
        </dialog>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
