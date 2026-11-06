"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import {
  Button,
  EmptyState,
  ImageOff,
  Pagination,
  Skeleton,
  Star,
  StatusMessage,
  TextField,
  SelectField,
  formatVnd,
  useApi,
} from "@marketplace/ui-web";

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
type Result = {
  data: Product[];
  meta: { page: number; pageSize: number; total: number };
};
const flatten = (items: Category[]): Category[] =>
  items.flatMap((item) => [item, ...flatten(item.children ?? [])]);

export function ProductGrid({ endpoint = "/products" }: { endpoint?: string }) {
  const { api } = useApi();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    setError("");
    const suffix = params.toString();
    void Promise.all([
      api.requestEnvelope<Product[]>(
        `${endpoint}${suffix ? `?${suffix}` : ""}` as ApiPath,
      ),
      api.request<Category[]>("/categories"),
    ])
      .then(([products, categoriesResponse]) => {
        if (!current) return;
        const { page, pageSize, total } = products.meta ?? {};
        if (page === undefined || pageSize === undefined || total === undefined)
          throw new Error("Máy chủ chưa trả thông tin phân trang sản phẩm.");
        setResult({ data: products.data, meta: { page, pageSize, total } });
        setCategories(flatten(categoriesResponse));
      })
      .catch((cause: unknown) => {
        if (current) setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api, endpoint, params, retryKey]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(search);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const pageCount = result
    ? Math.max(1, Math.ceil(result.meta.total / result.meta.pageSize))
    : 1;

  return (
    <section aria-label="Danh sách sản phẩm" className="mp-catalog__body">
      <form
        className="mp-filter"
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
        <div className="mp-filter__search">
          <TextField
            label="Tìm sản phẩm"
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên hoặc mô tả sản phẩm"
            autoComplete="off"
          />
        </div>
        <SelectField
          label="Danh mục"
          value={params.get("categoryId") ?? ""}
          placeholder="Tất cả danh mục"
          onChange={(event) => update("categoryId", event.target.value)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sắp xếp"
          value={params.get("sort") ?? "NEWEST"}
          onChange={(event) => update("sort", event.target.value)}
        >
          <option value="NEWEST">Mới nhất</option>
          <option value="PRICE_ASC">Giá tăng dần</option>
          <option value="PRICE_DESC">Giá giảm dần</option>
        </SelectField>
        <TextField
          label="Giá từ"
          inputMode="numeric"
          value={minPrice}
          onChange={(event) =>
            setMinPrice(event.target.value.replace(/\D/g, ""))
          }
          placeholder="0"
        />
        <TextField
          label="Giá đến"
          inputMode="numeric"
          value={maxPrice}
          onChange={(event) =>
            setMaxPrice(event.target.value.replace(/\D/g, ""))
          }
          placeholder="Không giới hạn"
        />
        <div className="mp-filter__submit">
          <Button type="submit">Tìm kiếm</Button>
        </div>
      </form>

      {loading && (
        <>
          <p className="mp-visually-hidden" role="status">
            Đang tải sản phẩm…
          </p>
          <div className="mp-product-grid" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="mp-product-card">
                <Skeleton className="mp-product-card__media" />
                <div className="mp-product-card__body">
                  <Skeleton className="mp-skeleton--line" />
                  <Skeleton className="mp-skeleton--line" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && !loading && (
        <StatusMessage tone="error" title="Không tải được sản phẩm.">
          {error}{" "}
          <button
            type="button"
            className="mp-link"
            onClick={() => setRetryKey((value) => value + 1)}
          >
            Thử lại
          </button>
        </StatusMessage>
      )}

      {!loading && !error && result && result.data.length === 0 && (
        <EmptyState
          icon={<ImageOff size={22} />}
          title="Chưa tìm thấy sản phẩm phù hợp."
          description="Thử bỏ bớt bộ lọc hoặc tìm với từ khóa khác."
          action={
            <Button
              variant="secondary"
              onClick={() => router.replace(pathname, { scroll: false })}
            >
              Xóa bộ lọc
            </Button>
          }
        />
      )}

      {!loading && !error && result && result.data.length > 0 && (
        <>
          <p className="mp-catalog__count" aria-live="polite">
            {result.meta.total} sản phẩm
          </p>
          <div className="mp-product-grid mp-stagger">
            {result.data.map((product, index) => (
              <article
                key={product.id}
                className="mp-product-card"
                style={{ "--i": index } as CSSProperties}
              >
                <Link
                  href={`/products/${product.id}`}
                  className="mp-product-card__media"
                >
                  {product.image ? (
                    <img src={product.image.url} alt="" loading="lazy" />
                  ) : (
                    <span
                      className="mp-product-card__placeholder"
                      aria-hidden="true"
                    >
                      <ImageOff size={26} />
                    </span>
                  )}
                </Link>
                <div className="mp-product-card__body">
                  <Link
                    href={`/products/${product.id}`}
                    className="mp-product-card__name"
                  >
                    {product.name}
                  </Link>
                  <p className="mp-product-card__price" data-numeric>
                    {formatVnd(product.minimumPrice)}
                  </p>
                  <div className="mp-product-card__meta">
                    <span
                      className={
                        product.available
                          ? "mp-product-card__stock"
                          : "mp-product-card__stock mp-product-card__stock--out"
                      }
                    >
                      {product.available ? "Còn hàng" : "Tạm hết hàng"}
                    </span>
                    {product.ratingCount > 0 ? (
                      <span className="mp-product-card__rating">
                        <Star size={13} aria-hidden="true" />
                        {product.ratingCount}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/shops/${product.shopId}`}
                    className="mp-product-card__shop"
                  >
                    {product.shopName}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          <Pagination
            page={result.meta.page}
            pageCount={pageCount}
            total={result.meta.total}
            pageSize={result.meta.pageSize}
            hrefForPage={(page) => {
              const next = new URLSearchParams(search);
              next.set("page", String(page));
              return `${pathname}?${next.toString()}`;
            }}
          />
        </>
      )}
    </section>
  );
}
