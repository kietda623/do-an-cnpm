"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Pagination,
  Panel,
  SelectField,
  Skeleton,
  Star,
  TextField,
  formatDateTime,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { SellerReview } from "../../../../lib/types";

const pageSize = 10;

export default function ReviewsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api } = useApi();
  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState("");
  const [applied, setApplied] = useState({ productId: "", rating: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SellerReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (applied.productId) params.set("productId", applied.productId);
    if (applied.rating) params.set("rating", applied.rating);
    try {
      setRows(await api.request<SellerReview[]>(`/shops/${shopId}/reviews?${params}` as ApiPath));
    } catch (cause) {
      setRows([]);
      setError(normalizeFormError(cause));
    } finally {
      setLoading(false);
    }
  }, [api, applied, page, shopId]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ productId: productId.trim(), rating });
  }

  const hasNext = rows.length === pageSize;
  const pageCount = page + (hasNext ? 1 : 0);

  return (
    <div className="mp-page mp-seller-page">
      <PageHeader
        title="Đánh giá của người mua"
        description="Đọc phản hồi theo sản phẩm và số sao để cải thiện chất lượng bán hàng."
      />

      <Panel title="Bộ lọc đánh giá" description="Lọc theo mã sản phẩm hoặc số sao.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Mã sản phẩm"
              name="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="Dán mã sản phẩm để lọc chính xác"
            />
            <SelectField
              label="Lọc số sao"
              name="rating"
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              <option value="">Tất cả số sao</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} sao
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={loading}>
              Lọc đánh giá
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Danh sách đánh giá"
        description={loading ? undefined : `${rows.length} đánh giá trên trang này`}
        flush
      >
        {loading ? (
          <div className="mp-panel__pad mp-stack" role="status">
            <span className="mp-visually-hidden">Đang tải đánh giá…</span>
            <Skeleton className="mp-skeleton--block" />
            <Skeleton className="mp-skeleton--block" />
          </div>
        ) : error ? (
          <div className="mp-panel__pad">
            <p role="alert" className="mp-alert-inline">
              {error}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mp-panel__pad">
            <EmptyState
              icon={<Star size={22} />}
              title="Chưa có đánh giá phù hợp"
              description="Khi người mua gửi đánh giá, nội dung sẽ xuất hiện tại đây."
            />
          </div>
        ) : (
          <>
            <ul className="mp-review-list">
              {rows.map((review) => (
                <li className="mp-review" key={review.id}>
                  <Avatar name={review.buyerDisplayName} size="sm" />
                  <div className="mp-review__body">
                    <div className="mp-review__meta">
                      <strong>{review.buyerDisplayName}</strong>
                      <Badge tone="warning">
                        <Star size={12} aria-hidden="true" /> {review.rating}/5
                      </Badge>
                      <span className="mp-muted">{formatDateTime(review.createdAt)}</span>
                    </div>
                    <p className="mp-review__comment">{review.comment || "Người mua không để lại bình luận."}</p>
                    <p className="mp-muted mp-review__product">Sản phẩm: {review.productId}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mp-panel__pad">
              <Pagination
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
