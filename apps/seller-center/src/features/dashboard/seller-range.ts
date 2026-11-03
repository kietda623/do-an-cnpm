"use client";

import { useEffect, useState, type FormEvent } from "react";
import { defaultRangeInputs, lastDaysRange, vietnamInputToUtc } from "../../lib/vietnam-time";

export type SellerRange = { from: string; to: string };

export function useSellerRange(days = 30) {
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [range, setRange] = useState<SellerRange | null>(null);
  const [rangeError, setRangeError] = useState("");

  useEffect(() => {
    const inputs = defaultRangeInputs(days);
    setDraftFrom(inputs.from);
    setDraftTo(inputs.to);
    setRange(lastDaysRange(days));
  }, [days]);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = vietnamInputToUtc(draftFrom);
    const to = vietnamInputToUtc(draftTo);
    if (!from || !to || Date.parse(from) >= Date.parse(to)) {
      setRangeError("Vui lòng nhập thời gian hợp lệ; ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }
    setRangeError("");
    setRange({ from, to });
  }

  return {
    draftFrom,
    draftTo,
    setDraftFrom,
    setDraftTo,
    range,
    rangeError,
    applyRange,
  };
}
