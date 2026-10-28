import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../apps/api/src/app.module.js";
import { ContractErrorFilter } from "../../apps/api/src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../apps/api/src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../apps/api/src/common/http/validation.pipe.js";
import { DatabaseService } from "../../apps/api/src/database/prisma.service.js";
import { resetAndDeployMigrations } from "../../apps/api/test/helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `payment-${randomUUID()}@example.test`;
type Auth = { body: { data: { accessToken: string; user: { id: string } } } };

describe("payment and cancellation concurrency on PostgreSQL", () => {
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

  it("replays concurrent start, result and cancel ten times with one effect", async () => {
    const test = await fixture();
    const buyer = `Bearer ${test.buyerToken}`;
    const startKey = randomUUID();
    const starts = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/payments/mock-attempts")
          .set("Authorization", buyer)
          .set("Idempotency-Key", startKey)
          .send({ orderId: test.orderId }),
      ),
    );
    expect(starts.map((item) => item.status)).toEqual(Array(10).fill(201));
    expect(new Set(starts.map((item) => item.body.data.id)).size).toBe(1);
    const attemptId = starts[0]!.body.data.id;
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/v1/payments/mock-attempts")
          .set("Authorization", buyer)
          .set("Idempotency-Key", startKey)
          .send({ orderId: randomUUID() })
      ).status,
    ).toBe(409);
    let order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const payKey = randomUUID();
    const body = {
      eventId: randomUUID(),
      outcome: "SUCCEEDED",
      expectedVersion: order.version,
    };
    const pays = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/payments/${attemptId}/mock-result`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", payKey)
          .send(body),
      ),
    );
    expect(pays.map((item) => item.status)).toEqual(Array(10).fill(200));
    expect(new Set(pays.map((item) => item.body.data.id)).size).toBe(1);
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/payments/${attemptId}/mock-result`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", payKey)
          .send({ ...body, outcome: "FAILED" })
      ).status,
    ).toBe(409);
    order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const cancelKey = randomUUID();
    const cancelBody = {
      reason: "Cancel test order",
      expectedVersion: order.version,
    };
    const cancellations = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`/api/v1/orders/${test.orderId}/cancel`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", cancelKey)
          .send(cancelBody),
      ),
    );
    expect(cancellations.map((item) => item.status)).toEqual(
      Array(10).fill(200),
    );
    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/v1/orders/${test.orderId}/cancel`)
          .set("Authorization", buyer)
          .set("Idempotency-Key", cancelKey)
          .send({ ...cancelBody, reason: "Different reason" })
      ).status,
    ).toBe(409);
    expect(
      await db.prisma.paymentAllocation.count({ where: { attemptId } }),
    ).toBe(1);
    expect(
      await db.prisma.simulatedRefund.count({
        where: { allocation: { attemptId } },
      }),
    ).toBe(1);
    expect(
      (
        await db.prisma.inventory.findUniqueOrThrow({
          where: { variantId: test.variantId },
        })
      ).availableQuantity,
    ).toBe(6);
  }, 120_000);

  it("serializes cancellation racing with a successful result without restoring stock twice", async () => {
    const test = await fixture();
    const buyer = `Bearer ${test.buyerToken}`;
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", buyer)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    const order = (
      await request(app.getHttpServer())
        .get(`/api/v1/orders/${test.orderId}`)
        .set("Authorization", buyer)
    ).body.data;
    const [paid, cancelled] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", randomUUID())
        .send({
          eventId: randomUUID(),
          outcome: "SUCCEEDED",
          expectedVersion: order.version,
        }),
      request(app.getHttpServer())
        .post(`/api/v1/orders/${test.orderId}/cancel`)
        .set("Authorization", buyer)
        .set("Idempotency-Key", randomUUID())
        .send({ reason: "Race cancellation", expectedVersion: order.version }),
    ]);
    expect([paid.status, cancelled.status].sort()).toEqual([200, 409]);
    const part = await db.prisma.sellerOrder.findFirstOrThrow({
      where: { orderId: test.orderId },
    });
    const restores = await db.prisma.inventoryMovement.count({
      where: { sellerOrderId: part.id, effectType: "RESTORE" },
    });
    expect(restores).toBeLessThanOrEqual(1);
    expect(
      (
        await db.prisma.inventory.findUniqueOrThrow({
          where: { variantId: test.variantId },
        })
      ).availableQuantity,
    ).toBe(part.status === "CANCELLED" ? 6 : 4);
  }, 60_000);
});
