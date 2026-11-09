"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  OrderRail,
  orderRailCurrent,
  orderRailSteps,
  PageHeader,
  Pagination,
  Panel,
  SelectField,
  StatusBadge,
  TextField,
  paymentStatuses,
  sellerOrderStatuses,
  useApi,
  usePolling,
  formatDateTime,
  formatVnd,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  partiallyCancelled: boolean;
  originalTotal: string;
  outstandingAmount: string;
  paymentStatus: string;
  createdAt: string;
};

const pageSize = 20;

const emptyFilters = { q: "", buyerId: "", shopId: "", status: "", from: "", to: "" };

export default function AdminOrdersPage() {
  const { api } = useApi();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      for (const [key, value] of Object.entries(applied)) {
        if (!value.trim()) continue;
        params.set(
          key,
          key === "from" || key === "to" ? new Date(value).toISOString() : value.trim(),
        );
      }
      try {
        setOrders(await api.request<OrderSummary[]>(`/admin/orders?${params}` as ApiPath));
      } catch (cause) {
        if (!silent) {
          setOrders([]);
          setError(normalizeFormError(cause));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, applied, page],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(refresh, { intervalMs: 30_000, pauseWhile: loading });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  const columns: DataTableColumn<OrderSummary>[] = [
    {
      key: "order",
      header: "Đơn hàng",
      render: (row) => (
        <span className="mp-table__stack">
          <Link className="mp-link" href={`/orders/${row.id}`}>
            {row.orderNumber}
          </Link>
          <span className="mp-muted mp-table__secondary">{formatDateTime(row.createdAt)}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => (
        <div className="mp-table__stack">
          <StatusBadge status={row.status} map={sellerOrderStatuses} />
          {row.partiallyCancelled ? (
            <Badge tone="warning">Hủy một phần</Badge>
          ) : null}
        </div>
      ),
    },
    {
      key: "timeline",
      header: "Tiến trình",
      render: (row) => (
        <OrderRail
          className="mp-rail--compact"
          label={`Tiến trình đơn ${row.orderNumber}`}
          steps={orderRailSteps(row.status, { compact: true })}
          currentId={orderRailCurrent(row.status)}
        />
      ),
    },
    {
      key: "payment",
      header: "Thanh toán",
      render: (row) => <StatusBadge status={row.paymentStatus} map={paymentStatuses} />,
    },
    {
      key: "total",
      header: "Tổng tiền",
      align: "right",
      render: (row) => <span data-numeric>{formatVnd(row.originalTotal)}</span>,
    },
    {
      key: "outstanding",
      header: "Còn phải thu",
      align: "right",
      render: (row) => (
        <span className="mp-muted" data-numeric>
          {formatVnd(row.outstandingAmount)}
        </span>
      ),
    },
  ];

  const hasNext = orders.length === pageSize;
  const pageCount = page + (hasNext ? 1 : 0);

  return (
    <div className="mp-page mp-admin-page">
      <PageHeader
        title="Tra cứu đơn hàng"
        description="Chế độ chỉ đọc. Mở chi tiết để xem thanh toán, vận chuyển và thực hiện recovery khi cần."
      />

      <Panel className="mp-admin-filters" title="Bộ lọc" description="Lọc theo mã đơn, người mua, cửa hàng, trạng thái hoặc thời gian.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Tìm kiếm đơn hàng"
              name="q"
              value={filters.q}
              onChange={(event) => setFilters({ ...filters, q: event.target.value })}
              placeholder="Mã đơn hoặc người mua"
            />
            <TextField
              label="Buyer ID"
              name="buyerId"
              value={filters.buyerId}
              onChange={(event) => setFilters({ ...filters, buyerId: event.target.value })}
            />
            <TextField
              label="Shop ID"
              name="shopId"
              value={filters.shopId}
              onChange={(event) => setFilters({ ...filters, shopId: event.target.value })}
            />
            <SelectField
              label="Lọc trạng thái đơn"
              name="status"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value })}
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(sellerOrderStatuses).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Đơn từ ngày"
              name="from"
              type="datetime-local"
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            />
            <TextField
              label="Đơn đến ngày"
              name="to"
              type="datetime-local"
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            />
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={loading}>
              Tìm đơn
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setFilters(emptyFilters);
                setApplied(emptyFilters);
                setPage(1);
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Danh sách đơn hàng"
        description={loading ? undefined : `${orders.length} kết quả trên trang này`}
        flush
      >
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(row) => row.id}
          caption="Danh sách đơn hàng"
          loading={loading}
          error={error || null}
          onRetry={() => void refresh()}
          empty={
            <div className="mp-panel__pad">
              <EmptyState
                title="Không có đơn phù hợp"
                description="Điều chỉnh bộ lọc hoặc khoảng thời gian rồi thử lại."
              />
            </div>
          }
          footer={
            <div className="mp-panel__pad">
              <Pagination
                page={page}
                pageCount={pageCount}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          }
        />
      </Panel>
    </div>
  );
}
