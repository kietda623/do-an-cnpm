"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  ChartLine,
  CircleCheck,
  PageHeader,
  Panel,
  Skeleton,
  StatCard,
  formatNumber,
  formatVnd,
  useApi,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { SellerStats } from "../../../../lib/types";
import { RangeForm } from "../../../../features/dashboard/range-form";
import { RevenuePanel, useSellerRevenue } from "../../../../features/dashboard/revenue-panel";
import { useSellerRange } from "../../../../features/dashboard/seller-range";

export default function AnalyticsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api } = useApi();
  const { draftFrom, draftTo, setDraftFrom, setDraftTo, range, rangeError, applyRange } =
    useSellerRange(90);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const revenue = useSellerRevenue({ api, shopId, range, initialGroupBy: "MONTH" });

  useEffect(() => {
    if (!range) return;
    let live = true;
    setStats(null);
    setStatsError("");
    const params = new URLSearchParams(range);
    void api
      .request<SellerStats>(`/shops/${shopId}/stats?${params}` as ApiPath)
      .then((value) => {
        if (live) setStats(value);
      })
      .catch((cause: unknown) => {
        if (live) setStatsError(normalizeFormError(cause));
      });
    return () => {
      live = false;
    };
  }, [api, range, shopId]);

  return (
    <div className="mp-page">
      <PageHeader
        title="Doanh thu"
        description="Theo dõi doanh thu đã hoàn thành theo tháng, đối chiếu từng kỳ và xuất báo cáo nội bộ."
      />

      <Panel title="Khoảng thời gian" description="Áp dụng cho số liệu và bảng kỳ bên dưới.">
        <RangeForm
          draftFrom={draftFrom}
          draftTo={draftTo}
          onFromChange={setDraftFrom}
          onToChange={setDraftTo}
          onSubmit={applyRange}
          error={rangeError}
        />
      </Panel>

      {statsError ? (
        <p role="alert" className="mp-alert-inline">
          {statsError}
        </p>
      ) : !stats ? (
        <div className="mp-kpi-grid" role="status">
          <span className="mp-visually-hidden">Đang tải thống kê doanh thu…</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="mp-skeleton--block" />
          ))}
        </div>
      ) : (
        <>
          <section aria-label="Chỉ số doanh thu" className="mp-kpi-grid">
            <StatCard
              label="Doanh thu hoàn tất"
              value={formatVnd(stats.completedRevenue)}
              detail={stats.simulated ? "Số liệu mô phỏng" : undefined}
              icon={<ChartLine size={18} />}
              tone="success"
            />
            <StatCard
              label="Đơn hoàn thành"
              value={formatNumber(stats.completedCount)}
              icon={<CircleCheck size={18} />}
              tone="success"
            />
            <StatCard
              label="Sản phẩm đang quản lý"
              value={formatNumber(stats.productCount)}
              tone="accent"
            />
          </section>
          {stats.simulated ? (
            <p className="mp-note">
              <Badge tone="info">Mô phỏng</Badge> Số liệu doanh thu mô phỏng, không đại diện số tiền
              đã đối soát.
            </p>
          ) : null}
        </>
      )}

      <RevenuePanel
        groupBy={revenue.groupBy}
        onGroupByChange={revenue.setGroupBy}
        series={revenue.series}
        loading={revenue.loading}
        error={revenue.error}
        showTable
      />
    </div>
  );
}
