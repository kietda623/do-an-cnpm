"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  PageHeader,
  Panel,
  Pagination,
  SelectField,
  StatusBadge,
  TextField,
  TextareaField,
  productStatuses,
  useApi,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";

type Product = {
  id: string;
  shopId: string;
  name: string;
  description: string;
  selling: boolean;
  adminHidden: boolean;
  hiddenReason: string | null;
  version: number;
  minimumPrice: string | null;
  createdAt?: string;
};

const pageSize = 20;

export default function AdminProductsPage() {
  const { api } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [shopId, setShopId] = useState("");
  const [hidden, setHidden] = useState("");
  const [applied, setApplied] = useState({ q: "", shopId: "", hidden: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Product | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.shopId.trim()) params.set("shopId", applied.shopId.trim());
    if (applied.hidden) params.set("adminHidden", applied.hidden);
    try {
      setProducts(await api.request<Product[]>(`/admin/products?${params}` as ApiPath));
    } catch (cause) {
      setProducts([]);
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
    setApplied({ q, shopId, hidden });
  }

  async function hide(product: Product) {
    setBusy(true);
    setError("");
    try {
      await api.request(`/admin/products/${product.id}/hide` as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ reason: reason.trim(), expectedVersion: product.version }),
      });
      setPending(null);
      setReason("");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Sản phẩm vừa thay đổi. Danh sách đã tải lại; hãy kiểm tra phiên bản mới.");
        setPending(null);
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  const columns: DataTableColumn<Product>[] = [
    {
      key: "product",
      header: "Sản phẩm",
      render: (row) => (
        <span className="mp-table__stack">
          <span className="mp-table__primary">{row.name}</span>
          <span className="mp-muted mp-table__secondary">
            shop {row.shopId} · version {row.version}
          </span>
        </span>
      ),
    },
    {
      key: "selling",
      header: "Niêm yết",
      render: (row) => (
        <StatusBadge status={row.selling ? "ACTIVE" : "DISCONTINUED"} map={productStatuses} />
      ),
    },
    {
      key: "moderation",
      header: "Kiểm duyệt",
      render: (row) => (
        <div className="mp-table__stack">
          <Badge tone={row.adminHidden ? "danger" : "success"}>
            {row.adminHidden ? "Đã ẩn" : "Công khai"}
          </Badge>
          {row.hiddenReason ? (
            <span className="mp-muted mp-table__secondary">Lý do ẩn: {row.hiddenReason}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "price",
      header: "Giá thấp nhất",
      align: "right",
      render: (row) => (
        <span data-numeric>{row.minimumPrice ? `${row.minimumPrice} VND` : "Chưa có"}</span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (row) =>
        row.adminHidden ? (
          <span className="mp-muted">Đã ẩn</span>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setReason("");
              setPending(row);
            }}
          >
            Ẩn sản phẩm
          </Button>
        ),
    },
  ];

  const hasNext = products.length === pageSize;
  const pageCount = page + (hasNext ? 1 : 0);

  return (
    <div className="mp-page">
      <PageHeader
        title="Kiểm duyệt sản phẩm"
        description="Rà soát sản phẩm trên toàn sàn và ẩn những niêm yết vi phạm chính sách."
      />

      <Panel title="Bộ lọc" description="Tìm theo tên, cửa hàng hoặc trạng thái kiểm duyệt.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Tìm kiếm sản phẩm"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tên sản phẩm"
            />
            <TextField
              label="Shop ID sản phẩm"
              name="shopId"
              value={shopId}
              onChange={(event) => setShopId(event.target.value)}
              placeholder="UUID cửa hàng"
            />
            <SelectField
              label="Lọc sản phẩm ẩn"
              name="adminHidden"
              value={hidden}
              onChange={(event) => setHidden(event.target.value)}
            >
              <option value="">Tất cả</option>
              <option value="false">Đang hiển thị</option>
              <option value="true">Đã ẩn</option>
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
        title="Danh sách sản phẩm"
        description={loading ? undefined : `${products.length} kết quả trên trang này`}
        flush
      >
        <DataTable
          columns={columns}
          rows={products}
          rowKey={(row) => row.id}
          caption="Danh sách sản phẩm cần kiểm duyệt"
          loading={loading}
          error={error || null}
          onRetry={() => void refresh()}
          empty={
            <div className="mp-panel__pad">
              <EmptyState
                title="Không có sản phẩm phù hợp"
                description="Thử đổi từ khóa hoặc bộ lọc kiểm duyệt."
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
        title="Ẩn sản phẩm"
        description={pending ? `${pending.name} · version ${pending.version}` : undefined}
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
              variant="danger"
              disabled={!reason.trim()}
              loading={busy}
              onClick={() => pending && void hide(pending)}
            >
              Xác nhận ẩn
            </Button>
          </>
        }
      >
        {pending ? (
          <>
            <p className="mp-muted">{pending.description || "Sản phẩm không có mô tả."}</p>
            <TextareaField
              label={`Lý do ${pending.name}`}
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              maxLength={500}
              rows={3}
              hint="Lý do được ghi vào nhật ký quản trị và hiển thị cho người bán."
            />
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
