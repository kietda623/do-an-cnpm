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
import { resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `payment-${randomUUID()}@example.test`;
type Auth = { body: { data: { accessToken: string; user: { id: string } } } };

describe("mock payments and cancellation PostgreSQL integration", () => {
  let app: INestApplication;
  let db: DatabaseService;
  beforeAll(async () => {
    await resetAndDeployMigrations();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
      .send({ email: email(), password, fullName: name, clientPlatform: "ANDROID" });
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
      .send({ name: `Payments ${randomUUID().slice(0, 6)}`, parentId: null, visible: true });
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
      .send({ cartItemIds: [itemId], addressId: address.body.data.id, paymentMethod: "MOCK" });
    expect(quote.status).toBe(201);
    const checkout = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quote.body.data.quoteId });
    expect(checkout.status).toBe(201);
    return {
      buyerToken: buyer.body.data.accessToken as string,
      orderId: checkout.body.data.id as string,
      variantId: product.body.data.variants[0].id as string,
    };
  }

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
    const replay = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", startKey)
      .send({ orderId: test.orderId });
    expect(replay.body.data.id).toBe(started.body.data.id);
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const failed = await request(app.getHttpServer())
      .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ eventId: randomUUID(), outcome: "FAILED", expectedVersion: order.version });
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
    const captureReplay = await request(app.getHttpServer())
      .post(`/api/v1/payments/${retry.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", captureKey)
      .send(captureBody);
    expect(captureReplay.status).toBe(200);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    expect(order.capturedAmount).toBe("2500");
    expect(
      order.payments.filter((attempt: { status: string }) => attempt.status === "SUCCEEDED"),
    ).toHaveLength(1);
    const cancelKey = randomUUID();
    const cancelBody = { reason: "Buyer changed their mind", expectedVersion: order.version };
    const cancelled = await request(app.getHttpServer())
      .post(`/api/v1/orders/${test.orderId}/cancel`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", cancelKey)
      .send(cancelBody);
    expect(cancelled.status).toBe(200);
    const cancelReplay = await request(app.getHttpServer())
      .post(`/api/v1/orders/${test.orderId}/cancel`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", cancelKey)
      .send(cancelBody);
    expect(cancelReplay.body.data.replay).toBe(true);
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
    const test = await fixture();
    const buyer = `Bearer ${test.buyerToken}`;
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    const fixtureTime = Date.now();
    await db.prisma.marketplaceOrder.update({
      where: { id: test.orderId },
      data: {
        createdAt: new Date(fixtureTime - 16 * 60_000),
        paymentDeadline: new Date(fixtureTime - 60_000),
      },
    });
    expect([0, 1]).toContain(await app.get(PaymentService).expireDueOrders());
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
    const late = await request(app.getHttpServer())
      .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ eventId: randomUUID(), outcome: "SUCCEEDED", expectedVersion: order.version });
    expect(late.status).toBe(200);
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
        expect.objectContaining({ settlementKind: "LATE_COMPENSATION", status: "SUCCEEDED" }),
      ]),
    );
  }, 60_000);
});
