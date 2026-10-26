import { derivePaymentAmounts } from "../../payment/services/payment-policy.js";

type OrderItemRow = {
  id: string;
  productId: string;
  variantId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  attributesSnapshot: unknown;
  imageKeySnapshot: string | null;
  unitPrice: { toString(): string };
  quantity: number;
  lineTotal: { toString(): string };
};
type SellerOrderRow = {
  id: string;
  orderId: string;
  shopId: string;
  shopNameSnapshot: string;
  status: string;
  originalTotal: { toString(): string };
  cancelledAt: Date | null;
  cancellationReason: string | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemRow[];
  shipment?: {
    id: string;
    sellerOrderId: string;
    status: string;
    trackingCode: string;
    deliveryAttempt: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    events: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      deliveryAttempt: number;
      reason: string | null;
      createdAt: Date;
    }>;
  } | null;
};
export type OrderRow = {
  id: string;
  buyerUserId: string;
  publicNumber: string;
  recipientSnapshot: unknown;
  paymentMethod: "COD" | "MOCK";
  originalTotal: { toString(): string };
  paymentDeadline: Date | null;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  sellerOrders: SellerOrderRow[];
  payment: {
    id: string;
    createdAt: Date;
    attempts?: Array<{
      id: string;
      status: string;
      settlementKind: string;
      originalAttemptId: string | null;
      amount: { toString(): string };
      externalTransactionId: string | null;
      createdAt: Date;
      settledAt: Date | null;
      allocations: Array<{
        sellerOrderId: string;
        amount: { toString(): string };
        kind: string;
        refund: {
          id: string;
          amount: { toString(): string };
          reason: string;
          createdAt: Date;
        } | null;
      }>;
    }>;
  } | null;
};

const fulfillmentStages = [
  "PENDING",
  "CONFIRMED",
  "PACKING",
  "SHIPPING",
  "DELIVERED",
] as const;

export function deriveMarketplaceOrderStatus(
  statuses: readonly string[],
): string {
  const live = statuses.filter((status) => status !== "CANCELLED");
  if (!live.length) return "CANCELLED";
  if (live.every((status) => status === "COMPLETED")) return "COMPLETED";
  return fulfillmentStages.find((stage) => live.includes(stage)) ?? "COMPLETED";
}

