"use client";

import { Button } from "@marketplace/ui-web";
import type { FormEvent } from "react";

export function RangeForm({
  draftFrom,
  draftTo,
  onFromChange,
  onToChange,
  onSubmit,
  error,
}: {
  draftFrom: string;
  draftTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
}) {
  return (
    <form className="mp-range-form" onSubmit={onSubmit}>
      <label className="mp-field">
        <span className="mp-field__label">Từ (giờ Việt Nam)</span>
        <input
          className="mp-field__input"
          type="datetime-local"
          required
          value={draftFrom}
          onChange={(event) => onFromChange(event.target.value)}
        />
      </label>
      <label className="mp-field">
        <span className="mp-field__label">Đến trước (giờ Việt Nam)</span>
        <input
          className="mp-field__input"
          type="datetime-local"
          required
          value={draftTo}
          onChange={(event) => onToChange(event.target.value)}
        />
      </label>
      <Button type="submit" variant="secondary">
        Áp dụng khoảng thời gian
      </Button>
      <p className="mp-field__hint mp-range-form__hint">
        Mặc định là 30 ngày gần nhất; thời điểm kết thúc không được tính vào khoảng.
      </p>
      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}
    </form>
  );
}
