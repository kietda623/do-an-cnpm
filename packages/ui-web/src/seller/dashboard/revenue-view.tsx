"use client";

import { useEffect, useState } from "react";
import {
  normalizeFormError,
  type ApiPath,
  type ApiTransport,
} from "@marketplace/api-client";

type Series = {
  totalRevenue: string;
  points: Array<{ period: string; completedCount: number; revenue: string }>;
};
export function RevenueView({
  api,
  shopId,
}: {
  api: ApiTransport;
  shopId: string;
}) {
  const [groupBy, setGroupBy] = useState<"DAY" | "MONTH">("DAY");
  const [series, setSeries] = useState<Series | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void api
      .request<Series>(`/shops/${shopId}/revenue?groupBy=${groupBy}` as ApiPath)
      .then((value) => {
        if (live) setSeries(value);
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
  }, [api, shopId, groupBy]);
  return (
    <section className="space-y-3 rounded border p-4">
      <h2 className="text-xl font-semibold">Doanh thu mô phỏng</h2>
      <label>
        Nhóm doanh thu{" "}
        <select
          aria-label="Nhóm doanh thu"
          value={groupBy}
          onChange={(event) =>
            setGroupBy(event.target.value as "DAY" | "MONTH")
          }
        >
          <option value="DAY">Ngày</option>
          <option value="MONTH">Tháng</option>
        </select>
      </label>
      {loading ? (
        <p role="status">Đang tải doanh thu…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !series?.points.length ? (
        <p>Chưa có doanh thu hoàn thành.</p>
      ) : (
        <>
          <p>Tổng: {series.totalRevenue} VND</p>
          <table>
            <thead>
              <tr>
                <th>Kỳ</th>
                <th>Đơn hoàn thành</th>
                <th>Doanh thu VND</th>
              </tr>
            </thead>
            <tbody>
              {series.points.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.completedCount}</td>
                  <td>{row.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
