"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import {
  Badge,
  Button,
  Camera,
  DataTable,
  EmptyState,
  ImageOff,
  Package,
  PageHeader,
  Pagination,
  Panel,
  SelectField,
  Skeleton,
  StatusMessage,
  TextField,
  formatVnd,
  useApi,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";
import type { CatalogProduct, CatalogProductVariant } from "../../../../lib/types";
import { ProductCreateForm } from "../../../../features/catalog/product-create-form";
import { ProductEditForm } from "../../../../features/catalog/product-edit-form";
import { InventoryEditor } from "../../../../features/catalog/inventory-editor";

const pageSize = 20;

function imageSrc(objectKey: string | undefined): string | null {
  if (!objectKey) return null;
  return `${process.env.NEXT_PUBLIC_ASSET_PUBLIC_READ_BASE ?? ""}/${objectKey}`;
}

export default function ProductsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { api, status } = useApi();
  const [rows, setRows] = useState<CatalogProduct[]>([]);
  const [q, setQ] = useState("");
  const [selling, setSelling] = useState("");
  const [adminHidden, setAdminHidden] = useState("");
  const [applied, setApplied] = useState({ q: "", selling: "", adminHidden: "" });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState("");
  const [togglingId, setTogglingId] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.selling) params.set("selling", applied.selling);
    if (applied.adminHidden) params.set("adminHidden", applied.adminHidden);
    try {
      const { data, meta } = await api.requestEnvelope<CatalogProduct[]>(
        `/shops/${shopId}/management/products?${params}` as ApiPath,
      );
      setRows(data);
      setTotal(meta?.total ?? null);
      setError("");
    } catch (cause) {
      setRows([]);
      setTotal(null);
      setError(normalizeFormError(cause));
    } finally {
      setLoading(false);
    }
  }, [api, applied, page, shopId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void refresh();
  }, [refresh, status]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied({ q, selling, adminHidden });
  }

  const filtering = Boolean(applied.q.trim() || applied.selling || applied.adminHidden);
  const pageCount = total === null ? page : Math.max(1, Math.ceil(total / pageSize));

  async function toggleSelling(product: CatalogProduct) {
    setTogglingId(product.id);
    setNotice("");
    setError("");
    try {
      await api.request(`/shops/${shopId}/products/${product.id}` as ApiPath, {
        method: "PATCH",
        body: JSON.stringify({ selling: !product.selling, expectedVersion: product.version }),
      });
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError("Sản phẩm vừa được sửa ở nơi khác. Đã tải lại dữ liệu mới.");
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setTogglingId("");
    }
  }

  const variantColumns: DataTableColumn<CatalogProductVariant>[] = [
    {
      key: "sku",
      header: "SKU",
      render: (variant) => <span className="mp-table__primary">{variant.sku}</span>,
    },
    {
      key: "attributes",
      header: "Phân loại",
      render: (variant) =>
        Object.entries(variant.attributes ?? {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(" · ") || "—",
    },
    { key: "price", header: "Giá bán", numeric: true, render: (variant) => formatVnd(variant.price) },
    {
      key: "stock",
      header: "Tồn kho",
      numeric: true,
      render: (variant) => <span>tồn {variant.availableQuantity}</span>,
    },
    {
      key: "selling",
      header: "Trạng thái",
      render: (variant) => (
        <Badge tone={variant.selling ? "success" : "neutral"} dot>
          {variant.selling ? "Đang bán" : "Đã dừng"}
        </Badge>
      ),
    },
  ];

  return (
    <div className="mp-page">
      <PageHeader
        title="Sản phẩm của cửa hàng"
        description="Quản lý ảnh, biến thể, giá bán và tồn kho trên một màn hình."
      />

      <Panel
        title="Thêm sản phẩm mới"
        description="Sản phẩm được đăng bán ngay sau khi tạo; bạn có thể tạm dừng bất cứ lúc nào."
        actions={<Camera size={18} aria-hidden="true" />}
      >
        <ProductCreateForm shopId={shopId} onCreated={refresh} />
      </Panel>

      {notice ? (
        <StatusMessage tone="success" title="Đã cập nhật" onDismiss={() => setNotice("")}>
          <p>{notice}</p>
        </StatusMessage>
      ) : null}

      <Panel title="Bộ lọc" description="Tìm theo tên, trạng thái bán hoặc sản phẩm bị quản trị ẩn.">
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-form-grid">
            <TextField
              label="Tìm kiếm sản phẩm"
              name="q"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tên sản phẩm"
            />
            <SelectField
              label="Lọc trạng thái bán"
              name="selling"
              value={selling}
              onChange={(event) => setSelling(event.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Đang bán</option>
              <option value="false">Đã dừng bán</option>
            </SelectField>
            <SelectField
              label="Lọc sản phẩm bị ẩn"
              name="adminHidden"
              value={adminHidden}
              onChange={(event) => setAdminHidden(event.target.value)}
            >
              <option value="">Tất cả sản phẩm</option>
              <option value="true">Bị quản trị ẩn</option>
              <option value="false">Không bị ẩn</option>
            </SelectField>
          </div>
          <div className="mp-form-actions">
            <Button type="submit" loading={loading}>
              Lọc
            </Button>
          </div>
        </form>
      </Panel>

      <Panel
        title="Danh sách sản phẩm"
        description={
          loading ? undefined : `${total ?? rows.length} sản phẩm trong bộ lọc hiện tại`
        }
        actions={
          <Button variant="ghost" size="sm" onClick={() => void refresh()} loading={loading}>
            Làm mới
          </Button>
        }
      >
        {error ? <StatusMessage tone="error" title="Không tải được sản phẩm"><p>{error}</p></StatusMessage> : null}

        {loading && rows.length === 0 ? (
          <div className="mp-stack mp-stack--loose" aria-label="Đang tải sản phẩm" role="status">
            <Skeleton className="mp-skeleton--block" />
            <Skeleton className="mp-skeleton--block" />
            <Skeleton className="mp-skeleton--block" />
          </div>
        ) : rows.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={<Package size={22} />}
              title="Không có sản phẩm phù hợp"
              description="Thử đổi từ khoá hoặc bộ lọc trạng thái để xem sản phẩm khác."
            />
          ) : (
            <EmptyState
              icon={<Package size={22} />}
              title="Cửa hàng chưa có sản phẩm"
              description="Dùng biểu mẫu phía trên để thêm sản phẩm đầu tiên."
            />
          )
        ) : (
          <ul className="mp-product-list">
            {rows.map((product) => {
              const isEditing = editing === product.id;
              return (
                <li className="mp-product" key={product.id}>
                  <header className="mp-product__head">
                    <div className="mp-product__media" aria-label="Thư viện ảnh">
                      {product.images.length === 0 ? (
                        <span className="mp-product__media-empty">
                          <ImageOff size={18} aria-hidden="true" />
                        </span>
                      ) : (
                        product.images.map((image) => {
                          const src = imageSrc(image.objectKey);
                          return src ? (
                            <img
                              key={image.assetId}
                              src={src}
                              alt={`Ảnh ${product.name}`}
                              className="mp-product__thumb"
                            />
                          ) : null;
                        })
                      )}
                    </div>
                    <div className="mp-product__title">
                      <h3>{product.name}</h3>
                      <p className="mp-muted">
                        {product.selling ? "Đang bán" : "Đã dừng bán"} · {product.variants.length}{" "}
                        biến thể · {formatVnd(product.variants[0]?.price)}
                      </p>
                    </div>
                    <div className="mp-product__actions">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditing(isEditing ? "" : product.id)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant={product.selling ? "danger" : "primary"}
                        loading={togglingId === product.id}
                        onClick={() => void toggleSelling(product)}
                      >
                        {product.selling ? "Dừng bán" : "Đăng bán lại"}
                      </Button>
                    </div>
                  </header>

                  {isEditing ? (
                    <ProductEditForm
                      shopId={shopId}
                      product={product}
                      onSaved={async () => {
                        setEditing("");
                        setNotice(`Đã lưu thay đổi cho ${product.name}.`);
                        await refresh();
                      }}
                      onCancel={() => setEditing("")}
                    />
                  ) : null}

                  <DataTable
                    caption={`Biến thể của ${product.name}`}
                    columns={variantColumns}
                    rows={product.variants}
                    rowKey={(variant) => variant.id}
                    dense
                    empty={
                      <EmptyState
                        title="Chưa có biến thể"
                        description="Thêm biến thể để bắt đầu bán sản phẩm này."
                      />
                    }
                  />

                  <InventoryEditor shopId={shopId} product={product} onChanged={refresh} />
                </li>
              );
            })}
          </ul>
        )}

        {loading ? null : (
          <div className="mp-panel__pad">
            <Pagination
              page={page}
              pageCount={pageCount}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </Panel>
    </div>
  );
}
