"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Badge,
  BarChart3,
  CircleDollarSign,
  DataTable,
  EmptyState,
  Package,
  PageHeader,
  Panel,
  ReceiptText,
  ScrollText,
  Shield,
  Skeleton,
  StatCard,
  StatusBadge,
  Store,
  formatDateTime,
  formatNumber,
  formatVnd,
  shopStatuses,
  useApi,
  usePolling,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";

type AdminStats = {
  userCount: number;
  shopCount: number;
  productCount: number;
  orderCount: number;
  completedSellerOrderValue: string;
  simulated?: boolean;
  from: string;
  to: string;
  countsByStatus: Record<string, Record<string, number>>;
};

type PendingShop = {
  id: string;
  name: string;
  slug: string;
  status: string;
  version: number;
  createdAt: string;
};

type AuditRow = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
};

function rangeParams(): string {
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return new URLSearchParams({
    from: from.toISOString(),
    to: now.toISOString(),
  }).toString();
}

export default function AdminDashboardPage() {
  const { api, status } = useApi();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState("");
  const [shops, setShops] = useState<PendingShop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState("");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");
  const [rangeQuery] = useState(rangeParams);

  const loadStats = useCallback(
    async (options?: { silent?: boolean }) => {
      if (status !== "authenticated") return;
      const silent = options?.silent === true;
      if (!silent) setStatsError("");
      try {
        setStats(await api.request<AdminStats>(`/admin/stats?${rangeQuery}` as ApiPath));
      } catch (cause) {
        if (!silent) setStatsError(normalizeFormError(cause));
      }
    },
    [api, rangeQuery, status],
  );

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const loadShops = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setShopsLoading(true);
        setShopsError("");
      }
      try {
        const result = await api.request<PendingShop[]>(
          "/admin/shops?status=PENDING&page=1&pageSize=5" as ApiPath,
        );
        setShops(result);
      } catch (cause) {
        if (!silent) setShopsError(normalizeFormError(cause));
      } finally {
        if (!silent) setShopsLoading(false);
      }
    },
    [api],
  );

  const loadAudit = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setAuditLoading(true);
        setAuditError("");
      }
      try {
        setAudit(await api.request<AuditRow[]>("/admin/audit?pageSize=8" as ApiPath));
      } catch (cause) {
        if (!silent) setAuditError(normalizeFormError(cause));
      } finally {
        if (!silent) setAuditLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    void Promise.all([loadShops(), loadAudit()]);
  }, [loadAudit, loadShops, status]);

  const refreshDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      await Promise.all([loadStats(options), loadShops(options), loadAudit(options)]);
    },
    [loadAudit, loadShops, loadStats],
  );

  usePolling(refreshDashboard, {
    intervalMs: 60_000,
    enabled: status === "authenticated",
  });

  const shopColumns: DataTableColumn<PendingShop>[] = [
    {
      key: "shop",
      header: "Cửa hàng",
      render: (row) => (
        <span className="mp-table__primary">
          {row.name}
          <span className="mp-muted"> · /{row.slug}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => <StatusBadge status={row.status} map={shopStatuses} />,
    },
    {
      key: "createdAt",
      header: "Gửi lúc",
      render: (row) => formatDateTime(row.createdAt),
    },
  ];

  const auditColumns: DataTableColumn<AuditRow>[] = [
    {
      key: "action",
      header: "Hành động",
      render: (row) => <span className="mp-table__primary">{row.action}</span>,
    },
    {
      key: "resource",
      header: "Tài nguyên",
      render: (row) => (
        <span className="mp-muted">
          {row.resourceType} · {row.resourceId.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "reason",
      header: "Lý do",
      render: (row) => row.reason ?? "Không có lý do",
    },
    {
      key: "createdAt",
      header: "Thời điểm",
      render: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="mp-page mp-admin-page mp-admin-dashboard">
      <PageHeader
        title="Tổng quan nền tảng"
        description="Theo dõi hồ sơ chờ duyệt, hàng hoàn và hoạt động trên toàn Marketplace."
        actions={
          <Link
            className="mp-button mp-button--secondary mp-button--md"
            href="/orders/returns"
          >
            <span className="mp-button__label">Xác nhận hàng hoàn</span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      <Panel
        className="mp-admin-queue"
        title="Cửa hàng chờ duyệt"
        description="Hồ sơ mới nhất cần quyết định."
        actions={
          <Link className="mp-link" href="/shops">
            Xem tất cả <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
        flush
      >
        <DataTable
          columns={shopColumns}
          rows={shops}
          rowKey={(row) => row.id}
          caption="Cửa hàng chờ duyệt"
          loading={shopsLoading}
          error={shopsError || null}
          onRetry={() => void loadShops()}
          dense
          empty={
            <div className="mp-panel__pad">
              <EmptyState
                icon={<Store size={22} />}
                title="Không có hồ sơ chờ duyệt"
                description="Mọi hồ sơ cửa hàng đã được xử lý."
              />
            </div>
          }
        />
      </Panel>

      {statsError ? (
        <p role="alert" className="mp-alert-inline">
          {statsError}
        </p>
      ) : !stats ? (
        <div className="mp-kpi-grid mp-admin-kpis" role="status">
          <span className="mp-visually-hidden">
            Đang tải thống kê nền tảng…
          </span>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="mp-skeleton--block" />
          ))}
        </div>
      ) : (
        <>
          <section
            aria-label="Thống kê nền tảng"
            className="mp-kpi-grid mp-admin-kpis"
          >
            <StatCard
              label="Người dùng"
              value={formatNumber(stats.userCount)}
              icon={<Shield size={18} />}
              tone="accent"
            />
            <StatCard
              label="Cửa hàng"
              value={formatNumber(stats.shopCount)}
              icon={<Store size={18} />}
              tone="info"
            />
            <StatCard
              label="Sản phẩm"
              value={formatNumber(stats.productCount)}
              icon={<Package size={18} />}
              tone="warning"
            />
            <StatCard
              label="Đơn hàng"
              value={formatNumber(stats.orderCount)}
              icon={<ReceiptText size={18} />}
              tone="success"
            />
            <StatCard
              label="Giá trị seller order hoàn tất"
              value={formatVnd(stats.completedSellerOrderValue)}
              detail={stats.simulated ? "Số liệu mô phỏng" : undefined}
              icon={<CircleDollarSign size={18} />}
              tone="success"
            />
          </section>
          {stats.simulated ? (
            <p className="mp-note">
              <Badge tone="info">Mô phỏng</Badge> Số liệu doanh thu mô phỏng,
              không đại diện số tiền đã đối soát.
            </p>
          ) : null}
        </>
      )}

      <div className="mp-admin-dashboard__work">
        <Panel
          className="mp-admin-section mp-admin-audit"
          title="Hoạt động gần đây"
          description="8 bản ghi nhật ký quản trị mới nhất."
          actions={
            <Link className="mp-link" href="/audit">
              Mở nhật ký <ArrowRight size={14} aria-hidden="true" />
            </Link>
          }
          flush
        >
          <DataTable
            columns={auditColumns}
            rows={audit}
            rowKey={(row) => row.id}
            caption="Hoạt động quản trị gần đây"
            loading={auditLoading}
            error={auditError || null}
            onRetry={() => void loadAudit()}
            dense
            empty={
              <div className="mp-panel__pad">
                <EmptyState
                  icon={<ScrollText size={22} />}
                  title="Chưa có hoạt động"
                  description="Các thao tác quản trị sẽ được ghi lại tại đây."
                />
              </div>
            }
          />
        </Panel>
        <div className="mp-admin-distribution">
          <Panel
            className="mp-admin-section"
            title="Phân bố trạng thái"
            description="Số lượng bản ghi theo từng trạng thái trong toàn hệ thống."
            actions={<BarChart3 size={18} aria-hidden="true" />}
          >
            {!stats ? (
              <Skeleton className="mp-skeleton--block" />
            ) : Object.keys(stats.countsByStatus).length === 0 ? (
              <EmptyState
                title="Chưa có dữ liệu trạng thái"
                description="Hệ thống chưa trả về số lượng theo trạng thái cho khoảng thời gian này."
              />
            ) : (
              <div className="mp-status-bars">
                {Object.entries(stats.countsByStatus).map(
                  ([entity, values]) => {
                    const total = Object.values(values).reduce(
                      (sum, value) => sum + value,
                      0,
                    );
                    return (
                      <section
                        className="mp-status-bars__group"
                        key={entity}
                        aria-label={entity}
                      >
                        <header>
                          <strong>{entity}</strong>
                          <span className="mp-muted">
                            {formatNumber(total)} bản ghi
                          </span>
                        </header>
                        {Object.entries(values).length === 0 ? (
                          <p className="mp-muted">Chưa có bản ghi</p>
                        ) : (
                          <ul>
                            {Object.entries(values).map(
                              ([statusKey, count]) => (
                                <li key={statusKey}>
                                  <span className="mp-status-bars__label">
                                    {statusKey}
                                  </span>
                                  <span className="mp-status-bars__track">
                                    <span
                                      className="mp-status-bars__fill"
                                      style={{
                                        width: `${total ? (count / total) * 100 : 0}%`,
                                      }}
                                    />
                                  </span>
                                  <span
                                    className="mp-status-bars__value"
                                    data-numeric
                                  >
                                    {formatNumber(count)}
                                  </span>
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </section>
                    );
                  },
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
