"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  PageHeader,
  Panel,
  Pagination,
  StatusBadge,
  Store,
  Tabs,
  TextareaField,
  shopStatuses,
  useApi,
  usePolling,
  formatDateTime,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";

type Shop = {
  id: string;
  name: string;
  slug: string;
  status: string;
  description: string;
  rejectionReason: string | null;
  version: number;
  logo: { url: string } | null;
  createdAt: string;
};

type ShopAction = "approve" | "reject" | "suspend" | "resume";

const pageSize = 20;

const actionLabels: Record<ShopAction, string> = {
  approve: "Duyệt cửa hàng",
  reject: "Từ chối cửa hàng",
  suspend: "Tạm ngưng cửa hàng",
  resume: "Khôi phục cửa hàng",
};

const confirmLabels: Record<ShopAction, string> = {
  approve: "Xác nhận duyệt",
  reject: "Xác nhận từ chối",
  suspend: "Xác nhận tạm ngưng",
  resume: "Xác nhận khôi phục",
};

export default function ShopQueuePage() {
  const { api } = useApi();
  const [shops, setShops] = useState<Shop[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<{ shop: Shop; action: ShopAction } | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setLoading(true);
        setError("");
      }
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (status) params.set("status", status);
      try {
        const { data, meta } = await api.requestEnvelope<Shop[]>(
          `/admin/shops?${params}` as ApiPath,
        );
        setShops(data);
        setTotal(meta?.total ?? null);
      } catch (cause) {
        if (!silent) {
          setShops([]);
          setTotal(null);
          setError(normalizeFormError(cause));
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, page, status],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(refresh, {
    intervalMs: 30_000,
    pauseWhile: busy || pending !== null,
  });

  async function run(shop: Shop, action: ShopAction) {
    setBusy(true);
    setError("");
    try {
      const body =
        action === "approve"
          ? { expectedVersion: shop.version }
          : { expectedVersion: shop.version, reason: reason.trim() };
      await api.request(`/admin/shops/${shop.id}/${action}` as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      setPending(null);
      setReason("");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "Hồ sơ vừa được xử lý ở nơi khác. Danh sách đã tải lại; hãy kiểm tra trạng thái mới.",
        );
        setPending(null);
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<Shop>[] = [
    {
      key: "shop",
      header: "Cửa hàng",
      render: (row) => (
        <div className="mp-table__identity">
          <Avatar name={row.name} src={row.logo?.url} size="sm" />
          <span className="mp-table__stack">
            <strong>{row.name}</strong>
            <span className="mp-muted mp-table__secondary">/{row.slug}</span>
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (row) => <StatusBadge status={row.status} map={shopStatuses} />,
    },
    {
      key: "description",
      header: "Giới thiệu",
      render: (row) => (
        <span className="mp-muted">{row.description || "Chưa có mô tả"}</span>
      ),
    },
    {
      key: "created",
      header: "Gửi lúc",
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) => (
        <span className="mp-table__actions">
          {row.status === "PENDING" ? (
            <>
              <Button
                size="sm"
                onClick={() => {
                  setReason("");
                  setPending({ shop: row, action: "approve" });
                }}
              >
                Duyệt
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  setReason("");
                  setPending({ shop: row, action: "reject" });
                }}
              >
                Từ chối
              </Button>
            </>
          ) : null}
          {row.status === "ACTIVE" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReason("");
                setPending({ shop: row, action: "suspend" });
              }}
            >
              Tạm ngưng
            </Button>
          ) : null}
          {row.status === "SUSPENDED" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setReason("");
                setPending({ shop: row, action: "resume" });
              }}
            >
              Khôi phục
            </Button>
          ) : null}
        </span>
      ),
    },
  ];

  const pageCount = total === null ? page : Math.max(1, Math.ceil(total / pageSize));
  const needsReason = pending ? pending.action !== "approve" : false;

  return (
    <div className="mp-page">
      <PageHeader
        title="Duyệt cửa hàng"
        description="Kiểm tra hồ sơ đăng ký, phê duyệt hoặc tạm ngưng cửa hàng kèm lý do được ghi vào nhật ký."
      />

      <Tabs
        label="Lọc cửa hàng theo trạng thái"
        value={status}
        onChange={(key) => {
          setPage(1);
          setStatus(key);
        }}
        items={[
          { key: "", label: "Tất cả" },
          { key: "PENDING", label: "Chờ duyệt" },
          { key: "ACTIVE", label: "Đang hoạt động" },
          { key: "REJECTED", label: "Bị từ chối" },
          { key: "SUSPENDED", label: "Tạm khóa" },
        ]}
      />

      <Panel
        className="mp-reveal"
        title="Hồ sơ cửa hàng"
        description={
          loading ? undefined : `${total ?? shops.length} hồ sơ trong bộ lọc hiện tại`
        }
        flush
      >
        <DataTable
          columns={columns}
          rows={shops}
          rowKey={(row) => row.id}
          caption="Hồ sơ cửa hàng"
          loading={loading}
          error={error || null}
          onRetry={() => void refresh()}
          empty={
            <div className="mp-panel__pad">
              <EmptyState
                icon={<Store size={22} />}
                title="Không có hồ sơ phù hợp"
                description="Thử đổi bộ lọc trạng thái để xem các hồ sơ khác."
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
        open={Boolean(pending)}
        onClose={() => {
          setPending(null);
          setReason("");
        }}
        title={pending ? actionLabels[pending.action] : ""}
        description={
          pending ? `${pending.shop.name} · /${pending.shop.slug} · version ${pending.shop.version}` : undefined
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
              variant={pending?.action === "reject" || pending?.action === "suspend" ? "danger" : "primary"}
              disabled={needsReason && !reason.trim()}
              loading={busy}
              onClick={() => pending && void run(pending.shop, pending.action)}
            >
              {pending ? confirmLabels[pending.action] : "Xác nhận"}
            </Button>
          </>
        }
      >
        {pending ? (
          needsReason ? (
            <TextareaField
              label={`Lý do ${pending.shop.name}`}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
              rows={3}
              hint="Lý do được ghi vào nhật ký quản trị."
            />
          ) : (
            <p>
              Hồ sơ sẽ chuyển sang trạng thái hoạt động và người bán có thể bắt đầu niêm yết sản
              phẩm.
            </p>
          )
        ) : null}
      </Dialog>
    </div>
  );
}
