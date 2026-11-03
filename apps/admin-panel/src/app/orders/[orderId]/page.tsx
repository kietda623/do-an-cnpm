"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Button,
  DataTable,
  Dialog,
  PageHeader,
  Panel,
  StatusBadge,
  TextareaField,
  paymentMethods,
  paymentStatuses,
  sellerOrderStatuses,
  shipmentStatuses,
  useApi,
  formatDateTime,
  formatVnd,
  type DataTableColumn,
} from "@marketplace/ui-web";
import { ApiClientError, normalizeFormError, type ApiPath } from "@marketplace/api-client";

type SellerOrderItem = {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type SellerOrderPart = {
  id: string;
  shopId: string;
  shopNameSnapshot: string;
  status: string;
  version: number;
  originalTotal: string;
  items: SellerOrderItem[];
  shipment: {
    status: string;
    trackingCode: string;
    history: Array<{ toStatus: string; reason: string | null }>;
  } | null;
};

type Order = {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: string;
  originalTotal: string;
  cancelledAmount: string;
  capturedAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt?: string;
  sellerOrders: SellerOrderPart[];
  payments: Array<{
    id: string;
    status: string;
    amount: string;
    transactionCode: string;
    refunds: Array<{ amount: string; reason: string }>;
  }>;
};

type Detail = { order: Order; auditReferenceIds: string[] };

type RecoveryAction = "confirm" | "pack" | "reject";

const actionLabels: Record<RecoveryAction, string> = {
  confirm: "Admin xác nhận",
  pack: "Admin đóng gói",
  reject: "Admin từ chối",
};

const actionVerb: Record<RecoveryAction, string> = {
  confirm: "xác nhận",
  pack: "đóng gói",
  reject: "từ chối",
};

export default function AdminOrderDetailPage() {
  const { api } = useApi();
  const { orderId } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState<{
    part: SellerOrderPart;
    action: RecoveryAction;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setDetail(await api.request<Detail>(`/admin/orders/${orderId}` as ApiPath));
  }, [api, orderId]);

  useEffect(() => {
    if (!orderId) return;
    void refresh().catch((cause: unknown) => setError(normalizeFormError(cause)));
  }, [orderId, refresh]);

  async function recover() {
    if (!pendingRecovery) return;
    setBusy(true);
    setError("");
    try {
      const { part, action } = pendingRecovery;
      await api.request(`/admin/seller-orders/${part.id}/${action}` as ApiPath, {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ expectedVersion: part.version, reason: reason.trim() }),
      });
      setPendingRecovery(null);
      setReason("");
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiClientError && cause.status === 409) {
        setError(
          "SellerOrder vừa thay đổi hoặc tài khoản Seller chưa khóa. Đã tải lại dữ liệu; hãy kiểm tra phiên bản và điều kiện recovery.",
        );
        setPendingRecovery(null);
        await refresh();
      } else setError(normalizeFormError(cause));
    } finally {
      setBusy(false);
    }
  }

  const itemColumns: DataTableColumn<SellerOrderItem>[] = [
    {
      key: "item",
      header: "Mặt hàng",
      render: (row) => (
        <span className="mp-table__stack">
          <span className="mp-table__primary">{row.productName}</span>
          <span className="mp-muted mp-table__secondary">SKU {row.sku}</span>
        </span>
      ),
    },
    {
      key: "qty",
      header: "SL",
      align: "right",
      render: (row) => <span data-numeric>{row.quantity}</span>,
    },
    {
      key: "unit",
      header: "Đơn giá",
      align: "right",
      render: (row) => <span data-numeric>{formatVnd(row.unitPrice)}</span>,
    },
    {
      key: "line",
      header: "Thành tiền",
      align: "right",
      render: (row) => <strong data-numeric>{formatVnd(row.lineTotal)}</strong>,
    },
  ];

  return (
    <div className="mp-page">
      <PageHeader
        title={detail ? detail.order.orderNumber : "Chi tiết đơn hàng"}
        description="Đơn chỉ đọc, bao gồm dữ liệu giao dịch đã hoàn tất."
        meta={
          <Link className="mp-link" href="/orders">
            ← Danh sách đơn
          </Link>
        }
        actions={
          detail ? (
            <span className="mp-inline">
              <StatusBadge status={detail.order.status} map={sellerOrderStatuses} />
              <StatusBadge status={detail.order.paymentStatus} map={paymentStatuses} />
            </span>
          ) : undefined
        }
      />

      {error ? (
        <p role="alert" className="mp-alert-inline">
          {error}
        </p>
      ) : null}

      {!detail ? (
        <Panel>
          <p aria-busy="true" className="mp-muted">
            Đang tải đơn hàng…
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title="Tổng kết"
            description={
              detail.order.createdAt ? formatDateTime(detail.order.createdAt) : undefined
            }
          >
            <dl className="mp-summary-grid">
              <div>
                <dt>Tổng ban đầu</dt>
                <dd data-numeric>{formatVnd(detail.order.originalTotal)}</dd>
              </div>
              <div>
                <dt>Đã hủy</dt>
                <dd data-numeric>{formatVnd(detail.order.cancelledAmount)}</dd>
              </div>
              <div>
                <dt>Đã thu</dt>
                <dd data-numeric>{formatVnd(detail.order.capturedAmount)}</dd>
              </div>
              <div>
                <dt>Đã hoàn</dt>
                <dd data-numeric>{formatVnd(detail.order.refundedAmount)}</dd>
              </div>
              <div>
                <dt>Còn phải thu</dt>
                <dd data-numeric>{formatVnd(detail.order.outstandingAmount)}</dd>
              </div>
              <div>
                <dt>Phương thức</dt>
                <dd>{paymentMethods[detail.order.paymentMethod]?.label ?? detail.order.paymentMethod}</dd>
              </div>
            </dl>
            <p className="mp-muted">Buyer {detail.order.buyerId}</p>
          </Panel>

          <Panel title="Các shop và mặt hàng" flush>
            <div className="mp-stack">
              {detail.order.sellerOrders.map((part) => (
                <section key={part.id} className="mp-panel__pad mp-stack">
                  <header className="mp-inline">
                    <h3 className="mp-panel__title">{part.shopNameSnapshot}</h3>
                    <StatusBadge status={part.status} map={sellerOrderStatuses} />
                  </header>
                  <p className="mp-muted">
                    Shop {part.shopId} · SellerOrder {part.id} · version {part.version} ·{" "}
                    {formatVnd(part.originalTotal)}
                  </p>
                  <DataTable
                    columns={itemColumns}
                    rows={part.items}
                    rowKey={(row) => row.id}
                    caption={`Mặt hàng của ${part.shopNameSnapshot}`}
                  />
                  {part.shipment ? (
                    <p className="mp-inline">
                      <StatusBadge status={part.shipment.status} map={shipmentStatuses} />
                      <span className="mp-muted">{part.shipment.trackingCode}</span>
                    </p>
                  ) : null}
                  {part.status === "PENDING" || part.status === "CONFIRMED" ? (
                    <div className="mp-form-actions" aria-label={`Recovery SellerOrder ${part.id}`}>
                      {part.status === "PENDING" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReason("");
                            setPendingRecovery({ part, action: "confirm" });
                          }}
                        >
                          Admin xác nhận
                        </Button>
                      ) : null}
                      {part.status === "CONFIRMED" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReason("");
                            setPendingRecovery({ part, action: "pack" });
                          }}
                        >
                          Admin đóng gói
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setReason("");
                          setPendingRecovery({ part, action: "reject" });
                        }}
                      >
                        Admin từ chối
                      </Button>
                      <span className="mp-muted mp-note">
                        Recovery chỉ hợp lệ khi tài khoản Seller bị khóa.
                      </span>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </Panel>

          <Panel title="Thanh toán">
            {detail.order.payments.length === 0 ? (
              <p className="mp-muted">Chưa có giao dịch thanh toán.</p>
            ) : (
              <ul className="mp-stack">
                {detail.order.payments.map((payment) => (
                  <li key={payment.id} className="mp-stack">
                    <p className="mp-inline">
                      <StatusBadge status={payment.status} map={paymentStatuses} />
                      <span>
                        {`${payment.status} · ${payment.amount} VND`}
                      </span>
                      <span className="mp-muted">{payment.transactionCode}</span>
                    </p>
                    {payment.refunds.map((refund, index) => (
                      <p key={`${payment.id}-${index}`} className="mp-muted">
                        Hoàn {formatVnd(refund.amount)} · {refund.reason}
                      </p>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Audit references">
            {detail.auditReferenceIds.length ? (
              <ul className="mp-stack">
                {detail.auditReferenceIds.map((id) => (
                  <li key={id} className="mp-code">
                    {id}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mp-muted">Chưa có audit reference.</p>
            )}
          </Panel>
        </>
      )}

      <Dialog
        open={Boolean(pendingRecovery)}
        onClose={() => setPendingRecovery(null)}
        title={`Admin ${actionVerb[pendingRecovery?.action ?? "confirm"]} SellerOrder`}
        description={
          pendingRecovery
            ? `${pendingRecovery.part.id} · version ${pendingRecovery.part.version}`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingRecovery(null)}>
              Hủy
            </Button>
            <Button
              variant={pendingRecovery?.action === "reject" ? "danger" : "primary"}
              disabled={!reason.trim()}
              loading={busy}
              onClick={() => void recover()}
            >
              Xác nhận hành động
            </Button>
          </>
        }
      >
        {pendingRecovery ? (
          <TextareaField
            label="Lý do recovery"
            name="reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            minLength={1}
            maxLength={500}
            rows={3}
            hint={`Hành động: ${actionLabels[pendingRecovery.action]}.`}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
