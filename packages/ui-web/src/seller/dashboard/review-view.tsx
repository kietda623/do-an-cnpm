"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  normalizeFormError,
  type ApiPath,
  type ApiTransport,
} from "@marketplace/api-client";

type Review = {
  id: string;
  productId: string;
  buyerDisplayName: string;
  rating: number;
  comment: string;
  createdAt: string;
};
export function ReviewView({
  api,
  shopId,
}: {
  api: ApiTransport;
  shopId: string;
}) {
  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState("");
  const [filters, setFilters] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Review[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams(filters);
    params.set("page", String(page));
    params.set("pageSize", "20");
    void api
      .request<Review[]>(`/shops/${shopId}/reviews?${params}` as ApiPath)
      .then((value) => {
        if (live) setRows(value);
      })
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, shopId, filters, page]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (productId.trim()) params.set("productId", productId.trim());
    if (rating) params.set("rating", rating);
    setPage(1);
    setFilters(params.toString());
  }
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Đánh giá cửa hàng</h2>
      <form onSubmit={submit} className="flex flex-wrap gap-3">
        <label>
          Mã sản phẩm{" "}
          <input
            aria-label="Mã sản phẩm"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          />
        </label>
        <label>
          Lọc số sao{" "}
          <select
            aria-label="Lọc số sao"
            value={rating}
            onChange={(event) => setRating(event.target.value)}
          >
            <option value="">Tất cả</option>
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Lọc đánh giá</button>
      </form>
      {loading ? (
        <p role="status">Đang tải đánh giá…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : rows.length === 0 ? (
        <p>Chưa có đánh giá.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <strong>{row.buyerDisplayName}</strong> · {row.rating}/5
              <p>{row.comment}</p>
              <small>Sản phẩm: {row.productId}</small>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-3">
        <button
          disabled={loading || page === 1}
          onClick={() => setPage(page - 1)}
        >
          Trang trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={loading || rows.length < 20}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </button>
      </div>
    </section>
  );
}
