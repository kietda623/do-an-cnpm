"use client";

import { useEffect, useMemo, useState } from "react";
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
  useEffect(() => {
    let live = true;
    void api
      .request<Stats>(`/shops/${shopId}/stats` as ApiPath)
      .then((value) => {
        if (live) setStats(value);
      })
      .catch((cause: unknown) => {
        if (live) setError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api, shopId]);
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Tổng quan cửa hàng</h1>
      <p>Số liệu doanh thu mô phỏng, không đại diện số tiền đã đối soát.</p>
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
      <RevenueView api={api} shopId={shopId} />
      <ReviewView api={api} shopId={shopId} />
    </main>
  );
}
