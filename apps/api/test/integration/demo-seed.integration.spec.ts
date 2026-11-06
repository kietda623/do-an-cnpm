import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import {
  buildDemoFixturePlan,
  type DemoSeedPasswords,
} from "../../prisma/seed/demo-fixtures.js";
import { seedDemoDatabase } from "../../prisma/seed/demo-seed.js";
import {
  createTestPool,
  resetAndDeployMigrations,
} from "../helpers/database.js";

const passwords: DemoSeedPasswords = {
  sellerPassword: "test-demo-seller-password-01",
  buyerPassword: "test-demo-buyer-password-01",
  lockedBuyerPassword: "test-demo-locked-password-01",
};

describe("T150 demo seed repeatability on PostgreSQL", () => {
  const plan = buildDemoFixturePlan();
  let prisma: PrismaClient;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    const pool: Pool = await createTestPool();
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function summary() {
    const userIds = plan.users.map((user) => user.id);
    const shopIds = plan.shops.map((shop) => shop.id);
    const categoryIds = plan.categories.map((category) => category.id);
    const productIds = plan.products.map((product) => product.id);
    const variantIds = plan.products.map((product) => product.variantId);
    const assetIds = [
      ...plan.shops.map((shop) => shop.logoAssetId),
      ...plan.products.map((product) => product.imageAssetId),
    ];
    const orderIds = plan.orders.map((order) => order.id);
    const paymentIds = plan.orders.map((order) => order.paymentId);
    const sellerOrderIds = plan.orders.map((order) => order.sellerOrderId);
    const orderItemIds = plan.orders.map((order) => order.orderItemId);

    const [
      users,
      shops,
      memberships,
      categories,
      products,
      variants,
      inventories,
      productImages,
      assets,
      orders,
      sellerOrders,
      payments,
      attempts,
      paymentEvents,
      allocations,
      refunds,
      shipments,
      shipmentEvents,
      orderEvents,
      movements,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, emailNormalized: true, status: true },
      }),
      prisma.shop.findMany({
        where: { id: { in: shopIds } },
        select: { id: true, slugNormalized: true, status: true },
      }),
      prisma.shopMember.count({ where: { shopId: { in: shopIds } } }),
      prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, slug: true, status: true },
      }),
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, adminHidden: true },
      }),
      prisma.productVariant.count({ where: { id: { in: variantIds } } }),
      prisma.inventory.findMany({
        where: { variantId: { in: variantIds } },
        select: { variantId: true, availableQuantity: true },
      }),
      prisma.productImage.count({ where: { productId: { in: productIds } } }),
      prisma.asset.count({ where: { id: { in: assetIds } } }),
      prisma.marketplaceOrder.findMany({
        where: { id: { in: orderIds } },
        select: {
          id: true,
          publicNumber: true,
          paymentMethod: true,
          status: true,
          version: true,
        },
        orderBy: { publicNumber: "asc" },
      }),
      prisma.sellerOrder.findMany({
        where: { id: { in: sellerOrderIds } },
        select: { id: true, status: true, version: true },
      }),
      prisma.payment.findMany({
        where: { id: { in: paymentIds } },
        select: { id: true, orderId: true, method: true, version: true },
      }),
      prisma.paymentAttempt.findMany({
        where: { paymentId: { in: paymentIds } },
        select: {
          id: true,
          paymentId: true,
          status: true,
          provider: true,
          amount: true,
        },
      }),
      prisma.paymentEvent.count({ where: { paymentId: { in: paymentIds } } }),
      prisma.paymentAllocation.findMany({
        where: { attempt: { paymentId: { in: paymentIds } } },
        select: { id: true, sellerOrderId: true, amount: true, kind: true },
      }),
      prisma.simulatedRefund.findMany({
        where: { sellerOrderId: { in: sellerOrderIds } },
        select: { id: true, amount: true, reason: true },
      }),
      prisma.shipment.findMany({
        where: { sellerOrderId: { in: sellerOrderIds } },
        select: { id: true, sellerOrderId: true, status: true },
      }),
      prisma.shipmentEvent.count({
        where: { shipment: { sellerOrderId: { in: sellerOrderIds } } },
      }),
      prisma.orderEvent.count({ where: { orderId: { in: orderIds } } }),
      prisma.inventoryMovement.findMany({
        where: { inventoryId: { in: variantIds } },
        select: {
          inventoryId: true,
          kind: true,
          effectType: true,
          quantityDelta: true,
          orderItemId: true,
          operationKey: true,
        },
        orderBy: [{ inventoryId: "asc" }, { operationKey: "asc" }],
      }),
    ]);

    return {
      users: users.sort((left, right) =>
        left.emailNormalized.localeCompare(right.emailNormalized),
      ),
      shops: shops.sort((left, right) =>
        left.slugNormalized.localeCompare(right.slugNormalized),
      ),
      memberships,
      categories: categories.sort((left, right) =>
        left.slug.localeCompare(right.slug),
      ),
      products: {
        count: products.length,
        hidden: products.filter((product) => product.adminHidden).length,
      },
      variants,
      inventories: inventories.sort((left, right) =>
        left.variantId.localeCompare(right.variantId),
      ),
      productImages,
      assets,
      orders,
      sellerOrders: sellerOrders.sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      payments: payments.sort((left, right) => left.id.localeCompare(right.id)),
      attempts: attempts
        .map((attempt) => ({ ...attempt, amount: attempt.amount.toFixed(0) }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      paymentEvents,
      allocations: allocations
        .map((allocation) => ({
          ...allocation,
          amount: allocation.amount.toFixed(0),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      refunds: refunds
        .map((refund) => ({ ...refund, amount: refund.amount.toFixed(0) }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      shipments,
      shipmentEvents,
      orderEvents,
      movements,
      sampleOrderItemId: orderItemIds[0],
    };
  }

  it("creates the demo graph and preserves real transaction and inventory changes on re-run", async () => {
    await seedDemoDatabase(prisma, passwords);

    const first = await summary();
    expect(first.users).toHaveLength(12);
    expect(first.users.filter((user) => user.status === "LOCKED")).toHaveLength(
      1,
    );
    expect(first.shops).toHaveLength(10);
    expect(first.shops.every((shop) => shop.status === "ACTIVE")).toBe(true);
    expect(first.memberships).toBe(10);
    expect(first.categories).toHaveLength(10);
    expect(
      first.categories.every((category) => category.status === "VISIBLE"),
    ).toBe(true);
    expect(first.products).toEqual({ count: 1_000, hidden: 1 });
    expect(first.variants).toBe(1_000);
    expect(first.inventories).toHaveLength(1_000);
    expect(first.productImages).toBe(1_000);
    expect(first.assets).toBe(1_010);
    expect(
      first.orders.map((order) => [
        order.publicNumber,
        order.paymentMethod,
        order.status,
      ]),
    ).toEqual([
      ["DEMO-COMPLETED-COD-001", "COD", "COMPLETED"],
      ["DEMO-EXPIRED-MOCK-001", "MOCK", "CANCELLED"],
      ["DEMO-PENDING-COD-001", "COD", "PENDING"],
      ["DEMO-REFUNDED-MOCK-001", "MOCK", "CANCELLED"],
    ]);
    expect(first.attempts).toHaveLength(3);
    expect(
      first.attempts
        .map((attempt) => [attempt.provider, attempt.status, attempt.amount])
        .sort((left, right) =>
          `${left[0]}:${left[1]}`.localeCompare(`${right[0]}:${right[1]}`),
        ),
    ).toEqual([
      ["COD_SIMULATION", "SUCCEEDED", "10000"],
      ["MOCK", "CANCELLED", "10000"],
      ["MOCK", "SUCCEEDED", "10000"],
    ]);
    expect(first.allocations).toHaveLength(2);
    expect(first.refunds).toEqual([
      expect.objectContaining({ amount: "10000", reason: "CANCELLATION" }),
    ]);
    expect(first.shipments).toEqual([
      expect.objectContaining({ status: "DELIVERED" }),
    ]);
    expect(first.paymentEvents).toBe(3);
    expect(first.shipmentEvents).toBe(1);
    expect(first.orderEvents).toBe(4);
    expect(first.movements).toHaveLength(1_006);

    const firstProduct = plan.products[0]!;
    const firstShop = plan.shops[0]!;
    const pendingOrder = plan.orders.find(
      (order) => order.key === "pending-cod",
    )!;
    const currentInventory = await prisma.inventory.findUniqueOrThrow({
      where: { variantId: firstProduct.variantId },
    });
    const adjustedQuantity = currentInventory.availableQuantity - 1;
    await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { variantId: firstProduct.variantId },
        data: { availableQuantity: adjustedQuantity },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: firstProduct.variantId,
          shopId: firstShop.id,
          actorUserId: plan.users[0]!.id,
          kind: "ADJUST",
          quantityDelta: -1,
          quantityAfter: adjustedQuantity,
          reason: "Repeat-seed preservation test adjustment",
          operationKey: "test:demo-seed-preserves-inventory",
        },
      });
      await tx.marketplaceOrder.update({
        where: { id: pendingOrder.id },
        data: { status: "CONFIRMED", version: { increment: 1 } },
      });
      await tx.sellerOrder.update({
        where: { id: pendingOrder.sellerOrderId },
        data: { status: "CONFIRMED", version: { increment: 1 } },
      });
      await tx.payment.update({
        where: { id: pendingOrder.paymentId },
        data: { version: { increment: 1 } },
      });
      await tx.orderEvent.create({
        data: {
          orderId: pendingOrder.id,
          sellerOrderId: pendingOrder.sellerOrderId,
          actorUserId: plan.users[0]!.id,
          actorKind: "USER",
          action: "CONFIRM",
          fromStatus: "PENDING",
          toStatus: "CONFIRMED",
          operationKey: "test:demo-seed-confirmed-order",
        },
      });
    });

    const afterTransactionChange = await summary();
    expect(
      afterTransactionChange.orders.find(
        (order) => order.id === pendingOrder.id,
      ),
    ).toEqual(expect.objectContaining({ status: "CONFIRMED", version: 1 }));
    expect(
      afterTransactionChange.inventories.find(
        (inventory) => inventory.variantId === firstProduct.variantId,
      )?.availableQuantity,
    ).toBe(adjustedQuantity);

    await seedDemoDatabase(prisma, passwords);

    expect(await summary()).toEqual(afterTransactionChange);
  }, 120_000);
});
