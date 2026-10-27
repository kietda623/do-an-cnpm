"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  WebSession,
  normalizeFormError,
  type ApiPath,
} from "@marketplace/api-client";
import { RevenueView } from "./revenue-view";
import { ReviewView } from "./review-view";

type Stats = {
  productCount: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  completedRevenue: string;
};
type ReportRange = { from: string; to: string };
const vietnamClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Saigon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
function localTimestamp(date: Date) {
  const parts = Object.fromEntries(
    vietnamClock.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return `${parts.year!.padStart(4, "0")}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
function vietnamInput(date: Date) {
  return localTimestamp(date).slice(0, 16);
}
function vietnamInputToUtc(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target)) return null;
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const observed = Date.parse(`${localTimestamp(new Date(instant))}Z`);
    const correction = target - observed;
    if (correction === 0) return new Date(instant).toISOString();
    instant += correction;
  }
  return null;
}
export function ShopDashboard({
  shopId,
  apiUrl,
}: {
  shopId: string;
  apiUrl: string;
}) {
  const api = useMemo(() => new WebSession(apiUrl).api, [apiUrl]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [range, setRange] = useState<ReportRange | null>(null);
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  useEffect(() => {
    const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDraftFrom(vietnamInput(from));
    setDraftTo(vietnamInput(to));
    setRange({ from: from.toISOString(), to: to.toISOString() });
  }, []);
  useEffect(() => {
    if (!range) return;
    let live = true;
    setStats(null);
    setError("");
    const params = new URLSearchParams(range);
    void api
      .request<Stats>(`/shops/${shopId}/stats?${params}` as ApiPath)
      .then((value) => {
        if (live) setStats(value);
      })
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api, shopId, range]);
  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = vietnamInputToUtc(draftFrom);
    const to = vietnamInputToUtc(draftTo);
    if (!from || !to || Date.parse(from) >= Date.parse(to)) {
      setRangeError(
        "Vui lòng nhập thời gian hợp lệ; ngày kết thúc phải sau ngày bắt đầu.",
      );
      return;
    }
    setRangeError("");
    setRange({ from, to });
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tổng quan cửa hàng</h1>
      <p>Số liệu doanh thu mô phỏng, không đại diện số tiền đã đối soát.</p>
      <form onSubmit={applyRange} className="flex flex-wrap gap-3">
        <label>
          Từ (giờ Việt Nam){" "}
          <input
            aria-label="Từ (giờ Việt Nam)"
            type="datetime-local"
            required
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
          />
        </label>
        <label>
          Đến trước (giờ Việt Nam){" "}
          <input
            aria-label="Đến trước (giờ Việt Nam)"
            type="datetime-local"
            required
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
          />
        </label>
        <button type="submit">Áp dụng khoảng thời gian</button>
      </form>
      <p className="text-sm">
        Mặc định là 30 ngày gần nhất; thời điểm kết thúc không được tính vào
        khoảng.
      </p>
      {rangeError && <p role="alert">{rangeError}</p>}
      {error ? (
        <p role="alert">{error}</p>
      ) : !stats ? (
        <p role="status">Đang tải thống kê…</p>
      ) : (
        <section
          aria-label="Thống kê cửa hàng"
          className="grid gap-2 rounded border p-4"
        >
          <p>Sản phẩm: {stats.productCount}</p>
          <p>Chờ xác nhận: {stats.pendingCount}</p>
          <p>Đang xử lý: {stats.processingCount}</p>
          <p>Hoàn thành: {stats.completedCount}</p>
          <p>Doanh thu mô phỏng: {stats.completedRevenue} VND</p>
        </section>
      )}
      <RevenueView api={api} shopId={shopId} range={range} />
      <ReviewView api={api} shopId={shopId} />
    </main>
  );
}
