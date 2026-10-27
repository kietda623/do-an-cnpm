"use client";

import { useEffect, useState } from "react";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import { webSession } from "../../app/auth-form";

type Review = {
  id: string;
  buyerDisplayName: string;
  rating: number;
  comment: string;
  createdAt: string;
};
export function ReviewList({
  productId,
  ratingAverage,
  ratingCount,
}: {
  productId: string;
  ratingAverage?: string | null;
  ratingCount: number;
}) {
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void webSession.api
      .request<Review[]>(
        `/products/${productId}/reviews?page=${page}&pageSize=20` as ApiPath,
      )
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
  }, [productId, page]);
  return (
    <section
      className="space-y-3 rounded-xl border p-5 md:col-span-2"
      aria-label="Đánh giá sản phẩm"
    >
      <h2 className="text-xl font-semibold">Đánh giá sản phẩm</h2>
      <p>
        {ratingAverage ?? "Chưa có điểm"} · {ratingCount} đánh giá
      </p>
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
              <p className="whitespace-pre-wrap">{row.comment}</p>
              <time dateTime={row.createdAt}>
                {new Date(row.createdAt).toLocaleDateString("vi-VN")}
              </time>
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
