"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Asset = { url: string; mimeType: string };
type Product = {
  id: string;
  shopId: string;
  shopName: string;
  name: string;
  image: Asset | null;
  minimumPrice: string;
  available: boolean;
  ratingCount: number;
};
type Category = { id: string; name: string; children?: Category[] };
type Result = { data: Product[]; meta: { page: number; pageSize: number; total: number } };
const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1").replace(
  /\/+$/,
  "",
);
const flatten = (items: Category[]): Category[] =>
  items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")}₫`;

export function ProductGrid({ endpoint = "/products" }: { endpoint?: string }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const search = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(search), [search]);

  useEffect(() => {
    setQuery(params.get("q") ?? "");
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
  }, [params]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(false);
    const suffix = params.toString();
    const get = async <T,>(path: string): Promise<T> => {
      const response = await fetch(`${apiBase}${path}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const envelope = (await response.json()) as { data: T; meta?: unknown };
      return (envelope.meta ? { data: envelope.data, meta: envelope.meta } : envelope.data) as T;
    };
    void Promise.all([
      get<Result>(`${endpoint}${suffix ? `?${suffix}` : ""}`),
      get<Category[]>("/categories"),
    ])
      .then(([products, categoriesResponse]) => {
        if (!current) return;
        setResult(products);
        setCategories(flatten(categoriesResponse));
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [endpoint, params, retryKey]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <section aria-label="Danh sách sản phẩm" className="space-y-5">
      <form
        className="grid gap-3 rounded-xl border border-marketplace-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams(search);
          for (const [key, value] of [
            ["q", query],
            ["minPrice", minPrice],
            ["maxPrice", maxPrice],
          ]) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          next.set("page", "1");
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
      >
        <label className="text-sm font-medium lg:col-span-2">
          Tìm sản phẩm
          <input
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên hoặc mô tả sản phẩm"
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <label className="text-sm font-medium">
          Danh mục
          <select
            aria-label="Danh mục"
            value={params.get("categoryId") ?? ""}
            onChange={(event) => update("categoryId", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Sắp xếp
          <select
            aria-label="Sắp xếp"
            value={params.get("sort") ?? "NEWEST"}
            onChange={(event) => update("sort", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          >
            <option value="NEWEST">Mới nhất</option>
            <option value="PRICE_ASC">Giá tăng dần</option>
            <option value="PRICE_DESC">Giá giảm dần</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Giá từ
          <input
            inputMode="numeric"
            aria-label="Giá từ"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value.replace(/\D/g, ""))}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <label className="text-sm font-medium">
          Giá đến
          <input
            inputMode="numeric"
            aria-label="Giá đến"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value.replace(/\D/g, ""))}
            className="mt-1 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
        <div className="flex items-end">
          <button className="min-h-11 w-full rounded-lg bg-marketplace-accent px-4 font-semibold text-white">
            Tìm kiếm
          </button>
        </div>
      </form>
      {loading && (
        <p role="status" className="py-8 text-center">
          Đang tải sản phẩm…
        </p>
      )}
      {error && !loading && (
        <div role="alert" className="rounded-lg border border-red-300 p-5">
          Không tải được sản phẩm.{" "}
          <button className="underline" onClick={() => setRetryKey((value) => value + 1)}>
            Thử lại
          </button>
        </div>
      )}
      {!loading && !error && !result?.data.length && (
        <p className="rounded-lg border p-8 text-center">Chưa tìm thấy sản phẩm phù hợp.</p>
      )}
      {!loading && !error && !!result?.data.length && (
        <>
          <p aria-live="polite" className="text-sm text-neutral-600">
            {result.meta.total} sản phẩm
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {result.data.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md"
              >
                <Link
                  href={`/products/${product.id}`}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="aspect-square bg-neutral-100">
                    {product.image && (
                      <img src={product.image.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="space-y-2 p-3">
                    <h2 className="line-clamp-2 min-h-12 font-medium">{product.name}</h2>
                    <p className="font-semibold text-marketplace-accent">
                      {money(product.minimumPrice)}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {product.available ? "Còn hàng" : "Tạm hết hàng"}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/shops/${product.shopId}`}
                  className="block truncate px-3 pb-3 text-xs text-neutral-600 underline"
                >
                  {product.shopName}
                </Link>
              </article>
            ))}
          </div>
          <nav
            aria-label="Phân trang sản phẩm"
            className="flex items-center justify-center gap-4 py-4"
          >
            <button
              disabled={result.meta.page <= 1}
              onClick={() => update("page", String(result.meta.page - 1))}
              className="min-h-11 rounded border px-4 disabled:opacity-40"
            >
              Trang trước
            </button>
            <span>
              Trang {result.meta.page} /{" "}
              {Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize))}
            </span>
            <button
              disabled={result.meta.page * result.meta.pageSize >= result.meta.total}
              onClick={() => update("page", String(result.meta.page + 1))}
              className="min-h-11 rounded border px-4 disabled:opacity-40"
            >
              Trang sau
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
