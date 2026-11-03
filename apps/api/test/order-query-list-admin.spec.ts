import { describe, expect, it, jest } from "@jest/globals";
import { OrderQueryService } from "../src/modules/order/services/order-query.service.js";

const now = new Date("2026-10-20T00:00:00.000Z");
const sellerOrder = {
  id: "00000000-0000-4000-8000-000000000101",
  orderId: "00000000-0000-4000-8000-000000000100",
  shopId: "00000000-0000-4000-8000-000000000102",
  shopNameSnapshot: "Test Shop",
  status: "PENDING",
  originalTotal: { toString: () => "1000" },
  cancelledAt: null,
  cancellationReason: null,
  completedAt: null,
  version: 0,
  createdAt: now,
  updatedAt: now,
  items: [],
  shipment: null,
};
const orderRow = {
  id: "00000000-0000-4000-8000-000000000100",
  buyerUserId: "00000000-0000-4000-8000-000000000103",
  publicNumber: "ORD-100",
  recipientSnapshot: {},
  paymentMethod: "COD" as const,
  originalTotal: { toString: () => "1000" },
  paymentDeadline: null,
  status: "PENDING",
  version: 0,
  createdAt: now,
  updatedAt: now,
  sellerOrders: [sellerOrder],
  payment: null,
};

describe("OrderQueryService.listAdmin", () => {
  it("hydrates the page inside the repeatable-read transaction", async () => {
    const tx = {
      marketplaceOrder: {
        findMany: jest.fn<(args: unknown) => Promise<unknown[]>>(
          async () => [orderRow],
        ),
        count: jest.fn(async () => 1),
      },
    };
    const prisma = {
      $transaction: jest.fn(
        async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
      ),
      marketplaceOrder: {
        findFirst: jest.fn(async () => {
          throw new Error("admin page was hydrated outside the transaction");
        }),
      },
    };
    const service = new OrderQueryService({ prisma } as never);

    const result = await service.listAdmin({ page: 1, pageSize: 20 });

    expect(result.data).toEqual([
      {
        id: orderRow.id,
        orderNumber: "ORD-100",
        status: "PENDING",
        partiallyCancelled: false,
        originalTotal: "1000",
        outstandingAmount: "1000",
        paymentStatus: "UNPAID",
        createdAt: now,
      },
    ]);
    expect(tx.marketplaceOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.anything() }),
    );
    expect(prisma.marketplaceOrder.findFirst).not.toHaveBeenCalled();
  });
});
