import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Pool } from "pg";
import { AppModule } from "../../src/app.module.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../src/common/http/validation.pipe.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import {
  createTestPool,
  resetAndDeployMigrations,
} from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `admin-operations-${randomUUID()}@example.test`;
type Auth = {
  status: number;
  body: {
    data: {
      accessToken: string;
      refreshToken: string;
      user: { id: string; version: number };
    };
  };
};
type ShopFixture = {
  id: string;
  name: string;
  ownerId: string;
  ownerToken: string;
};

describe("US9 Admin account lifecycle PostgreSQL integration", () => {
  let app: INestApplication;
  let pool: Pool;
  let db: DatabaseService;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
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

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function register(fullName: string): Promise<Auth> {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: email(), password, fullName, clientPlatform: "ANDROID" });
  }

  async function makeAdmin(): Promise<Auth> {
    const admin = await register("Admin Operator");
    expect(admin.status).toBe(201);
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    return admin;
  }

  async function makeShop(
    name = `Admin fixture ${randomUUID().slice(0, 8)}`,
  ): Promise<ShopFixture> {
    const owner = await register(`${name} Seller`);
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `admin-fixture/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shop = await db.prisma.shop.create({
      data: {
        ownerUserId: owner.body.data.user.id,
        name,
        slugNormalized: `admin-${randomUUID().slice(0, 12)}`,
        description: "A disposable integration shop",
        logoAssetId: logo.id,
        contactAddress: "1 Integration Street",
        phone: "0901234567",
        status: "ACTIVE",
        approvedAt: new Date(),
        members: {
          create: {
            userId: owner.body.data.user.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
      },
    });
    return {
      id: shop.id,
      name: shop.name,
      ownerId: owner.body.data.user.id,
      ownerToken: owner.body.data.accessToken,
    };
  }

  async function makeProduct(shopId: string) {
    const category = await db.prisma.category.create({
      data: {
        name: `Admin Category ${randomUUID().slice(0, 8)}`,
        slug: `admin-category-${randomUUID().slice(0, 12)}`,
        status: "VISIBLE",
      },
    });
    const product = await db.prisma.product.create({
      data: {
        shopId,
        categoryId: category.id,
        name: "Admin moderation product",
        description:
          "Product used to verify that hiding blocks future checkouts.",
        saleStatus: "ACTIVE",
      },
    });
    const variant = await db.prisma.productVariant.create({
      data: {
        productId: product.id,
        shopId,
        skuNormalized: `ADMIN-${randomUUID().slice(0, 12)}`,
        attributes: { size: "M" },
        attributesKey: JSON.stringify({ size: "M" }),
        price: "100",
        saleStatus: "ACTIVE",
        inventory: { create: { availableQuantity: 2 } },
      },
      select: { id: true },
    });
    return { id: product.id, variantId: variant.id };
  }

  async function makeAddress(token: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        recipientName: "Integration Buyer",
        phone: "0901234567",
        line1: "8 Admin Test Street",
        ward: "Ward 1",
        district: "District 1",
        province: "HCMC",
        country: "VN",
        isDefault: true,
      });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it("locks and unlocks accounts once, revokes old credentials, and exposes only safe projections", async () => {
    const admin = await makeAdmin();
    const member = await register("Marketplace Member");
    expect(member.status).toBe(201);
    const memberEmail = (
      await db.prisma.user.findUniqueOrThrow({
        where: { id: member.body.data.user.id },
      })
    ).emailNormalized;

    const denied = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${member.body.data.accessToken}`);
    expect(denied.status).toBe(403);
    expect(JSON.stringify(denied.body)).not.toContain(member.body.data.user.id);
    for (const path of [
      "/admin/products",
      "/admin/orders",
      "/admin/stats",
      "/admin/audit",
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1${path}`)
        .set("Authorization", `Bearer ${member.body.data.accessToken}`);
      expect(response.status).toBe(403);
      expect(JSON.stringify(response.body)).not.toContain(
        member.body.data.user.id,
      );
    }
    const deniedLock = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${member.body.data.user.id}/lock`)
      .set("Authorization", `Bearer ${member.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Unauthorized attempt", expectedVersion: 0 });
    expect(deniedLock.status).toBe(403);
    expect(JSON.stringify(deniedLock.body)).not.toContain(
      member.body.data.user.id,
    );

    const historyShopAsset = await db.prisma.asset.create({
      data: {
        uploaderUserId: member.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `admin-history/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const historyShop = await db.prisma.shop.create({
      data: {
        ownerUserId: member.body.data.user.id,
        name: "History seller shop",
        slugNormalized: `history-${randomUUID().slice(0, 12)}`,
        description: "History fixture",
        logoAssetId: historyShopAsset.id,
        contactAddress: "1 History Road",
        phone: "0901234567",
        status: "ACTIVE",
        approvedAt: new Date(),
        members: {
          create: {
            userId: member.body.data.user.id,
            role: "OWNER",
            status: "ACTIVE",
          },
        },
      },
    });
    const historyOrder = await db.prisma.marketplaceOrder.create({
      data: {
        buyerUserId: member.body.data.user.id,
        publicNumber: `ORD-HISTORY-${randomUUID().slice(0, 8)}`,
        recipientSnapshot: {
          recipientName: "Marketplace Member",
          phone: "0901234567",
          line1: "1 History Road",
          ward: "Ward",
          district: "District",
          province: "HCMC",
          country: "VN",
        },
        paymentMethod: "COD",
        originalTotal: "100",
        sellerOrders: {
          create: {
            shopId: historyShop.id,
            shopNameSnapshot: historyShop.name,
            status: "PENDING",
            originalTotal: "100",
          },
        },
      },
    });

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/admin/users?q=${encodeURIComponent(memberEmail)}`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`);
    expect(listed.status).toBe(200);
    const listedUser = listed.body.data.find(
      (user: { id: string }) => user.id === member.body.data.user.id,
    );
    expect(listedUser).toMatchObject({ status: "ACTIVE", version: 0 });
    for (const secret of [
      "passwordHash",
      "refreshHash",
      "sessionSecret",
      "refreshToken",
    ]) {
      expect(listedUser).not.toHaveProperty(secret);
    }

    const reason = "Account review required";
    const lockKey = randomUUID();
    const lockRequest = () =>
      request(app.getHttpServer())
        .post(`/api/v1/admin/users/${member.body.data.user.id}/lock`)
        .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
        .set("Idempotency-Key", lockKey)
        .send({ reason, expectedVersion: 0 });
    const locked = await lockRequest();
    expect(locked.status).toBe(200);
    expect(locked.body.data).toMatchObject({ status: "LOCKED", version: 1 });
    expect(locked.body.data).not.toHaveProperty("passwordHash");
    expect(
      await db.prisma.session.count({
        where: { userId: member.body.data.user.id, revokedAt: null },
      }),
    ).toBe(0);

    const oldAccess = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${member.body.data.accessToken}`);
    expect(oldAccess.status).toBe(401);
    const lockedBuyerAction = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${member.body.data.accessToken}`)
      .send({ variantId: randomUUID(), quantity: 1 });
    expect(lockedBuyerAction.status).toBe(401);
    const lockedSellerAction = await request(app.getHttpServer())
      .post(`/api/v1/shops/${historyShop.id}/products`)
      .set("Authorization", `Bearer ${member.body.data.accessToken}`)
      .send({});
    expect(lockedSellerAction.status).toBe(401);
    const lockedLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: memberEmail,
        password,
        clientPlatform: "ANDROID",
      });
    expect(lockedLogin.status).toBe(403);

    const replay = await lockRequest();
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual(locked.body.data);
    expect(
      await db.prisma.auditEvent.count({
        where: {
          targetType: "User",
          targetId: member.body.data.user.id,
          action: "user.locked",
        },
      }),
    ).toBe(1);

    const selfLock = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${admin.body.data.user.id}/lock`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Prevent self lock", expectedVersion: 0 });
    expect(selfLock.status).toBe(403);

    const unlocked = await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${member.body.data.user.id}/unlock`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ reason: "Review completed", expectedVersion: 1 });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.data).toMatchObject({ status: "ACTIVE", version: 2 });
    const oldRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({
        refreshToken: member.body.data.refreshToken,
        clientPlatform: "ANDROID",
      });
    expect(oldRefresh.status).toBe(401);
    const oldAccessAfterUnlock = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${member.body.data.accessToken}`);
    expect(oldAccessAfterUnlock.status).toBe(401);
    const newLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: memberEmail,
        password,
        clientPlatform: "ANDROID",
      });
    expect(newLogin.status).toBe(200);
    const retainedHistory = await request(app.getHttpServer())
      .get("/api/v1/orders")
      .set("Authorization", `Bearer ${newLogin.body.data.accessToken}`);
    expect(retainedHistory.status).toBe(200);
    expect(
      retainedHistory.body.data.map((order: { id: string }) => order.id),
    ).toContain(historyOrder.id);
    expect(
      await db.prisma.auditEvent.count({
        where: { targetType: "User", targetId: member.body.data.user.id },
      }),
    ).toBe(2);
  });

  it("hides products with an audit reason and rejects a checkout quoted before moderation", async () => {
    const admin = await makeAdmin();
    const shop = await makeShop();
    const product = await makeProduct(shop.id);
    const buyer = await register("Checkout Buyer");
    const historyBuyer = await register("Product History Buyer");
    const historyAddress = await makeAddress(
      historyBuyer.body.data.accessToken,
    );
    const historyCart = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${historyBuyer.body.data.accessToken}`)
      .send({ variantId: product.variantId, quantity: 1 });
    expect(historyCart.status).toBe(201);
    const historyItemId = historyCart.body.data.groups
      .flatMap(
        (group: { items: Array<{ id: string; variantId: string }> }) =>
          group.items,
      )
      .find(
        (item: { variantId: string }) => item.variantId === product.variantId,
      ).id as string;
    const historyQuote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${historyBuyer.body.data.accessToken}`)
      .send({
        cartItemIds: [historyItemId],
        addressId: historyAddress.id,
        paymentMethod: "COD",
      });
    expect(historyQuote.status).toBe(201);
    const existingOrder = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${historyBuyer.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: historyQuote.body.data.quoteId });
    expect(existingOrder.status).toBe(201);
    const existingItem = await db.prisma.orderItem.findFirstOrThrow({
      where: { sellerOrderId: existingOrder.body.data.sellerOrders[0].id },
    });
    const existingOrderCount = await db.prisma.marketplaceOrder.count();
    const address = await makeAddress(buyer.body.data.accessToken);
    const cartItem = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .send({ variantId: product.variantId, quantity: 1 });
    expect(cartItem.status).toBe(201);
    const itemId = cartItem.body.data.groups
      .flatMap(
        (group: { items: Array<{ id: string; variantId: string }> }) =>
          group.items,
      )
      .find(
        (item: { variantId: string }) => item.variantId === product.variantId,
      ).id as string;
    const quote = await request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .send({
        cartItemIds: [itemId],
        addressId: address.id,
        paymentMethod: "COD",
      });
    expect(quote.status).toBe(201);
    expect(quote.body.data.valid).toBe(true);

    const hideKey = randomUUID();
    const hideRequest = () =>
      request(app.getHttpServer())
        .post(`/api/v1/admin/products/${product.id}/hide`)
        .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
        .set("Idempotency-Key", hideKey)
        .send({
          reason: "Product listing needs compliance review",
          expectedVersion: 0,
        });
    const hidden = await hideRequest();
    expect(hidden.status).toBe(200);
    expect(hidden.body.data).toMatchObject({
      adminHidden: true,
      hiddenReason: "Product listing needs compliance review",
      version: 1,
    });
    expect((await hideRequest()).body.data).toEqual(hidden.body.data);
    expect((await hideRequest()).status).toBe(200);
    const idempotencyConflict = await request(app.getHttpServer())
      .post(`/api/v1/admin/products/${product.id}/hide`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .set("Idempotency-Key", hideKey)
      .send({ reason: "Different request", expectedVersion: 0 });
    expect(idempotencyConflict.status).toBe(409);

    const publicProduct = await request(app.getHttpServer()).get(
      `/api/v1/products/${product.id}`,
    );
    expect(publicProduct.status).toBe(404);
    const checkout = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${buyer.body.data.accessToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quote.body.data.quoteId });
    expect(checkout.status).toBe(409);
    expect(checkout.body.error.code).toBe("PRODUCT_UNAVAILABLE");
    expect(await db.prisma.marketplaceOrder.count()).toBe(existingOrderCount);
    const retainedItem = await db.prisma.orderItem.findUniqueOrThrow({
      where: { id: existingItem.id },
    });
    expect(retainedItem).toMatchObject({
      productNameSnapshot: existingItem.productNameSnapshot,
      skuSnapshot: existingItem.skuSnapshot,
      unitPrice: existingItem.unitPrice,
      quantity: existingItem.quantity,
      lineTotal: existingItem.lineTotal,
    });

    const sellerUnhide = await request(app.getHttpServer())
      .patch(`/api/v1/shops/${shop.id}/products/${product.id}`)
      .set("Authorization", `Bearer ${shop.ownerToken}`)
      .send({ adminHidden: false, expectedVersion: 1 });
    expect(sellerUnhide.status).toBe(400);
    expect(
      await db.prisma.auditEvent.count({
        where: {
          targetType: "Product",
          targetId: product.id,
          reason: "Product listing needs compliance review",
        },
      }),
    ).toBe(1);
  });

  it("searches orders and audit safely and counts completed SellerOrders without double counting the Order", async () => {
    const admin = await makeAdmin();
    const buyer = await register("Order Inquiry Buyer");
    const shops = await Promise.all([
      makeShop("Order Shop A"),
      makeShop("Order Shop B"),
    ]);
    const completedAt = new Date();
    const order = await db.prisma.marketplaceOrder.create({
      data: {
        buyerUserId: buyer.body.data.user.id,
        publicNumber: `ORD-US9-${randomUUID().slice(0, 10)}`,
        recipientSnapshot: {
          recipientName: "Order Inquiry Buyer",
          phone: "0901234567",
          line1: "1 Snapshot Street",
          ward: "Ward 1",
          district: "District 1",
          province: "HCMC",
          country: "VN",
        },
        paymentMethod: "COD",
        originalTotal: "100",
        status: "COMPLETED",
        sellerOrders: {
          create: shops.map((shop, index) => ({
            shopId: shop.id,
            shopNameSnapshot: shop.name,
            status: "COMPLETED",
            originalTotal: index === 0 ? "40" : "60",
            completedAt,
          })),
        },
      },
      include: { sellerOrders: true },
    });
    for (const sellerOrder of order.sellerOrders) {
      await db.prisma.auditEvent.create({
        data: {
          actorUserId: admin.body.data.user.id,
          actorKind: "USER",
          action: "seller_order.completed",
          targetType: "SellerOrder",
          targetId: sellerOrder.id,
          shopId: sellerOrder.shopId,
          reason: "Integration audit record",
          outcome: "SUCCESS",
          requestId: randomUUID(),
          safeMetadata: {
            orderId: order.id,
            status: "COMPLETED",
            refreshToken: "must-not-be-exposed",
          },
        },
      });
    }

    const from = new Date(completedAt.getTime() - 60_000).toISOString();
    const to = new Date(completedAt.getTime() + 60_000).toISOString();
    const stats = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({
      orderCount: 3,
      completedSellerOrderValue: "100",
      simulated: true,
    });
    expect(stats.body.data.countsByStatus.Order.COMPLETED).toBe(1);

    const orders = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/orders?buyerId=${buyer.body.data.user.id}&shopId=${shops[0]!.id}&status=COMPLETED`,
      )
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`);
    expect(orders.status).toBe(200);
    expect(orders.body.meta.total).toBe(1);
    expect(orders.body.data[0]).toMatchObject({
      id: order.id,
      orderNumber: order.publicNumber,
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${order.id}`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.order.originalTotal).toBe("100");
    expect(detail.body.data.auditReferenceIds).toHaveLength(2);

    const audit = await request(app.getHttpServer())
      .get(
        `/api/v1/admin/audit?resourceType=SellerOrder&actorId=${admin.body.data.user.id}`,
      )
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`);
    expect(audit.status).toBe(200);
    expect(audit.body.data).toHaveLength(2);
    expect(audit.body.data[0]).toMatchObject({
      actorId: admin.body.data.user.id,
      action: "seller_order.completed",
      reason: "Integration audit record",
      metadata: { orderId: order.id, status: "COMPLETED" },
    });
    for (const secret of [
      "passwordHash",
      "refreshHash",
      "refreshToken",
      "sessionSecret",
    ]) {
      expect(JSON.stringify(audit.body.data)).not.toContain(secret);
    }

    const forbiddenEdit = await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${order.id}`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .send({ originalTotal: "1" });
    expect(forbiddenEdit.status).toBe(404);
    expect(
      (
        await db.prisma.marketplaceOrder.findUniqueOrThrow({
          where: { id: order.id },
        })
      ).originalTotal.toString(),
    ).toBe("100");
  });
});
