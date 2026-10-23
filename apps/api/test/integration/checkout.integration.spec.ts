import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../src/common/http/validation.pipe.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `checkout-${randomUUID()}@example.test`;
type Auth = { body: { data: { accessToken: string; user: { id: string } } } };
type Shop = { id: string; ownerId: string; token: string };
type Product = { id: string; variantId: string };

describe("cart, quotes, and checkout PostgreSQL integration", () => {
  let app: INestApplication;
  let db: DatabaseService;
  let pool: Awaited<ReturnType<typeof createTestPool>>;

  async function startApp() {
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
  }

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
    await startApp();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function register(name = "Checkout Buyer"): Promise<Auth> {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: email(), password, fullName: name, clientPlatform: "ANDROID" });
  }

  async function makeShop(): Promise<Shop> {
    const owner = await register("Checkout Seller");
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `checkout/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const created = await request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
      .send({
        name: `Checkout Shop ${randomUUID().slice(0, 6)}`,
        slug: `checkout-${randomUUID().slice(0, 8)}`,
        description: "Checkout fixture shop",
        logoAssetId: logo.id,
        contactAddress: "1 Test Street",
        phone: "0901234567",
      });
    expect(created.status).toBe(201);
    const admin = await register("Checkout Admin");
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    const approved = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${created.body.data.id}/approve`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .send({ expectedVersion: 0 });
    expect(approved.status).toBe(200);
    return {
      id: created.body.data.id,
      ownerId: owner.body.data.user.id,
      token: owner.body.data.accessToken,
    };
  }

  async function makeCategory() {
    const admin = await register("Checkout Category Admin");
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .send({
        name: `Checkout Category ${randomUUID().slice(0, 6)}`,
        parentId: null,
        visible: true,
      });
    expect(response.status).toBe(201);
    return response.body.data.id as string;
  }

  async function makeProduct(
    shop: Shop,
    categoryId: string,
    stock: number,
    price: string,
  ): Promise<Product> {
    const image = await db.prisma.asset.create({
      data: {
        uploaderUserId: shop.ownerId,
        shopId: shop.id,
        purpose: "PRODUCT_IMAGE",
        objectKey: `checkout/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const response = await request(app.getHttpServer())
      .post(`/api/v1/shops/${shop.id}/products`)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({
        name: `Product ${randomUUID().slice(0, 6)}`,
        description: "Checkout fixture product",
        categoryId,
        imageAssetIds: [image.id],
        selling: true,
        variants: [
          {
            sku: `SKU-${randomUUID().slice(0, 8)}`,
            attributes: { size: "M" },
            price,
            stock,
            selling: true,
          },
        ],
      });
    expect(response.status).toBe(201);
    return { id: response.body.data.id, variantId: response.body.data.variants[0].id };
  }

  async function makeAddress(token: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        recipientName: "Buyer Snapshot",
        phone: "0901234567",
        line1: "12 Original Road",
        ward: "Ward 1",
        district: "District 1",
        province: "HCMC",
        country: "VN",
        isDefault: true,
      });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  async function addToCart(token: string, variantId: string, quantity: number) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ variantId, quantity });
    expect(response.status).toBe(201);
    const line = response.body.data.groups
      .flatMap((group: { items: Array<{ id: string; variantId: string }> }) => group.items)
      .find((item: { variantId: string }) => item.variantId === variantId);
    return line.id as string;
  }

  async function quote(token: string, addressId: string, cartItemIds: string[]) {
    return request(app.getHttpServer())
      .post("/api/v1/checkout/quotes")
      .set("Authorization", `Bearer ${token}`)
      .send({ cartItemIds, addressId, paymentMethod: "MOCK" });
  }

  it("merges variant lines, splits a selected multi-shop checkout, preserves snapshots, and replays once", async () => {
    const categoryId = await makeCategory();
    const shopA = await makeShop();
    const shopB = await makeShop();
    const productA = await makeProduct(shopA, categoryId, 5, "100");
    const productB = await makeProduct(shopB, categoryId, 3, "250");
    const unused = await makeProduct(shopA, categoryId, 4, "50");
    const buyer = await register();
    const token = buyer.body.data.accessToken;
    const address = await makeAddress(token);
    const itemA = await addToCart(token, productA.variantId, 1);
    await addToCart(token, productA.variantId, 1);
    const itemB = await addToCart(token, productB.variantId, 1);
    const itemUnused = await addToCart(token, unused.variantId, 1);
    const cart = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${token}`);
    expect(cart.status).toBe(200);
    expect(cart.body.data.selectedTotal).toBe("500");
    const unchecked = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemUnused}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ selected: false });
    expect(unchecked.status).toBe(200);
    const quoted = await quote(token, address.id, [itemA, itemB]);
    expect(quoted.status).toBe(201);
    expect(quoted.body.data).toMatchObject({ total: "450", valid: true, currency: "VND" });
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: productA.variantId } }))
        .availableQuantity,
    ).toBe(5);
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: productB.variantId } }))
        .availableQuantity,
    ).toBe(3);
    const key = randomUUID();
    const checkedOut = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ quoteId: quoted.body.data.quoteId });
    expect(checkedOut.status).toBe(201);
    const order = checkedOut.body.data;
    expect(order.sellerOrders).toHaveLength(2);
    expect(new Date(order.paymentDeadline).getTime() - new Date(order.createdAt).getTime()).toBe(
      15 * 60_000,
    );
    expect(order.sellerOrders.map((part: { shopId: string }) => part.shopId).sort()).toEqual(
      [shopA.id, shopB.id].sort(),
    );
    expect(order.originalTotal).toBe("450");
    expect(
      order.sellerOrders
        .flatMap((part: { items: Array<{ lineTotal: string }> }) =>
          part.items.map((item) => item.lineTotal),
        )
        .sort(),
    ).toEqual(["200", "250"]);
    expect(
      order.sellerOrders.reduce(
        (sum: number, part: { originalTotal: string }) => sum + Number(part.originalTotal),
        0,
      ),
    ).toBe(450);
    const replay = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({ quoteId: quoted.body.data.quoteId });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(order.id);
    const otherKey = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: quoted.body.data.quoteId });
    expect(otherKey.status).toBe(409);
    expect(await db.prisma.marketplaceOrder.count()).toBe(1);
    expect(await db.prisma.inventoryMovement.count({ where: { kind: "SALE" } })).toBe(2);
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: productA.variantId } }))
        .availableQuantity,
    ).toBe(3);
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: productB.variantId } }))
        .availableQuantity,
    ).toBe(2);
    const remaining = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${token}`);
    expect(
      remaining.body.data.groups.flatMap((group: { items: Array<{ variantId: string }> }) =>
        group.items.map((item) => item.variantId),
      ),
    ).toEqual([unused.variantId]);
    const otherBuyer = await register();
    const foreignCart = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${otherBuyer.body.data.accessToken}`);
    expect(foreignCart.status).toBe(200);
    expect(foreignCart.body.data.groups).toHaveLength(0);
    const foreignItemUpdate = await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${itemUnused}`)
      .set("Authorization", `Bearer ${otherBuyer.body.data.accessToken}`)
      .send({ selected: false });
    expect(foreignItemUpdate.status).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/orders/${order.id}`)
          .set("Authorization", `Bearer ${otherBuyer.body.data.accessToken}`)
      ).status,
    ).toBe(404);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(detail.body.data.sellerOrders[0].addressSnapshot).toMatchObject({
      line1: "12 Original Road",
    });
    await db.prisma.product.update({
      where: { id: productA.id },
      data: { name: "Renamed after checkout" },
    });
    const immutable = await request(app.getHttpServer())
      .get(`/api/v1/orders/${order.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(
      immutable.body.data.sellerOrders
        .flatMap((part: { items: Array<{ productName: string }> }) => part.items)
        .map((item: { productName: string }) => item.productName),
    ).not.toContain("Renamed after checkout");
  }, 120_000);

  it("rejects changed prices and rolls back every stock change when one quoted item goes unavailable", async () => {
    const ordersBefore = await db.prisma.marketplaceOrder.count();
    const salesBefore = await db.prisma.inventoryMovement.count({ where: { kind: "SALE" } });
    const categoryId = await makeCategory();
    const shop = await makeShop();
    const first = await makeProduct(shop, categoryId, 5, "100");
    const second = await makeProduct(shop, categoryId, 1, "200");
    const buyer = await register();
    const token = buyer.body.data.accessToken;
    const address = await makeAddress(token);
    const firstItem = await addToCart(token, first.variantId, 1);
    const secondItem = await addToCart(token, second.variantId, 1);
    const firstQuote = await quote(token, address.id, [firstItem, secondItem]);
    expect(firstQuote.status).toBe(201);
    const expiredQuote = await quote(token, address.id, [firstItem, secondItem]);
    expect(expiredQuote.status).toBe(201);
    await db.prisma.checkoutQuote.update({
      where: { id: expiredQuote.body.data.quoteId },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: expiredQuote.body.data.quoteId });
    expect(expired.status).toBe(409);
    await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${firstItem}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ selected: false });
    const staleCart = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: firstQuote.body.data.quoteId });
    expect(staleCart.status).toBe(409);
    const notSelected = await quote(token, address.id, [firstItem, secondItem]);
    expect(notSelected.body.data.valid).toBe(false);
    await request(app.getHttpServer())
      .patch(`/api/v1/cart/items/${firstItem}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ selected: true });
    const priceQuote = await quote(token, address.id, [firstItem, secondItem]);
    expect(priceQuote.body.data.valid).toBe(true);
    await db.prisma.productVariant.update({
      where: { id: first.variantId },
      data: { price: "101" },
    });
    const priceChanged = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: priceQuote.body.data.quoteId });
    expect(priceChanged.status).toBe(409);
    expect(priceChanged.body.error?.code).toBe("PRICE_CHANGED");
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: first.variantId } }))
        .availableQuantity,
    ).toBe(5);
    const secondQuote = await quote(token, address.id, [firstItem, secondItem]);
    expect(secondQuote.status).toBe(201);
    await db.prisma.inventory.update({
      where: { variantId: second.variantId },
      data: { availableQuantity: 0 },
    });
    const noPartial = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ quoteId: secondQuote.body.data.quoteId });
    expect(noPartial.status).toBe(409);
    expect(await db.prisma.marketplaceOrder.count()).toBe(ordersBefore);
    expect(await db.prisma.inventoryMovement.count({ where: { kind: "SALE" } })).toBe(salesBefore);
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: first.variantId } }))
        .availableQuantity,
    ).toBe(5);
    const cart = await request(app.getHttpServer())
      .get("/api/v1/cart")
      .set("Authorization", `Bearer ${token}`);
    expect(
      cart.body.data.groups.flatMap((group: { items: unknown[] }) => group.items),
    ).toHaveLength(2);
  }, 120_000);

  it("serializes same-key retries and allows only the available stock across twenty buyers", async () => {
    const categoryId = await makeCategory();
    const shop = await makeShop();
    const retryProduct = await makeProduct(shop, categoryId, 10, "100");
    const retryBuyer = await register();
    const retryToken = retryBuyer.body.data.accessToken;
    const retryAddress = await makeAddress(retryToken);
    const retryItem = await addToCart(retryToken, retryProduct.variantId, 1);
    const retryQuote = await quote(retryToken, retryAddress.id, [retryItem]);
    const alternateQuote = await quote(retryToken, retryAddress.id, [retryItem]);
    expect(retryQuote.status).toBe(201);
    expect(alternateQuote.status).toBe(201);
    const retryKey = randomUUID();
    const retries = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post("/api/v1/checkout")
          .set("Authorization", `Bearer ${retryToken}`)
          .set("Idempotency-Key", retryKey)
          .send({ quoteId: retryQuote.body.data.quoteId }),
      ),
    );
    expect(retries.map((result) => result.status)).toEqual(Array(10).fill(201));
    expect(new Set(retries.map((result) => result.body.data.id)).size).toBe(1);
    expect(
      await db.prisma.inventoryMovement.count({
        where: { inventoryId: retryProduct.variantId, kind: "SALE" },
      }),
    ).toBe(1);
    await app.close();
    await startApp();
    const restartReplay = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${retryToken}`)
      .set("Idempotency-Key", retryKey)
      .send({ quoteId: retryQuote.body.data.quoteId });
    expect(restartReplay.status).toBe(201);
    expect(restartReplay.body.data.id).toBe(retries[0]!.body.data.id);

    const collisionProduct = await makeProduct(shop, categoryId, 1, "150");
    const collisionBuyer = await register("Inventory Collision Buyer");
    const collisionToken = collisionBuyer.body.data.accessToken;
    const collisionAddress = await makeAddress(collisionToken);
    const collisionItem = await addToCart(collisionToken, collisionProduct.variantId, 1);
    const collisionQuote = await quote(collisionToken, collisionAddress.id, [collisionItem]);
    expect(collisionQuote.status).toBe(201);
    const [collisionCheckout, collisionAdjustment] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/checkout")
        .set("Authorization", `Bearer ${collisionToken}`)
        .set("Idempotency-Key", randomUUID())
        .send({ quoteId: collisionQuote.body.data.quoteId }),
      request(app.getHttpServer())
        .post(
          `/api/v1/shops/${shop.id}/variants/${collisionProduct.variantId}/inventory-adjustments`,
        )
        .set("Authorization", `Bearer ${shop.token}`)
        .send({ delta: -1, reason: "Concurrent checkout collision", expectedVersion: 0 }),
    ]);
    const collisionStatuses = [collisionCheckout.status, collisionAdjustment.status];
    expect(collisionStatuses.filter((status) => status === 409)).toHaveLength(1);
    expect(collisionStatuses.filter((status) => status === 200 || status === 201)).toHaveLength(1);
    expect(
      (
        await db.prisma.inventory.findUniqueOrThrow({
          where: { variantId: collisionProduct.variantId },
        })
      ).availableQuantity,
    ).toBe(0);
    const changedBody = await request(app.getHttpServer())
      .post("/api/v1/checkout")
      .set("Authorization", `Bearer ${retryToken}`)
      .set("Idempotency-Key", retryKey)
      .send({ quoteId: alternateQuote.body.data.quoteId });
    expect(changedBody.status).toBe(409);

    const contested = await makeProduct(shop, categoryId, 5, "200");
    const buyers: Array<{ token: string; quoteId: string }> = [];
    for (let index = 0; index < 20; index += 1) {
      const buyer = await register(`Race Buyer ${index + 1}`);
      const token = buyer.body.data.accessToken;
      const address = await makeAddress(token);
      const item = await addToCart(token, contested.variantId, 1);
      const createdQuote = await quote(token, address.id, [item]);
      expect(createdQuote.status).toBe(201);
      buyers.push({ token, quoteId: createdQuote.body.data.quoteId });
    }
    const attempts = await Promise.all(
      buyers.map(({ token, quoteId }) =>
        request(app.getHttpServer())
          .post("/api/v1/checkout")
          .set("Authorization", `Bearer ${token}`)
          .set("Idempotency-Key", randomUUID())
          .send({ quoteId }),
      ),
    );
    expect(attempts.filter((result) => result.status === 201)).toHaveLength(5);
    expect(attempts.filter((result) => result.status === 409)).toHaveLength(15);
    expect(
      (await db.prisma.inventory.findUniqueOrThrow({ where: { variantId: contested.variantId } }))
        .availableQuantity,
    ).toBe(0);
    expect(
      await db.prisma.inventoryMovement.count({
        where: { inventoryId: contested.variantId, kind: "SALE" },
      }),
    ).toBe(5);
    expect(
      await db.prisma.sellerOrder.count({
        where: { items: { some: { variantId: contested.variantId } } },
      }),
    ).toBe(5);
  }, 240_000);
});
