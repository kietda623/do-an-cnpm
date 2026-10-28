import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../src/common/http/validation.pipe.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { PaymentService } from "../../src/modules/payment/services/payment.service.js";
import { PaymentExpiryJob } from "../../src/modules/payment/jobs/payment-expiry.job.js";
import { resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `payment-${randomUUID()}@example.test`;
type Auth = { body: { data: { accessToken: string; user: { id: string } } } };

describe("mock payments and cancellation PostgreSQL integration", () => {
  let app: INestApplication;
  let db: DatabaseService;
  beforeAll(async () => {
    await resetAndDeployMigrations();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api/v1", {
      exclude: [
        { path: "health/live", method: RequestMethod.GET },
        { path: "health/ready", method: RequestMethod.GET },
      ],
    });
    const csrf = app.get(CsrfRequestMiddleware);
    app.use(csrf.use.bind(csrf));
    app.useGlobalPipes(createContractValidationPipe());
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
  }, 120_000);
  afterAll(async () => app?.close());

  async function register(name: string): Promise<Auth> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: email(),
        password,
        fullName: name,
        clientPlatform: "ANDROID",
      });
    expect(response.status).toBe(201);
    return response as Auth;
  }
  async function fixture() {
    const owner = await register("Payment Seller");
    const buyer = await register("Payment Buyer");
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `payments/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shopResponse = await request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
      .send({
        name: `Payment Shop ${randomUUID().slice(0, 6)}`,
        slug: `payment-${randomUUID().slice(0, 8)}`,
        description: "Payment test shop",
        logoAssetId: logo.id,
        contactAddress: "Test",
        phone: "0901234567",
      });
    expect(shopResponse.status).toBe(201);
    const admin = await register("Payment Admin");
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/admin/shops/${shopResponse.body.data.id}/approve`)
          .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
          .send({ expectedVersion: 0 })
      ).status,
    ).toBe(200);
    const category = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .send({
        name: `Payments ${randomUUID().slice(0, 6)}`,
        parentId: null,
        visible: true,
      });
    expect(category.status).toBe(201);
    const image = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.body.data.user.id,
        shopId: shopResponse.body.data.id,
        purpose: "PRODUCT_IMAGE",
        objectKey: `payments/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const product = await request(app.getHttpServer())
      .post(`/api/v1/shops/${shopResponse.body.data.id}/products`)
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
      .send({
        name: "Payment fixture",
        description: "Fixture",
        categoryId: category.body.data.id,
        imageAssetIds: [image.id],
        selling: true,
        variants: [
          {
            sku: `PAY-${randomUUID().slice(0, 8)}`,
            attributes: { color: "blue" },
            price: "1250",
            stock: 6,
            selling: true,
          },
        ],
      });
    expect(product.status).toBe(201);
    const address = await request(app.getHttpServer())
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .send({
        recipientName: "Buyer",
        phone: "0901234567",
        line1: "1 Test Road",
        ward: "Ward",
        district: "District",
        province: "HCMC",
        country: "VN",
        isDefault: true,
      });
    expect(address.status).toBe(201);
    const cart = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .send({ variantId: product.body.data.variants[0].id, quantity: 2 });
    expect(cart.status).toBe(201);
    const itemId = cart.body.data.groups[0].items[0].id as string;
    const quote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .send({
        cartItemIds: [itemId],
        addressId: address.body.data.id,
        paymentMethod: "MOCK",
      });
    expect(quote.status).toBe(201);
    const checkout = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quote.body.data.quoteId });
    expect(checkout.status).toBe(201);
    return {
      buyerToken: buyer.body.data.accessToken as string,
      buyerId: buyer.body.data.user.id,
      ownerToken: owner.body.data.accessToken as string,
      shopId: shopResponse.body.data.id as string,
      orderId: checkout.body.data.id as string,
      variantId: product.body.data.variants[0].id as string,
    };
  }

  async function twoShopFixture() {
    const first = await fixture();
    const second = await fixture();
    const buyer = `Bearer ${first.buyerToken}`;
    for (const variantId of [first.variantId, second.variantId]) {
      const added = await request(app.getHttpServer())
        .post("/api/v1/cart/items")
        .set("Authorization", buyer)
        .send({ variantId, quantity: 1 });
      expect(added.status).toBe(201);
    }
    const cart = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Authorization", buyer);
    expect(cart.status).toBe(200);
    const cartItemIds = cart.body.data.groups.flatMap(
      (group: { items: Array<{ id: string }> }) =>
        group.items.map((item) => item.id),
    );
    const address = await db.prisma.address.findFirstOrThrow({
      where: { userId: first.buyerId },
    });
    const quote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", buyer)
      .send({ cartItemIds, addressId: address.id, paymentMethod: "MOCK" });
    expect(quote.status).toBe(201);
    const checkout = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quote.body.data.quoteId });
    expect(checkout.status).toBe(201);
    return {
      buyer,
      orderId: checkout.body.data.id as string,
      variants: [first.variantId, second.variantId],
      first,
    };
  }

  it("rejects whole-order cancellation with a confirmed part without changing either part", async () => {
    const test = await twoShopFixture();
    const attempt = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(attempt.status).toBe(201);
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", test.buyer)
    ).body.data;
    const paid = await request(app.getHttpServer())
      .post(`/api/v1/payments/${attempt.body.data.id}/mock-result`)
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        outcome: "SUCCEEDED",
        expectedVersion: order.version,
      });
    expect(paid.status).toBe(200);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", test.buyer)
    ).body.data;
    const part = order.sellerOrders.find(
      (value: { shopId: string }) => value.shopId === test.first.shopId,
    );
    const confirm = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.first.shopId}/orders/${part.id}/confirm`)
      .set("Authorization", `Bearer ${test.first.ownerToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: part.version });
    expect(confirm.status).toBe(200);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", test.buyer)
    ).body.data;
    const beforeParts = await db.prisma.sellerOrder.findMany({
      where: { orderId: test.orderId },
      orderBy: { id: "asc" },
    });
    const beforeStock = await db.prisma.inventory.findMany({
      where: { variantId: { in: test.variants } },
      orderBy: { variantId: "asc" },
    });
    const result = await request(app.getHttpServer())
      .post(`/api/v1/orders/${test.orderId}/cancel`)
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Cancel all", expectedVersion: order.version });
    expect(result.status).toBe(409);
    expect(result.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "blockingSellerOrderIds",
          message: part.id,
        }),
      ]),
    );
    expect(
      await db.prisma.sellerOrder.findMany({
        where: { orderId: test.orderId },
        orderBy: { id: "asc" },
      }),
    ).toEqual(beforeParts);
    expect(
      await db.prisma.inventory.findMany({
        where: { variantId: { in: test.variants } },
        orderBy: { variantId: "asc" },
      }),
    ).toEqual(beforeStock);
  }, 60_000);

  it("part cancellation invalidates the original attempt; late success refunds both original parts", async () => {
    const test = await twoShopFixture();
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", test.buyer)
    ).body.data;
    expect(order.sellerOrders).toHaveLength(2);
    const part = order.sellerOrders[0];
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${test.orderId}/seller-orders/${part.id}/cancel`)
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Changed mind", expectedVersion: part.version });
    expect(cancelled.status).toBe(200);
    const original = await db.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: started.body.data.id },
    });
    expect(original.status).toBe("CANCELLED");
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", test.buyer)
    ).body.data;
    expect(
      order.sellerOrders.map((item: { status: string }) => item.status).sort(),
    ).toEqual(["CANCELLED", "PENDING"]);
    const beforeStock = await db.prisma.inventory.findMany({
      where: { variantId: { in: test.variants } },
      orderBy: { variantId: "asc" },
    });
    const late = await request(app.getHttpServer())
      .post(`/api/v1/payments/${original.id}/mock-result`)
      .set("Authorization", test.buyer)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        outcome: "SUCCEEDED",
        expectedVersion: order.version,
      });
    expect(late.status).toBe(200);
    expect(late.body.data).toMatchObject({
      settlementKind: "LATE_COMPENSATION",
      originalAttemptId: original.id,
      amount: "2500",
    });
    const compensation = await db.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: late.body.data.id },
      include: { allocations: { include: { refund: true } } },
    });
    expect(compensation.targetSellerOrdersSnapshot).toEqual(
      original.targetSellerOrdersSnapshot,
    );
    expect(compensation.allocations).toHaveLength(2);
    expect(
      compensation.allocations.every((allocation) =>
        allocation.refund?.amount.equals(allocation.amount),
      ),
    ).toBe(true);
    const after = await db.prisma.sellerOrder.findMany({
      where: { orderId: test.orderId },
    });
    expect(after.map((item) => item.status).sort()).toEqual([
      "CANCELLED",
      "PENDING",
    ]);
    const afterStock = await db.prisma.inventory.findMany({
      where: { variantId: { in: test.variants } },
      orderBy: { variantId: "asc" },
    });
    expect(afterStock.map((item) => item.availableQuantity)).toEqual(
      beforeStock.map((item) => item.availableQuantity),
    );
  }, 60_000);

  it("captures exactly once, cancels atomically, restores stock, and records a full refund", async () => {
    const test = await fixture();
    const buyer = `Bearer ${test.buyerToken}`;
    const startKey = randomUUID();
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", startKey)
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    for (let i = 0; i < 10; i++) {
      const replay = await request(app.getHttpServer())
        .post("/api/v1/payments/mock-attempts")
        .set("Authorization", buyer)
        .set("Idempotency-Key", startKey)
        .send({ orderId: test.orderId });
      expect(replay.status).toBe(201);
      expect(replay.body.data.id).toBe(started.body.data.id);
    }
    const startConflict = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", startKey)
      .send({ orderId: randomUUID() });
    expect(startConflict.status).toBe(409);
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const failed = await request(app.getHttpServer())
      .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        outcome: "FAILED",
        expectedVersion: order.version,
      });
    expect(failed.status).toBe(200);
    const retryKey = randomUUID();
    const retry = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", retryKey)
      .send({ orderId: test.orderId });
    expect(retry.status).toBe(201);
    const retryReplay = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", retryKey)
      .send({ orderId: test.orderId });
    expect(retryReplay.body.data.id).toBe(retry.body.data.id);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const captureKey = randomUUID();
    const captureBody = {
      eventId: randomUUID(),
      outcome: "SUCCEEDED",
      expectedVersion: order.version,
    };
    const paid = await request(app.getHttpServer())
      .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", captureKey)
      .send(captureBody);
    expect(paid.status).toBe(200);
    for (let i = 0; i < 10; i++) {
      const captureReplay = await request(app.getHttpServer())
        .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", captureKey)
        .send(captureBody);
      expect(captureReplay.status).toBe(200);
      expect(captureReplay.body.data.id).toBe(paid.body.data.id);
    }
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", captureKey)
          .send({ ...captureBody, outcome: "FAILED" })
      ).status,
    ).toBe(409);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    expect(order.capturedAmount).toBe("2500");
    expect(
      order.payments.filter(
        (attempt: { status: string }) => attempt.status === "SUCCEEDED",
      ),
    ).toHaveLength(1);
    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        outcome: "SUCCEEDED",
        expectedVersion: order.version,
      });
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.id).toBe(retry.body.data.id);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const conflictKey = randomUUID();
    const conflictBody = {
      eventId: randomUUID(),
      outcome: "FAILED",
      expectedVersion: order.version,
    };
    const sendConflict = (key: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", key)
        .send(conflictBody);
    const firstConflict = await sendConflict(conflictKey);
    expect(firstConflict.status).toBe(409);
    const afterConflict = await db.prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: test.orderId },
      include: { payment: true },
    });
    for (const key of [conflictKey, randomUUID()]) {
      const response = await sendConflict(key);
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe(firstConflict.body.error.code);
      expect(response.body.error.message).toBe(
        firstConflict.body.error.message,
      );
    }
    const afterReplays = await db.prisma.marketplaceOrder.findUniqueOrThrow({
      where: { id: test.orderId },
      include: { payment: true },
    });
    expect(afterReplays.version).toBe(afterConflict.version);
    expect(afterReplays.payment?.version).toBe(afterConflict.payment?.version);
    expect(
      await db.prisma.paymentEvent.count({
        where: { externalEventId: conflictBody.eventId },
      }),
    ).toBe(1);
    const persistedAttempt = await db.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: retry.body.data.id },
      include: { allocations: { include: { refund: true } } },
    });
    expect(persistedAttempt.status).toBe("SUCCEEDED");
    expect(persistedAttempt.allocations).toHaveLength(1);
    expect(persistedAttempt.allocations[0]?.refund).toBeNull();
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const cancelKey = randomUUID();
    const cancelBody = {
      reason: "Buyer changed their mind",
      expectedVersion: order.version,
    };
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${test.orderId}/cancel`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", cancelKey)
      .send(cancelBody);
    expect(cancelled.status).toBe(200);
    for (let i = 0; i < 10; i++) {
      const cancelReplay = await request(app.getHttpServer())
        .post(`/api/v1/orders/${test.orderId}/cancel`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", cancelKey)
        .send(cancelBody);
      expect(cancelReplay.status).toBe(200);
      expect(cancelReplay.body.data.replay).toBe(true);
    }
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/orders/${test.orderId}/cancel`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", cancelKey)
          .send({ ...cancelBody, reason: "Changed reason" })
      ).status,
    ).toBe(409);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.refundedAmount).toBe("2500");
    expect(
      await db.prisma.inventory
        .findUniqueOrThrow({ where: { variantId: test.variantId } })
        .then((row) => row.availableQuantity),
    ).toBe(6);
  }, 60_000);

  it("expires from database time and refunds a late successful callback without reopening the order", async () => {
    app.get(PaymentExpiryJob).onModuleDestroy();
    const test = await fixture();
    const buyer = `Bearer ${test.buyerToken}`;
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    const fixtureTime = Date.now();
    const originalAttempt = await db.prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: started.body.data.id },
    });
    const originalSnapshot =
      originalAttempt.targetSellerOrdersSnapshot as Array<{
        sellerOrderId: string;
        amount: string;
      }>;
    expect(originalSnapshot).toHaveLength(1);
    expect(originalSnapshot[0]).toEqual({
      sellerOrderId: expect.any(String),
      amount: "2500",
    });
    await expect(
      db.prisma
        .$executeRaw`UPDATE payment_attempts SET target_seller_orders_snapshot = '[]'::jsonb WHERE id = ${originalAttempt.id}::uuid`,
    ).rejects.toThrow();
    await expect(
      db.prisma
        .$executeRaw`INSERT INTO payment_attempts (payment_id, attempt_number, provider, status, target_seller_orders_snapshot, amount, operation_key) VALUES (${originalAttempt.paymentId}::uuid, 900, 'MOCK', 'FAILED', '{}'::jsonb, 2500, ${randomUUID()})`,
    ).rejects.toThrow();
    await expect(
      db.prisma
        .$executeRaw`INSERT INTO payment_attempts (payment_id, attempt_number, provider, status, target_seller_orders_snapshot, amount, operation_key) VALUES (${originalAttempt.paymentId}::uuid, 901, 'MOCK', 'FAILED', NULL, 2500, ${randomUUID()})`,
    ).rejects.toThrow();
    await db.prisma.marketplaceOrder.update({
      where: { id: test.orderId },
      data: {
        createdAt: new Date(fixtureTime - 16 * 60_000),
        paymentDeadline: new Date(fixtureTime - 60_000),
      },
    });
    const restartedJob = new PaymentExpiryJob(db, app.get(PaymentService));
    restartedJob.onModuleInit();
    try {
      for (let i = 0; i < 100; i++) {
        const current = await db.prisma.sellerOrder.findFirstOrThrow({
          where: { orderId: test.orderId },
        });
        if (current.status === "CANCELLED") break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      restartedJob.onModuleDestroy();
    }
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    expect(order.status).toBe("CANCELLED");
    expect(
      await db.prisma.inventory
        .findUniqueOrThrow({ where: { variantId: test.variantId } })
        .then((row) => row.availableQuantity),
    ).toBe(6);
    const lateKey = randomUUID();
    const lateBody = {
      eventId: randomUUID(),
      outcome: "SUCCEEDED",
      expectedVersion: order.version,
    };
    const late = await request(app.getHttpServer())
      .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", lateKey)
      .send(lateBody);
    expect(late.status).toBe(200);
    expect(late.body.data).toMatchObject({
      settlementKind: "LATE_COMPENSATION",
      status: "SUCCEEDED",
      originalAttemptId: started.body.data.id,
      amount: "2500",
    });
    expect(late.body.data.id).not.toBe(started.body.data.id);
    for (const key of [lateKey, randomUUID()]) {
      const replay = await request(app.getHttpServer())
        .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", key)
        .send(lateBody);
      expect(replay.status).toBe(200);
      expect(replay.body.data).toEqual(late.body.data);
    }
    const history = await request(app.getHttpServer())
      .get(`/api/v1/payments?orderId=${test.orderId}`)
      .set("Authorization", buyer);
    expect(history.status).toBe(200);
    expect(history.body.data.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([started.body.data.id, late.body.data.id]),
    );
    const source = await db.prisma.paymentEvent.findFirstOrThrow({
      where: { externalEventId: lateBody.eventId },
    });
    expect(source.attemptId).toBe(started.body.data.id);
    const compensation = await db.prisma.paymentAttempt.findUniqueOrThrow({
      where: { compensatesEventId: source.id },
      include: { allocations: { include: { refund: true } } },
    });
    expect(compensation.id).toBe(late.body.data.id);
    expect(compensation.targetSellerOrdersSnapshot).toEqual(originalSnapshot);
    expect(compensation.amount.toString()).toBe("2500");
    expect(compensation.allocations).toHaveLength(1);
    expect(compensation.allocations[0]?.refund?.amount.toString()).toBe("2500");
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    expect(order.status).toBe("CANCELLED");
    expect(order.paymentStatus).toBe("REFUNDED");
    expect(order.refundedAmount).toBe("2500");
    expect(order.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          settlementKind: "LATE_COMPENSATION",
          status: "SUCCEEDED",
        }),
      ]),
    );
  }, 60_000);
});
