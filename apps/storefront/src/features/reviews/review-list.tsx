"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  Pagination,
  Skeleton,
  Star,
  StatusMessage,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";

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
  const { api } = useApi();
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void api
      .request<Review[]>(
        `/products/${productId}/reviews?page=${page}&pageSize=${pageSize}` as ApiPath,
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
  }, [api, page, productId]);

  return (
    <section className="mp-reviews" aria-labelledby="product-reviews">
      <header className="mp-reviews__head">
        <div>
          <h2 id="product-reviews">Đánh giá sản phẩm</h2>
          <p className="mp-reviews__summary">
            {ratingAverage != null
              ? `${Number(ratingAverage).toLocaleString("vi-VN", {
                  maximumFractionDigits: 1,
                })}/5`
              : "Chưa có điểm"}{" "}
            · {ratingCount} đánh giá
          </p>
        </div>
        <span className="mp-reviews__badge">
          <Star size={15} aria-hidden="true" />
          {ratingCount > 0 ? "Đánh giá thật từ người mua" : "Chưa có đánh giá"}
        </span>
      </header>

      {loading ? (
        <div className="mp-reviews__list" aria-busy="true">
          {[0, 1].map((index) => (
            <div key={index} className="mp-review">
              <Skeleton className="mp-skeleton--line" />
              <Skeleton className="mp-skeleton--line" />
            </div>
          ))}
          <p className="mp-visually-hidden" role="status">
            Đang tải đánh giá…
          </p>
        </div>
      ) : error ? (
        <StatusMessage tone="error" title="Không tải được đánh giá">
          {error}
        </StatusMessage>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có đánh giá."
          description="Người mua có thể đánh giá sau khi đơn hoàn tất."
        />
      ) : (
        <ul className="mp-reviews__list">
          {rows.map((row) => (
            <li key={row.id} className="mp-review">
              <div className="mp-review__head">
                <strong>{row.buyerDisplayName}</strong>
                <span className="mp-review__rating" aria-label={`${row.rating} trên 5 sao`}>
                  <Star size={14} aria-hidden="true" />
                  {row.rating}/5
                </span>
              </div>
              <p className="mp-review__comment">{row.comment}</p>
              <time dateTime={row.createdAt}>
                {new Date(row.createdAt).toLocaleDateString("vi-VN")}
              </time>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && rows.length > 0 && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(ratingCount / pageSize))}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
