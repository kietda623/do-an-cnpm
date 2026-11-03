"use client";

import { useState, type FormEvent } from "react";
import { Button, SelectField, StatusMessage, TextareaField } from "@marketplace/ui-web";
import { normalizeFormError } from "@marketplace/api-client";
import { webSession } from "../../lib/session";

export function ReviewForm({
  orderItemId,
  reviewId,
  review,
  onDone,
}: {
  orderItemId: string;
  reviewId?: string | null;
  review?: { rating: number; comment: string; createdAt: string } | null;
  onDone: () => Promise<void>;
}) {
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (reviewId)
    return (
      <section className="mp-review-submitted" aria-label="Đánh giá đã gửi">
        <p role="status">Đã đánh giá</p>
        {review && (
          <>
            <p className="mp-review-submitted__rating">{review.rating}/5 sao</p>
            <p className="mp-review-submitted__comment">{review.comment}</p>
            <time dateTime={review.createdAt}>
              {new Date(review.createdAt).toLocaleDateString("vi-VN")}
            </time>
          </>
        )}
      </section>
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await webSession.api.request("/reviews", {
        method: "POST",
        body: JSON.stringify({
          orderItemId,
          rating: Number(rating),
          comment: comment.trim(),
        }),
      });
      await onDone();
    } catch (cause) {
      setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mp-review-form" onSubmit={submit} aria-label="Gửi đánh giá">
      <p className="mp-review-form__title">Chia sẻ cảm nhận về sản phẩm</p>
      <div className="mp-review-form__fields">
        <SelectField
          label="Số sao"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </SelectField>
        <TextareaField
          label="Nhận xét"
          required
          minLength={1}
          maxLength={2000}
          rows={3}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      {error && (
        <StatusMessage tone="error" onDismiss={() => setError("")}>
          {error}
        </StatusMessage>
      )}
      <Button type="submit" loading={busy} disabled={!comment.trim()}>
        Gửi đánh giá
      </Button>
    </form>
  );
}
