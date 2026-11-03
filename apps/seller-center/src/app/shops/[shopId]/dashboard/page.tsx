"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Badge,
  Box,
  CircleCheck,
  Clock,
  DataTable,
  formatNumber,
  formatVnd,
  PageHeader,
  Panel,
  ReceiptText,
  Skeleton,
  StatCard,
  StatusBadge,
  sellerOrderStatuses,
  TrendingUp,
  useApi,
  Wallet,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { SellerPart, SellerStats } from "../../../../lib/types";
import { RangeForm } from "../../../../features/dashboard/range-form";
import { RevenuePanel, useSellerRevenue } from "../../../../features/dashboard/revenue-panel";
import { useSellerRange } from "../../../../features/dashboard/seller-range";

export default function DashboardPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const router = useRouter();
  const { api } = useApi();
  const { draftFrom, draftTo, setDraftFrom, setDraftTo, range, rangeError, applyRange } =
    useSellerRange(30);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [recent, setRecent] = useState<SellerPart[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const revenue = useSellerRevenue({ api, shopId, range });

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

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError("");
    try {
      setRecent(await api.request<SellerPart[]>(`/shops/${shopId}/orders?pageSize=5` as ApiPath));
    } catch (cause) {
      setRecentError(normalizeFormError(cause));
    } finally {
      setRecentLoading(false);
    }
  }, [api, shopId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  const columns: DataTableColumn<SellerPart>[] = [
    {
      key: "order",
      header: "Đơn",
      render: (row) => (
        <span className="mp-table__primary">
          {row.id.slice(0, 8)}…<span className="mp-muted"> · {row.items.length} sản phẩm</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => <StatusBadge status={row.status} map={sellerOrderStatuses} />,
    },
    {
      key: "total",
      header: "Giá trị",
      numeric: true,
      render: (row) => formatVnd(row.originalTotal),
    },
  ];

  return (
    <div className="mp-page">
      <PageHeader
        title="Tổng quan cửa hàng"
        description="Nắm nhanh đơn cần xử lý, doanh thu hoàn tất và nhịp bán hàng trong khoảng thời gian bạn chọn."
        actions={
          <Link className="mp-button mp-button--secondary mp-button--md" href={`/shops/${shopId}/orders`}>
            <ReceiptText size={16} aria-hidden="true" />
            <span className="mp-button__label">Mở hàng đợi đơn</span>
          </Link>
        }
      />

      <Panel title="Khoảng thời gian" description="Áp dụng cho số liệu bên dưới.">
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
          <span className="mp-visually-hidden">Đang tải thống kê…</span>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="mp-skeleton--block" />
          ))}
        </div>
      ) : (
        <>
          <section aria-label="Thống kê cửa hàng" className="mp-kpi-grid">
            <StatCard
              label="Sản phẩm"
              value={formatNumber(stats.productCount)}
              icon={<Box size={18} />}
              tone="accent"
            />
            <StatCard
              label="Chờ xác nhận"
              value={formatNumber(stats.pendingCount)}
              icon={<Clock size={18} />}
              tone="warning"
            />
            <StatCard
              label="Đang xử lý"
              value={formatNumber(stats.processingCount)}
              icon={<ReceiptText size={18} />}
              tone="info"
            />
            <StatCard
              label="Hoàn thành"
              value={formatNumber(stats.completedCount)}
              icon={<CircleCheck size={18} />}
              tone="success"
            />
            <StatCard
              label="Doanh thu hoàn tất"
              value={formatVnd(stats.completedRevenue)}
              detail={stats.simulated ? "Số liệu mô phỏng" : undefined}
              icon={<Wallet size={18} />}
              tone="success"
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

      <div className="mp-dashboard-grid">
        <RevenuePanel
          groupBy={revenue.groupBy}
          onGroupByChange={revenue.setGroupBy}
          series={revenue.series}
          loading={revenue.loading}
          error={revenue.error}
        />
        <Panel
          title="Cần xử lý"
          description="Các đơn gần nhất của cửa hàng."
          actions={
            <Link className="mp-link" href={`/shops/${shopId}/orders`}>
              Xem tất cả <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
          flush
        >
          <DataTable
            columns={columns}
            rows={recent}
            rowKey={(row) => row.id}
            caption="Đơn hàng gần nhất"
            loading={recentLoading}
            error={recentError || null}
            onRetry={() => void loadRecent()}
            onRowClick={() => router.push(`/shops/${shopId}/orders`)}
            dense
            empty={
              <div className="mp-panel__pad">
                <p className="mp-muted">Chưa có đơn hàng nào.</p>
              </div>
            }
          />
        </Panel>
      </div>

      <div className="mp-quick-links">
        <Link className="mp-quick-link" href={`/shops/${shopId}/analytics`}>
          <TrendingUp size={18} aria-hidden="true" />
          <span>
            <strong>Phân tích doanh thu</strong>
            <span className="mp-muted">Xem theo tháng và bảng kỳ</span>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className="mp-quick-link" href={`/shops/${shopId}/reviews`}>
          <Badge tone="accent">Mới</Badge>
          <span>
            <strong>Đánh giá của người mua</strong>
            <span className="mp-muted">Lọc theo sản phẩm và số sao</span>
          </span>
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