export function aggregateOrder(order: OrderRow) {
  const originalTotal = BigInt(order.originalTotal.toString());
  const cancelledAmount = order.sellerOrders
    .filter((part) => part.status === "CANCELLED")
    .reduce((sum, part) => sum + BigInt(part.originalTotal.toString()), 0n);
  const live = order.sellerOrders.filter((part) => part.status !== "CANCELLED");
  const status = deriveMarketplaceOrderStatus(
    order.sellerOrders.map((part) => part.status),
  );
  const successfulAllocations = (order.payment?.attempts ?? [])
    .filter((attempt) => attempt.status === "SUCCEEDED")
    .flatMap((attempt) => attempt.allocations);
  const paidGross = successfulAllocations.reduce(
    (sum, allocation) => sum + BigInt(allocation.amount.toString()),
    0n,
  );
  const refunds = successfulAllocations.flatMap((allocation) =>
    allocation.refund ? [allocation.refund] : [],
  );
  const refundedTotal = refunds.reduce(
    (sum, refund) => sum + BigInt(refund.amount.toString()),
    0n,
  );
  const paymentTotals = derivePaymentAmounts({
    originalTotal: originalTotal.toString(),
    cancelledTotal: cancelledAmount.toString(),
    paidGross: paidGross.toString(),
    refundedTotal: refundedTotal.toString(),
  });
  const paymentStatus = paymentTotals.status;
  const sellerOrders = order.sellerOrders.map((part) => {
    const partTotal = BigInt(part.originalTotal.toString());
    const partAllocations = successfulAllocations.filter(
      (allocation) => allocation.sellerOrderId === part.id,
    );
    const partPaid = partAllocations.reduce(
      (sum, allocation) => sum + BigInt(allocation.amount.toString()),
      0n,
    );
    const partRefunds = partAllocations.flatMap((allocation) =>
      allocation.refund ? [allocation.refund] : [],
    );
    const partRefunded = partRefunds.reduce(
      (sum, refund) => sum + BigInt(refund.amount.toString()),
      0n,
    );
    return {
      id: part.id,
      orderId: part.orderId,
      shopId: part.shopId,
      shopNameSnapshot: part.shopNameSnapshot,
      status: part.status,
      items: part.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productNameSnapshot,
        sku: item.skuSnapshot,
        attributes: item.attributesSnapshot,
        unitPrice: item.unitPrice.toString(),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toString(),
        reviewId: null,
      })),
      originalTotal: partTotal.toString(),
      cancelledAmount: part.status === "CANCELLED" ? partTotal.toString() : "0",
      capturedAmount: partPaid.toString(),
      refundedAmount: partRefunded.toString(),
      outstandingAmount: (part.status === "CANCELLED"
        ? 0n
        : partTotal - (partPaid - partRefunded) > 0n
          ? partTotal - (partPaid - partRefunded)
          : 0n
      ).toString(),
      currency: "VND" as const,
      addressSnapshot: order.recipientSnapshot,
      shipment: part.shipment
        ? {
            id: part.shipment.id,
            sellerOrderId: part.shipment.sellerOrderId,
            status: part.shipment.status,
            trackingCode: part.shipment.trackingCode,
            attemptNumber: part.shipment.deliveryAttempt,
            version: part.shipment.version,
            history: part.shipment.events.map((event) => ({
              id: event.id,
              fromStatus: event.fromStatus,
              toStatus: event.toStatus,
              attemptNumber: event.deliveryAttempt,
              reason: event.reason,
              createdAt: event.createdAt,
            })),
            createdAt: part.shipment.createdAt,
            updatedAt: part.shipment.updatedAt,
          }
        : null,
      version: part.version,
      completedAt: part.completedAt,
      cancelledAt: part.cancelledAt,
      cancelReason: part.cancellationReason,
      createdAt: part.createdAt,
      updatedAt: part.updatedAt,
    };
  });
  return {
    id: order.id,
    buyerId: order.buyerUserId,
    orderNumber: order.publicNumber,
    sellerOrders,
    status,
    partiallyCancelled: cancelledAmount > 0n && live.length > 0,
    originalTotal: originalTotal.toString(),
    cancelledAmount: cancelledAmount.toString(),
    capturedAmount: paidGross.toString(),
    refundedAmount: refundedTotal.toString(),
    outstandingAmount: paymentTotals.amountDue,
    paymentMethod: order.paymentMethod,
    paymentStatus,
    currency: "VND" as const,
    paymentDeadline: order.paymentDeadline,
    payments: order.payment
      ? (order.payment.attempts ?? []).length
        ? order.payment.attempts!.map((attempt) => ({
            id: attempt.id,
            orderId: order.id,
            transactionCode: attempt.externalTransactionId ?? attempt.id,
            method: order.paymentMethod,
            status: attempt.status,
            settlementKind: attempt.settlementKind,
            originalAttemptId: attempt.originalAttemptId,
            amount: attempt.amount.toString(),
            currency: "VND" as const,
            allocations: attempt.allocations.map((allocation) => ({
              sellerOrderId: allocation.sellerOrderId,
              amount: allocation.amount.toString(),
            })),
            refunds: attempt.allocations.flatMap((allocation) =>
              allocation.refund
                ? [
                    {
                      id: allocation.refund.id,
                      sellerOrderId: allocation.sellerOrderId,
                      amount: allocation.refund.amount.toString(),
                      reason: allocation.refund.reason,
                      createdAt: allocation.refund.createdAt,
                    },
                  ]
                : [],
            ),
            createdAt: attempt.createdAt,
            resolvedAt: attempt.settledAt,
          }))
        : [
            {
              id: order.payment.id,
              orderId: order.id,
              transactionCode: order.publicNumber,
              method: order.paymentMethod,
              status: "PENDING",
              settlementKind: "NORMAL",
              originalAttemptId: null,
              amount: originalTotal.toString(),
              currency: "VND" as const,
              allocations: [],
              refunds: [],
              createdAt: order.payment.createdAt,
              resolvedAt: null,
            },
          ]
      : [],
    version: order.version,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
