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
  payment: { id: string; createdAt: Date } | null;
};

export function aggregateOrder(order: OrderRow) {
  const originalTotal = BigInt(order.originalTotal.toString());
  const cancelledAmount = order.sellerOrders
    .filter((part) => part.status === "CANCELLED")
    .reduce((sum, part) => sum + BigInt(part.originalTotal.toString()), 0n);
  const live = order.sellerOrders.filter((part) => part.status !== "CANCELLED");
  const statuses = new Set(live.map((part) => part.status));
  let status = "PENDING";
  if (live.length && statuses.size === 1) status = live[0]!.status;
  else if (statuses.has("SHIPPING")) status = "SHIPPING";
  else if (statuses.has("PACKING")) status = "PACKING";
  else if (statuses.has("CONFIRMED")) status = "CONFIRMED";
  else if (statuses.has("DELIVERED")) status = "DELIVERED";
  else if (statuses.has("COMPLETED")) status = "COMPLETED";
  if (!live.length) status = "CANCELLED";
  const sellerOrders = order.sellerOrders.map((part) => {
    const partTotal = BigInt(part.originalTotal.toString());
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
      capturedAmount: "0",
      refundedAmount: "0",
      outstandingAmount: part.status === "CANCELLED" ? "0" : partTotal.toString(),
      currency: "VND" as const,
      addressSnapshot: order.recipientSnapshot,
      shipment: null,
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
    capturedAmount: "0",
    refundedAmount: "0",
    outstandingAmount: (originalTotal - cancelledAmount).toString(),
    paymentMethod: order.paymentMethod,
    paymentStatus: "UNPAID",
    currency: "VND" as const,
    paymentDeadline: order.paymentDeadline,
    payments: order.payment
      ? [
          {
            id: order.payment.id,
            orderId: order.id,
            transactionCode: order.publicNumber,
            method: order.paymentMethod,
            status: "PENDING",
            settlementKind: "NORMAL",
            originalAttemptId: null,
            amount: originalTotal.toString(),
            currency: "VND",
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
