"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  PageHeader,
  Pagination,
  Panel,
  TextField,
  ScrollText,
  useApi,
  usePolling,
  formatDateTime,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { normalizeFormError, type ApiPath } from "@marketplace/api-client";

type Audit = {
  id: string;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string | null;
  requestId: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

const pageSize = 20;
const emptyFilters = { resourceType: "", resourceId: "", actorId: "", from: "", to: "" };

export default function AdminAuditPage() {
  const { api } = useApi();
  const [rows, setRows] = useState<Audit[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inspect, setInspect] = useState<Audit | null>(null);

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
        setRows(await api.request<Audit[]>(`/admin/audit?${params}` as ApiPath));
      } catch (cause) {
        if (!silent) {
          setRows([]);
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

  usePolling(refresh, { intervalMs: 60_000, pauseWhile: inspect !== null });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  }

  const columns: DataTableColumn<Audit>[] = [
    {
      key: "action",
      header: "Hành động",
      render: (row) => (
        <span className="mp-table__stack">
          <span className="mp-table__primary">{row.action}</span>
          <span className="mp-muted mp-table__secondary">
            {`${row.reason ?? "Không có lý do"} · ${formatDateTime(row.createdAt)}`}
          </span>
        </span>
      ),
    },
    {
      key: "resource",
      header: "Tài nguyên",
      render: (row) => (
        <span className="mp-table__stack">
          <Badge tone="neutral">{row.resourceType}</Badge>
          <span className="mp-code">{row.resourceId}</span>
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      render: (row) => (
        <span className="mp-muted">{row.actorId ?? "system"}</span>
      ),
    },
    {
      key: "request",
      header: "Request",
      render: (row) => (
        <span className="mp-code">{row.requestId.slice(0, 8)}…</span>
      ),
    },
    {
      key: "inspect",
      header: "",
      align: "right",
      render: (row) => (
        <Button size="sm" variant="ghost" onClick={() => setInspect(row)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  const hasNext = rows.length === pageSize;
  const pageCount = page + (hasNext ? 1 : 0);

  return (
    <div className="mp-page mp-admin-page">
      <PageHeader
        title="Nhật ký quản trị"
        description="Nhật ký bất biến. Metadata chỉ được xem trong hộp thoại chi tiết."
      />

      <Panel className="mp-admin-filters" title="Bộ lọc" description="Lọc theo tài nguyên, actor hoặc thời gian.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Lọc loại tài nguyên"
              name="resourceType"
              value={filters.resourceType}
              onChange={(event) =>
                setFilters({ ...filters, resourceType: event.target.value })
              }
              placeholder="Product, User, SellerOrder…"
            />
            <TextField
              label="Mã tài nguyên"
              name="resourceId"
              value={filters.resourceId}
              onChange={(event) =>
                setFilters({ ...filters, resourceId: event.target.value })
              }
            />
            <TextField
              label="Actor ID"
              name="actorId"
              value={filters.actorId}
              onChange={(event) => setFilters({ ...filters, actorId: event.target.value })}
            />
            <TextField
              label="Từ ngày"
              name="from"
              type="datetime-local"
              value={filters.from}
              onChange={(event) => setFilters({ ...filters, from: event.target.value })}
            />
            <TextField
              label="Đến ngày"
              name="to"
              type="datetime-local"
              value={filters.to}
              onChange={(event) => setFilters({ ...filters, to: event.target.value })}
            />
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={loading}>
              Lọc
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
        className="mp-reveal"
        title="Bản ghi nhật ký"
        description={loading ? undefined : `${rows.length} bản ghi trên trang này`}
        flush
      >
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          caption="Nhật ký quản trị"
          loading={loading}
          error={error || null}
          onRetry={() => void refresh()}
          empty={
            <div className="mp-panel__pad">
              <EmptyState
                icon={<ScrollText size={22} />}
                title="Chưa có bản ghi phù hợp"
                description="Thử nới rộng khoảng thời gian hoặc bỏ một vài bộ lọc."
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

      <Dialog
        open={Boolean(inspect)}
        onClose={() => setInspect(null)}
        title={inspect?.action ?? ""}
        description={inspect ? `${inspect.resourceType} · ${inspect.resourceId}` : undefined}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setInspect(null)}>
            Đóng
          </Button>
        }
      >
        {inspect ? (
          <>
            <dl className="mp-summary-grid">
              <div>
                <dt>Thời điểm</dt>
                <dd className="mp-summary-grid__plain">{formatDateTime(inspect.createdAt)}</dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd className="mp-summary-grid__plain">{inspect.actorId ?? "system"}</dd>
              </div>
            </dl>
            <p className="mp-muted">
              {`${inspect.reason ?? "Không có lý do"} · Request ${inspect.requestId}`}
            </p>
            <pre className="mp-code mp-code--block">
              {JSON.stringify(inspect.metadata, null, 2)}
            </pre>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
