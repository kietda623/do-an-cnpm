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
import { resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";

describe("US7 fulfillment and suspended shop PostgreSQL integration", () => {
  let app: INestApplication;
  let db: DatabaseService;

  async function startApp() {
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
  }

  beforeAll(async () => {
    await resetAndDeployMigrations();
    await startApp();
  }, 120_000);
  afterAll(async () => app?.close());

  async function register(name: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `fulfillment-${randomUUID()}@example.test`,
        password,
        fullName: name,
        clientPlatform: "ANDROID",
      });
    expect(response.status).toBe(201);
    return {
      id: response.body.data.user.id as string,
      token: response.body.data.accessToken as string,
    };
  }

  async function fixture(paymentMethod: "COD" | "MOCK" = "COD") {
    const seller = await register("Fulfillment Seller");
    const buyer = await register("Fulfillment Buyer");
    const admin = await register("Fulfillment Admin");
    await db.prisma.user.update({
      where: { id: admin.id },
      data: { systemRole: "ADMIN" },
    });
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: seller.id,
        purpose: "SHOP_LOGO",
        objectKey: `fulfillment/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shop = await request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        name: `Fulfillment Shop ${randomUUID().slice(0, 6)}`,
        slug: `fulfillment-${randomUUID().slice(0, 8)}`,
        description: "Fulfillment fixture",
        logoAssetId: logo.id,
        contactAddress: "Test",
        phone: "0901234567",
      });
    expect(shop.status).toBe(201);
    const shopId = shop.body.data.id as string;
    const approved = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${shopId}/approve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ expectedVersion: 0 });
    expect(approved.status).toBe(200);
    const category = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        name: `Fulfillment ${randomUUID().slice(0, 6)}`,
        parentId: null,
        visible: true,
      });
    expect(category.status).toBe(201);
    const image = await db.prisma.asset.create({
      data: {
        uploaderUserId: seller.id,
        shopId,
        purpose: "PRODUCT_IMAGE",
        objectKey: `fulfillment/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const product = await request(app.getHttpServer())
      .post(`/api/v1/shops/${shopId}/products`)
      .set("Authorization", `Bearer ${seller.token}`)
      .send({
        name: "Fulfillment fixture",
        description: "Fixture",
        categoryId: category.body.data.id,
        imageAssetIds: [image.id],
        selling: true,
        variants: [
          {
            sku: `FUL-${randomUUID().slice(0, 8)}`,
            attributes: { color: "blue" },
            price: "1250",
            stock: 6,
            selling: true,
          },
        ],
      });
    expect(product.status).toBe(201);
    const variantId = product.body.data.variants[0].id as string;
    const productId = product.body.data.id as string;
    const address = await request(app.getHttpServer())
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${buyer.token}`)
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
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({ variantId, quantity: 2 });
    expect(cart.status).toBe(201);
    const quote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${buyer.token}`)
      .send({
        cartItemIds: [cart.body.data.groups[0].items[0].id],
        addressId: address.body.data.id,
        paymentMethod,
      });
    expect(quote.status).toBe(201);
    const checkout = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${buyer.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quote.body.data.quoteId });
    expect(checkout.status).toBe(201);
    return {
      seller,
      buyer,
      admin,
      shopId,
      productId,
      variantId,
      addressId: address.body.data.id as string,
      orderId: checkout.body.data.id as string,
      sellerOrderId: checkout.body.data.sellerOrders[0].id as string,
    };
  }

  async function suspend(test: Awaited<ReturnType<typeof fixture>>) {
    const shop = await db.prisma.shop.findUniqueOrThrow({
      where: { id: test.shopId },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${test.shopId}/suspend`)
      .set("Authorization", `Bearer ${test.admin.token}`)
      .send({ expectedVersion: shop.version, reason: "Temporary suspension" });
    expect(response.status).toBe(200);
  }

  async function payMock(test: Awaited<ReturnType<typeof fixture>>) {
    const auth = `Bearer ${test.buyer.token}`;
    const started = await request(app.getHttpServer())
      .post("/api/v1/payments/mock-attempts")
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ orderId: test.orderId });
    expect(started.status).toBe(201);
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${test.orderId}`)
      .set("Authorization", auth);
    const paid = await request(app.getHttpServer())
      .post(`/api/v1/payments/${started.body.data.id}/mock-result`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        outcome: "SUCCEEDED",
        expectedVersion: order.body.data.version,
      });
    expect(paid.status).toBe(200);
  }

  async function failedShipment(test: Awaited<ReturnType<typeof fixture>>) {
    const auth = `Bearer ${test.seller.token}`;
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    const packed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/pack`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: confirmed.body.data.version });
    expect(packed.status).toBe(200);
    let shipment = packed.body.data.shipment;
    for (const event of ["PICKED_UP", "IN_TRANSIT", "FAILED"]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/shipments/${shipment.id}/events`)
        .set("Authorization", auth)
        .set("Idempotency-Key", randomUUID())
        .send({
          eventId: randomUUID(),
          event,
          expectedVersion: shipment.version,
          ...(event === "FAILED" ? { reason: "Delivery failed" } : {}),
        });
      expect(response.status).toBe(200);
      shipment = response.body.data;
    }
    return shipment;
  }

  it("lets an active member read and reject an existing order after shop suspension", async () => {
    const test = await fixture();
    await suspend(test);
    const sellerAuth = `Bearer ${test.seller.token}`;
    const list = await request(app.getHttpServer())
      .get(`/api/v1/shops/${test.shopId}/orders`)
      .set("Authorization", sellerAuth);
    expect(list.status).toBe(200);
    expect(list.body.data.map((part: { id: string }) => part.id)).toContain(
      test.sellerOrderId,
    );
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}`)
      .set("Authorization", sellerAuth);
    expect(detail.status).toBe(200);
    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/reject`)
      .set("Authorization", sellerAuth)
      .set("Idempotency-Key", randomUUID())
      .send({
        expectedVersion: detail.body.data.version,
        reason: "Cannot fulfill",
      });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("CANCELLED");
  });

  it("lets the buyer cancel a pending part after suspension and restores stock once", async () => {
    const test = await fixture();
    await suspend(test);
    const buyerAuth = `Bearer ${test.buyer.token}`;
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${test.orderId}`)
      .set("Authorization", buyerAuth);
    expect(order.status).toBe(200);
    const key = randomUUID();
    for (let replay = 0; replay < 2; replay++) {
      const cancelled = await request(app.getHttpServer())
        .post(
          `/api/v1/orders/${test.orderId}/seller-orders/${test.sellerOrderId}/cancel`,
        )
        .set("Authorization", buyerAuth)
        .set("Idempotency-Key", key)
        .send({
          expectedVersion: order.body.data.sellerOrders[0].version,
          reason: "Changed mind",
        });
      expect(cancelled.status).toBe(200);
    }
    const inventory = await db.prisma.inventory.findUniqueOrThrow({
      where: { variantId: test.variantId },
    });
    expect(inventory.availableQuantity).toBe(6);
    expect(
      await db.prisma.inventoryMovement.count({
        where: { sellerOrderId: test.sellerOrderId, effectType: "RESTORE" },
      }),
    ).toBe(1);
  });

  it("allows COD confirmation and packing for an active member of a suspended shop", async () => {
    const test = await fixture();
    await suspend(test);
    const auth = `Bearer ${test.seller.token}`;
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe("CONFIRMED");
    const packed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/pack`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: confirmed.body.data.version });
    expect(packed.status).toBe(200);
    expect(packed.body.data.status).toBe("PACKING");
    expect(packed.body.data.shipment.status).toBe("WAITING_PICKUP");
    expect(packed.body.data.shipment.history[0].toStatus).toBe(
      "WAITING_PICKUP",
    );
    expect(
      await db.prisma.shipment.count({
        where: { sellerOrderId: test.sellerOrderId },
      }),
    ).toBe(1);
    let shipment = packed.body.data.shipment;
    for (const event of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
      const advanced = await request(app.getHttpServer())
        .post(`/api/v1/shipments/${shipment.id}/events`)
        .set("Authorization", auth)
        .set("Idempotency-Key", randomUUID())
        .send({
          eventId: randomUUID(),
          event,
          expectedVersion: shipment.version,
        });
      expect(advanced.status).toBe(200);
      expect(advanced.body.data.status).toBe(event);
      shipment = advanced.body.data;
    }
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${test.orderId}`)
      .set("Authorization", `Bearer ${test.buyer.token}`);
    expect(order.body.data.sellerOrders[0].status).toBe("DELIVERED");
    const sellerVersion = order.body.data.sellerOrders[0].version as number;
    expect(order.body.data.version).not.toBe(sellerVersion);
    const wrongVersion = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        expectedVersion: order.body.data.version,
      });
    expect(wrongVersion.status).toBe(409);
    const oldVersion = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ eventId: randomUUID(), expectedVersion: sellerVersion - 1 });
    expect(oldVersion.status).toBe(409);
    const otherSeller = await register("Other Seller");
    const crossShop = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", `Bearer ${otherSeller.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ eventId: randomUUID(), expectedVersion: sellerVersion });
    expect(crossShop.status).toBe(404);
    const codEventId = randomUUID();
    const codKey = randomUUID();
    const collected = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", auth)
      .set("Idempotency-Key", codKey)
      .send({ eventId: codEventId, expectedVersion: sellerVersion });
    expect(collected.status).toBe(200);
    const replay = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ eventId: codEventId, expectedVersion: sellerVersion });
    expect(replay.status).toBe(200);
    expect(replay.body.data.id).toBe(collected.body.data.id);
    expect(
      await db.prisma.paymentAllocation.count({
        where: {
          sellerOrderId: test.sellerOrderId,
          kind: "COD_COLLECTION",
        },
      }),
    ).toBe(1);
    expect(
      (
        await db.prisma.sellerOrder.findUniqueOrThrow({
          where: { id: test.sellerOrderId },
        })
      ).version,
    ).toBe(sellerVersion);
    await db.prisma.shopMember.update({
      where: { shopId_userId: { shopId: test.shopId, userId: test.seller.id } },
      data: { status: "REVOKED" },
    });
    const revokedReplay = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", auth)
      .set("Idempotency-Key", codKey)
      .send({ eventId: codEventId, expectedVersion: sellerVersion });
    expect(revokedReplay.status).toBe(404);
    const received = await request(app.getHttpServer())
      .post(
        `/api/v1/orders/${test.orderId}/seller-orders/${test.sellerOrderId}/receive`,
      )
      .set("Authorization", `Bearer ${test.buyer.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: order.body.data.sellerOrders[0].version });
    expect(received.status).toBe(200);
    expect(received.body.data.status).toBe("COMPLETED");
  });

  it("lets Admin confirm and pack an existing order after the Seller is locked", async () => {
    const test = await fixture();
    await db.prisma.user.update({
      where: { id: test.seller.id },
      data: { status: "LOCKED", authVersion: { increment: 1 } },
    });
    const sellerAttempt = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", `Bearer ${test.seller.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(sellerAttempt.status).toBe(401);

    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/admin/seller-orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", `Bearer ${test.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0, reason: "Seller account is locked" });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe("CONFIRMED");

    const packed = await request(app.getHttpServer())
      .post(`/api/v1/admin/seller-orders/${test.sellerOrderId}/pack`)
      .set("Authorization", `Bearer ${test.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        expectedVersion: confirmed.body.data.version,
        reason: "Seller account is locked",
      });
    expect(packed.status).toBe(200);
    expect(packed.body.data.status).toBe("PACKING");
    expect(packed.body.data.shipment.status).toBe("WAITING_PICKUP");

    const auditEvents = await db.prisma.auditEvent.findMany({
      where: {
        targetType: "SellerOrder",
        targetId: test.sellerOrderId,
        action: {
          in: ["ADMIN_SELLER_ORDER_CONFIRM", "ADMIN_SELLER_ORDER_PACK"],
        },
      },
      orderBy: { action: "asc" },
    });
    expect(auditEvents).toHaveLength(2);
    expect(auditEvents.map((event) => event.reason)).toEqual([
      "Seller account is locked",
      "Seller account is locked",
    ]);
  });

  it("allows Admin COD collection after delivery for a suspended shop", async () => {
    const test = await fixture();
    await suspend(test);
    const sellerAuth = `Bearer ${test.seller.token}`;
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", sellerAuth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    const packed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/pack`)
      .set("Authorization", sellerAuth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: confirmed.body.data.version });
    expect(packed.status).toBe(200);
    let shipment = packed.body.data.shipment;
    for (const event of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/shipments/${shipment.id}/events`)
        .set("Authorization", sellerAuth)
        .set("Idempotency-Key", randomUUID())
        .send({
          eventId: randomUUID(),
          event,
          expectedVersion: shipment.version,
        });
      expect(response.status).toBe(200);
      shipment = response.body.data;
    }
    const sellerOrder = await request(app.getHttpServer())
      .get(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}`)
      .set("Authorization", sellerAuth);
    expect(sellerOrder.status).toBe(200);
    const collected = await request(app.getHttpServer())
      .post(
        `/api/v1/payments/seller-orders/${test.sellerOrderId}/cod-collection`,
      )
      .set("Authorization", `Bearer ${test.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        expectedVersion: sellerOrder.body.data.version,
      });
    expect(collected.status).toBe(200);
    expect(
      await db.prisma.paymentAllocation.count({
        where: { sellerOrderId: test.sellerOrderId, kind: "COD_COLLECTION" },
      }),
    ).toBe(1);
  });

  it("keeps the seller order and shipment persisted after an API restart", async () => {
    const test = await fixture();
    await suspend(test);
    const auth = `Bearer ${test.seller.token}`;
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    const packed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/pack`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: confirmed.body.data.version });
    expect(packed.status).toBe(200);
    await app.close();
    await startApp();
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}`)
      .set("Authorization", auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe("PACKING");
    expect(detail.body.data.shipment.id).toBe(packed.body.data.shipment.id);
    expect(detail.body.data.shipment.history[0].toStatus).toBe(
      "WAITING_PICKUP",
    );
    expect(
      await db.prisma.inventoryMovement.count({
        where: { sellerOrderId: test.sellerOrderId, kind: "SALE" },
      }),
    ).toBe(1);
  });

  it("blocks new checkout for a suspended shop", async () => {
    const test = await fixture();
    const cart = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${test.buyer.token}`)
      .send({ variantId: test.variantId, quantity: 1 });
    expect(cart.status).toBe(201);
    await suspend(test);
    const hiddenBySuspension = await request(app.getHttpServer())
      .patch(`/api/v1/shops/${test.shopId}/products/${test.productId}`)
      .set("Authorization", `Bearer ${test.seller.token}`)
      .send({ selling: false, expectedVersion: 0 });
    expect(hiddenBySuspension.status).toBe(404);
    expect(
      (
        await db.prisma.product.findUniqueOrThrow({
          where: { id: test.productId },
        })
      ).saleStatus,
    ).toBe("ACTIVE");
    const quote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${test.buyer.token}`)
      .send({
        cartItemIds: [cart.body.data.groups[0].items[0].id],
        addressId: test.addressId,
        paymentMethod: "COD",
      });
    if (quote.status === 201) {
      const checkout = await request(app.getHttpServer())
        .post("/api/v1/checkout")
        .set("Authorization", `Bearer ${test.buyer.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ quoteId: quote.body.data.quoteId });
      expect(checkout.status).not.toBe(201);
    }
  });

  it("returns no seller order data after membership revocation or account lock", async () => {
    const test = await fixture();
    await suspend(test);
    const path = `/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}`;
    const stranger = await register("Other Seller");
    expect(
      (
        await request(app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${stranger.token}`)
      ).status,
    ).toBe(404);
    await db.prisma.shopMember.update({
      where: { shopId_userId: { shopId: test.shopId, userId: test.seller.id } },
      data: { status: "REVOKED" },
    });
    expect(
      (
        await request(app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${test.seller.token}`)
      ).status,
    ).toBe(404);
    await db.prisma.shopMember.update({
      where: { shopId_userId: { shopId: test.shopId, userId: test.seller.id } },
      data: { status: "ACTIVE" },
    });
    await db.prisma.user.update({
      where: { id: test.seller.id },
      data: { status: "LOCKED", authVersion: { increment: 1 } },
    });
    expect(
      (
        await request(app.getHttpServer())
          .get(path)
          .set("Authorization", `Bearer ${test.seller.token}`)
      ).status,
    ).toBe(401);
  });

  it("retries a failed shipment without moving the seller order backward or returning stock", async () => {
    const test = await fixture();
    await suspend(test);
    const failed = await failedShipment(test);
    const key = randomUUID();
    for (let replay = 0; replay < 2; replay++) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/shipments/${failed.id}/retry`)
        .set("Authorization", `Bearer ${test.seller.token}`)
        .set("Idempotency-Key", key)
        .send({ reason: "Try again", expectedVersion: failed.version });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe("WAITING_PICKUP");
      expect(response.body.data.attemptNumber).toBe(2);
    }
    const part = await db.prisma.sellerOrder.findUniqueOrThrow({
      where: { id: test.sellerOrderId },
    });
    expect(part.status).toBe("SHIPPING");
    expect(
      (
        await db.prisma.inventory.findUniqueOrThrow({
          where: { variantId: test.variantId },
        })
      ).availableQuantity,
    ).toBe(4);
    expect(
      await db.prisma.inventoryMovement.count({
        where: { sellerOrderId: test.sellerOrderId, effectType: "RESTORE" },
      }),
    ).toBe(0);
    expect(
      await db.prisma.shipmentEvent.count({
        where: { shipmentId: failed.id, toStatus: "WAITING_PICKUP" },
      }),
    ).toBe(2);
  });

  it("lets Admin confirm return once after failed delivery and restores inventory", async () => {
    const test = await fixture();
    const failed = await failedShipment(test);
    const key = randomUUID();
    for (let replay = 0; replay < 2; replay++) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/admin/shipments/${failed.id}/return-confirmation`)
        .set("Authorization", `Bearer ${test.admin.token}`)
        .set("Idempotency-Key", key)
        .send({ reason: "Parcel returned", expectedVersion: failed.version });
      expect(response.status).toBe(200);
    }
    const part = await db.prisma.sellerOrder.findUniqueOrThrow({
      where: { id: test.sellerOrderId },
    });
    expect(part.status).toBe("CANCELLED");
    expect(
      (
        await db.prisma.inventory.findUniqueOrThrow({
          where: { variantId: test.variantId },
        })
      ).availableQuantity,
    ).toBe(6);
    expect(
      await db.prisma.inventoryMovement.count({
        where: {
          sellerOrderId: test.sellerOrderId,
          effectType: "RESTORE",
          kind: "CONFIRMED_RETURN",
        },
      }),
    ).toBe(1);
    const secondKey = await request(app.getHttpServer())
      .post(`/api/v1/admin/shipments/${failed.id}/return-confirmation`)
      .set("Authorization", `Bearer ${test.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Parcel returned", expectedVersion: failed.version });
    expect(secondKey.status).toBe(409);
  });

  it("requires mock payment before confirmation and refunds it once on confirmed return", async () => {
    const test = await fixture("MOCK");
    const auth = `Bearer ${test.seller.token}`;
    const unpaid = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(unpaid.status).toBe(409);
    await payMock(test);
    const failed = await failedShipment(test);
    const returned = await request(app.getHttpServer())
      .post(`/api/v1/admin/shipments/${failed.id}/return-confirmation`)
      .set("Authorization", `Bearer ${test.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Parcel returned", expectedVersion: failed.version });
    expect(returned.status).toBe(200);
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${test.orderId}`)
      .set("Authorization", `Bearer ${test.buyer.token}`);
    expect(order.body.data.refundedAmount).toBe("2500");
    expect(order.body.data.paymentStatus).toBe("REFUNDED");
    expect(
      await db.prisma.simulatedRefund.count({
        where: {
          sellerOrderId: test.sellerOrderId,
          reason: "CONFIRMED_RETURN",
        },
      }),
    ).toBe(1);
  });

  it("rejects cross-shop writes, skipped shipment steps, and premature buyer receipt", async () => {
    const test = await fixture();
    await suspend(test);
    const stranger = await register("Stranger Seller");
    const denied = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(denied.status).toBe(404);
    const auth = `Bearer ${test.seller.token}`;
    const confirmed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/confirm`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 0 });
    expect(confirmed.status).toBe(200);
    const packed = await request(app.getHttpServer())
      .post(`/api/v1/shops/${test.shopId}/orders/${test.sellerOrderId}/pack`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: confirmed.body.data.version });
    expect(packed.status).toBe(200);
    const shipment = packed.body.data.shipment;
    const jumped = await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipment.id}/events`)
      .set("Authorization", auth)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        event: "DELIVERED",
        expectedVersion: shipment.version,
      });
    expect(jumped.status).toBe(409);
    const crossShop = await request(app.getHttpServer())
      .post(`/api/v1/shipments/${shipment.id}/events`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({
        eventId: randomUUID(),
        event: "PICKED_UP",
        expectedVersion: shipment.version,
      });
    expect(crossShop.status).toBe(404);
    const received = await request(app.getHttpServer())
      .post(
        `/api/v1/orders/${test.orderId}/seller-orders/${test.sellerOrderId}/receive`,
      )
      .set("Authorization", `Bearer ${test.buyer.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: packed.body.data.version });
    expect(received.status).toBe(409);
  });
});
