import { describe, expect, it } from "@jest/globals";
import { aggregateOrder, type OrderRow } from "./order-aggregate.js";

describe("BR-08 marketplace order status", () => {
  it("uses the earliest unfinished seller order, even when another part is shipping", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    const part = (status: string, id: string) => ({
      id,
      orderId: "order",
      shopId: id,
      shopNameSnapshot: id,
      status,
      originalTotal: { toString: () => "100" },
      cancelledAt: null,
      cancellationReason: null,
      completedAt: null,
      version: 0,
      createdAt: now,
      updatedAt: now,
      items: [],
    });
    const order = {
      id: "order",
      buyerUserId: "buyer",
      publicNumber: "ORD-1",
      recipientSnapshot: {},
      paymentMethod: "COD",
      originalTotal: { toString: () => "200" },
      paymentDeadline: null,
      status: "SHIPPING",
      version: 0,
      createdAt: now,
      updatedAt: now,
      sellerOrders: [part("PENDING", "shop-a"), part("SHIPPING", "shop-b")],
      payment: null,
    } as OrderRow;
    expect(aggregateOrder(order).status).toBe("PENDING");
  });
});
