"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  DataTable,
  EmptyState,
  formatNumber,
  formatVnd,
  Panel,
  SelectField,
  Skeleton,
  usePolling,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath, type ApiTransport } from "@marketplace/api-client";
import type { RevenuePoint, RevenueSeries } from "../../lib/types";
import type { SellerRange } from "./seller-range";

type GroupBy = "DAY" | "MONTH";

export function useSellerRevenue({
  api,
  shopId,
  range,
  initialGroupBy = "DAY",
}: {
  api: ApiTransport;
  shopId: string;
  range: SellerRange | null;
  initialGroupBy?: GroupBy;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>(initialGroupBy);
  const [series, setSeries] = useState<RevenueSeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!range) return;
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      try {
        const params = new URLSearchParams({ ...range, groupBy });
        const value = await api.request<RevenueSeries>(`/shops/${shopId}/revenue?${params}` as ApiPath);
        setSeries(value);
      } catch (cause) {
        if (!silent) setError(normalizeFormError(cause));
        throw cause;
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, groupBy, range, shopId],
  );

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  usePolling(load, { intervalMs: 60_000, enabled: range !== null });

  return { groupBy, setGroupBy, series, loading, error };
}

export function RevenuePanel({
  groupBy,
  onGroupByChange,
  series,
  loading,
  error,
  showTable = false,
}: {
  groupBy: GroupBy;
  onGroupByChange: (value: GroupBy) => void;
  series: RevenueSeries | null;
  loading: boolean;
  error: string;
  showTable?: boolean;
}) {
  const columns: DataTableColumn<RevenuePoint>[] = [
    { key: "period", header: "Kỳ", render: (row) => row.period },
    {
      key: "orders",
      header: "Đơn hoàn thành",
      numeric: true,
      render: (row) => formatNumber(row.completedCount),
    },
    {
      key: "revenue",
      header: "Doanh thu",
      numeric: true,
      render: (row) => formatVnd(row.revenue),
    },
  ];

  return (
    <Panel
      title="Doanh thu"
      description="Chỉ tính các đơn đã hoàn thành trong khoảng thời gian đã chọn."
      actions={
        <SelectField
          label="Nhóm doanh thu"
          value={groupBy}
          onChange={(event) => onGroupByChange(event.target.value as GroupBy)}
          containerClassName="mp-field--inline"
        >
          <option value="DAY">Ngày</option>
          <option value="MONTH">Tháng</option>
        </SelectField>
      }
      flush
    >
      <div className="mp-panel__pad">
        {loading ? (
          <div role="status" className="mp-stack">
            <span className="mp-visually-hidden">Đang tải doanh thu…</span>
            <Skeleton className="mp-skeleton--line" />
            <Skeleton className="mp-skeleton--block" />
          </div>
        ) : error ? (
          <p role="alert" className="mp-alert-inline">
            {error}
          </p>
        ) : !series?.points.length ? (
          <EmptyState
            title="Chưa có doanh thu hoàn thành."
            description="Doanh thu xuất hiện khi đơn hàng của cửa hàng được người mua xác nhận đã nhận."
          />
        ) : (
          <div className="mp-stack">
            <div className="mp-revenue-summary">
              <div>
                <span className="mp-muted">Tổng doanh thu</span>
                <strong data-numeric>{formatVnd(series.totalRevenue)}</strong>
              </div>
              <div>
                <span className="mp-muted">Đơn hoàn thành</span>
                <strong data-numeric>
                  {formatNumber(series.points.reduce((sum, point) => sum + point.completedCount, 0))}
                </strong>
              </div>
            </div>
            <BarChart
              label="Doanh thu theo kỳ"
              data={series.points.map((point) => ({
                label: point.period,
                value: Number(point.revenue),
              }))}
              valueFormat={(value) => formatVnd(value)}
              caption={`Doanh thu theo ${groupBy === "DAY" ? "ngày" : "tháng"}`}
              height={220}
            />
            {series.simulated ? (
              <p className="mp-note">
                Số liệu doanh thu mô phỏng, không đại diện số tiền đã đối soát.
              </p>
            ) : null}
          </div>
        )}
      </div>
      {showTable && series?.points.length ? (
        <DataTable
          columns={columns}
          rows={series.points}
          rowKey={(row) => row.period}
          caption="Doanh thu theo kỳ"
          dense
        />
      ) : null}
    </Panel>
  );
}
