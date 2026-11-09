"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Avatar,
  Badge,
  Button,
  DataTable,
  Dialog,
  PageHeader,
  Pagination,
  Panel,
  SelectField,
  StatusBadge,
  TextField,
  TextareaField,
  useApi,
  userStatuses,
  formatDateTime,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";

type AdminUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  status: "ACTIVE" | "LOCKED";
  version: number;
  roles: string[];
  createdAt?: string;
};

const pageSize = 20;

export default function AdminUsersPage() {
  const { api } = useApi();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [applied, setApplied] = useState({ q: "", status: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<{ target: AdminUser; action: "lock" | "unlock" } | null>(
    null,
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.status) params.set("status", applied.status);
    try {
      setUsers(await api.request<AdminUser[]>(`/admin/users?${params}` as ApiPath));
    } catch (cause) {
      setUsers([]);
      setError(normalizeFormError(cause));
    } finally {
      setLoading(false);
    }
  }, [api, applied, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ q, status });
  }

  async function changeState() {
    if (!pending) return;
    setBusy(pending.target.id);
    setError("");
    try {
      await api.request(`/admin/users/${pending.target.id}/${pending.action}` as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          reason: reason.trim(),
          expectedVersion: pending.target.version,
        }),
      });
      setPending(null);
      setReason("");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "Tài khoản vừa thay đổi. Danh sách đã tải lại; hãy kiểm tra phiên bản mới.",
        );
        setPending(null);
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy("");
    }
  }

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: "user",
      header: "Người dùng",
      render: (row) => (
        <div className="mp-table__identity">
          <Avatar name={row.fullName} size="sm" />
          <span>
            <span className="mp-table__primary">{row.fullName}</span>
            <span className="mp-muted mp-table__secondary">{row.email}</span>
          </span>
        </div>
      ),
    },
    {
      key: "roles",
      header: "Vai trò",
      render: (row) => (
        <span className="mp-inline">
          {row.roles.length ? (
            row.roles.map((role) => (
              <Badge key={role} tone={role === "ADMIN" ? "accent" : "neutral"}>
                {role}
              </Badge>
            ))
          ) : (
            <span className="mp-muted">—</span>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => (
        <div className="mp-table__stack">
          <StatusBadge status={row.status} map={userStatuses} />
          <span className="mp-muted mp-table__secondary">
            {row.status} · version {row.version}
          </span>
        </div>
      ),
    },
    {
      key: "created",
      header: "Tham gia",
      render: (row) =>
        row.createdAt ? formatDateTime(row.createdAt) : <span className="mp-muted">—</span>,
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) =>
        row.status === "ACTIVE" ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setReason("");
              setPending({ target: row, action: "lock" });
            }}
          >
            Khóa
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setReason("");
              setPending({ target: row, action: "unlock" });
            }}
          >
            Mở khóa
          </Button>
        ),
    },
  ];

  const hasNext = users.length === pageSize;
  const pageCount = page + (hasNext ? 1 : 0);

  return (
    <div className="mp-page mp-admin-page">
      <PageHeader
        title="Quản lý người dùng"
        description="Tìm kiếm tài khoản, kiểm tra vai trò và khóa hoặc mở khóa khi cần."
      />

      <Panel className="mp-admin-filters" title="Bộ lọc" description="Lọc theo tên, email hoặc trạng thái.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Tìm kiếm người dùng"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tên hoặc email"
            />
            <SelectField
              label="Lọc trạng thái người dùng"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Đã khóa</option>
            </SelectField>
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={loading}>
              Tìm
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Danh sách người dùng"
        description={loading ? undefined : `${users.length} kết quả trên trang này`}
        flush
      >
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(row) => row.id}
          caption="Danh sách người dùng"
          loading={loading}
          error={error || null}
          onRetry={() => void refresh()}
          empty={
            <div className="mp-panel__pad">
              <p className="mp-muted">Không tìm thấy người dùng phù hợp.</p>
            </div>
          }
          footer={
            <div className="mp-panel__pad">
              <Pagination page={page} pageCount={pageCount} pageSize={pageSize} onPageChange={setPage} />
            </div>
          }
        />
      </Panel>

      <Dialog
        open={Boolean(pending)}
        onClose={() => {
          setPending(null);
          setReason("");
        }}
        title={pending?.action === "unlock" ? "Mở khóa tài khoản" : "Khóa tài khoản"}
        description={
          pending
            ? `${pending.target.email} · version ${pending.target.version}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPending(null);
                setReason("");
              }}
            >
              Hủy
            </Button>
            <Button
              variant={pending?.action === "unlock" ? "primary" : "danger"}
              disabled={!reason.trim()}
              loading={Boolean(busy)}
              onClick={() => void changeState()}
            >
              {pending?.action === "unlock" ? "Xác nhận mở khóa" : "Xác nhận khóa"}
            </Button>
          </>
        }
      >
        {pending ? (
          <TextareaField
            label={`Lý do ${pending.target.email}`}
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={500}
            rows={3}
            hint="Lý do được ghi vào nhật ký quản trị."
          />
        ) : null}
      </Dialog>
    </div>
  );
}
