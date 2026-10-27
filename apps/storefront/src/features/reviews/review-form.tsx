"use client";

import { useState, type FormEvent } from "react";
import { normalizeFormError } from "@marketplace/api-client";
import { webSession } from "../../app/auth-form";

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
      <section className="mt-2 text-sm" aria-label="Đánh giá đã gửi">
        <p role="status">Đã đánh giá</p>
        {review && (
          <>
            <p>{review.rating}/5 sao</p>
            <p className="whitespace-pre-wrap">{review.comment}</p>
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
    <form onSubmit={submit} className="mt-3 grid gap-2 rounded border p-3">
      <label>
        Số sao{" "}
        <select
          aria-label="Số sao"
          value={rating}
          onChange={(event) => setRating(event.target.value)}
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label>
        Nhận xét{" "}
        <textarea
          aria-label="Nhận xét"
          required
          minLength={1}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy || !comment.trim()} type="submit">
        {busy ? "Đang gửi…" : "Gửi đánh giá"}
      </button>
    </form>
  );
}
