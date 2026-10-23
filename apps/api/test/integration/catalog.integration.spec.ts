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
import { DatabaseService } from "../../src/database/prisma.service.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `catalog-${randomUUID()}@example.test`;
type Auth = { status: number; body: { data: { accessToken: string; user: { id: string } } } };
type CreatedShop = { id: string; ownerId: string; token: string };

describe("catalog and inventory PostgreSQL integration", () => {
  let app: INestApplication;
  let pool: Pool;
  let db: DatabaseService;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
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
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
  }, 120_000);
  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function register(address = email()): Promise<Auth> {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: address, password, fullName: "Catalog Seller", clientPlatform: "ANDROID" });
  }
  async function makeShop(): Promise<CreatedShop> {
    const owner = await register();
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `fixture/${randomUUID()}.png`,
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
        name: "Catalog Fixture Shop",
        slug: `catalog-${randomUUID().slice(0, 8)}`,
        description: "For integration tests",
        logoAssetId: logo.id,
        contactAddress: "1 Test Street",
        phone: "0901234567",
      });
    expect(created.status).toBe(201);
    const admin = await register();
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
  async function makeImage(shop: CreatedShop, bound = true) {
    return db.prisma.asset.create({
      data: {
        uploaderUserId: shop.ownerId,
        shopId: bound ? shop.id : null,
        purpose: "PRODUCT_IMAGE",
        objectKey: `users/${shop.ownerId}/products/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
  }
  async function makeCategory(
    name = `Category ${randomUUID().slice(0, 8)}`,
    visible = true,
    adminToken?: string,
    parentId: string | null = null,
  ) {
    const token = adminToken ?? (await makeAdminToken());
    const result = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, parentId, visible });
    expect(result.status).toBe(201);
    return result.body.data as { id: string; visible: boolean; version: number; name: string };
  }
  async function makeAdminToken() {
    const admin = await register();
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    return admin.body.data.accessToken;
  }
  async function createProduct(
    shop: CreatedShop,
    categoryId: string,
    assetIds: string[],
    variants: Array<{
      sku: string;
      attributes: Record<string, string>;
      price: string;
      stock: number;
      selling: boolean;
    }> = [
      {
        sku: `SKU-${randomUUID().slice(0, 8)}`,
        attributes: { size: "S" },
        price: "150000",
        stock: 1,
        selling: true,
      },
    ],
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/shops/${shop.id}/products`)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({
        name: "Integration Product",
        description: "Product for catalog tests",
        categoryId,
        imageAssetIds: assetIds,
        selling: true,
        variants,
      });
  }

  it("creates categories with server slugs and prevents cycles and hidden-ancestor publication", async () => {
    const admin = await makeAdminToken();
    const parent = await makeCategory("Home Living", true, admin);
    const child = await makeCategory("Kitchen", true, admin, parent.id);
    expect(parent).not.toHaveProperty("slug"); // API category projection intentionally excludes storage slug.
    const cycle = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${parent.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ parentId: child.id, expectedVersion: parent.version });
    expect(cycle.status).toBe(409);
    const hidden = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${parent.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ visible: false, expectedVersion: parent.version });
    expect(hidden.status).toBe(200);
    const publicCategories = await request(app.getHttpServer()).get("/api/v1/categories?tree=true");
    expect(publicCategories.status).toBe(200);
    expect(JSON.stringify(publicCategories.body.data)).not.toContain(child.id);
    const selfParent = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${child.id}`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ parentId: child.id, expectedVersion: child.version });
    expect(selfParent.status).toBe(409);
  });

  it("creates two variants and initial stock atomically and preserves decimal-free prices", async () => {
    const shop = await makeShop();
    const category = await makeCategory();
    const image = await makeImage(shop);
    const variants = [
      { sku: "COTTON-S", attributes: { size: "S" }, price: "150000", stock: 1, selling: true },
      { sku: "COTTON-M", attributes: { size: "M" }, price: "160000", stock: 5, selling: true },
    ];
    const response = await createProduct(shop, category.id, [image.id], variants);
    if (response.status !== 201) throw new Error(JSON.stringify(response.body));
    expect(response.status).toBe(201);
    expect(
      response.body.data.variants.map((variant: { availableQuantity: number; price: string }) => [
        variant.availableQuantity,
        variant.price,
      ]),
    ).toEqual([
      [5, "160000"],
      [1, "150000"],
    ]);
    const inventory = await db.prisma.inventory.findMany({
      where: { shopId: shop.id },
      include: { movements: true },
    });
    expect(inventory.map((row) => row.availableQuantity).sort()).toEqual([1, 5]);
    expect(
      inventory
        .flatMap((row) => row.movements)
        .every((movement) => movement.kind === "INITIAL" && movement.effectType === null),
    ).toBe(true);
  });

  it("rolls back product creation for invalid category or foreign/unverified image assets", async () => {
    const [shop, otherShop] = await Promise.all([makeShop(), makeShop()]);
    const category = await makeCategory();
    const foreign = await makeImage(otherShop);
    const foreignResponse = await createProduct(shop, category.id, [foreign.id]);
    expect([403, 404, 422]).toContain(foreignResponse.status);
    const pending = await db.prisma.asset.create({
      data: {
        uploaderUserId: shop.ownerId,
        shopId: shop.id,
        purpose: "PRODUCT_IMAGE",
        objectKey: `pending/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "PENDING",
      },
    });
    const pendingResponse = await createProduct(shop, category.id, [pending.id]);
    expect([403, 404, 422]).toContain(pendingResponse.status);
    const missingCategory = await createProduct(shop, randomUUID(), [(await makeImage(shop)).id]);
    expect([404, 422]).toContain(missingCategory.status);
    expect(await db.prisma.product.count({ where: { shopId: shop.id } })).toBe(0);
  });

  it("keeps SKU uniqueness shop-scoped and rejects duplicate canonical variant attributes", async () => {
    const shop = await makeShop();
    const category = await makeCategory();
    const image = await makeImage(shop);
    const sku = `SHARED-${randomUUID().slice(0, 8)}`;
    const first = await createProduct(
      shop,
      category.id,
      [image.id],
      [{ sku, attributes: { size: "S", color: "Blue" }, price: "100", stock: 0, selling: true }],
    );
    expect(first.status).toBe(201);
    const secondImage = await makeImage(shop);
    const duplicateSku = await createProduct(
      shop,
      category.id,
      [secondImage.id],
      [{ sku, attributes: { size: "L" }, price: "200", stock: 0, selling: true }],
    );
    expect(duplicateSku.status).toBe(409);
    const duplicateAttributes = await request(app.getHttpServer())
      .post(`/api/v1/shops/${shop.id}/products/${first.body.data.id}/variants`)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({
        sku: `OTHER-${randomUUID().slice(0, 8)}`,
        attributes: { color: "Blue", size: "S" },
        price: "120",
        stock: 0,
        selling: true,
      });
    if (duplicateAttributes.status !== 409)
      throw new Error(JSON.stringify(duplicateAttributes.body));
    expect(duplicateAttributes.status).toBe(409);
  });

  it("serializes inventory deltas by expected version and never permits negative or zero-delta stock", async () => {
    const shop = await makeShop();
    const category = await makeCategory();
    const image = await makeImage(shop);
    const product = await createProduct(
      shop,
      category.id,
      [image.id],
      [
        {
          sku: `STOCK-${randomUUID().slice(0, 8)}`,
          attributes: {},
          price: "1000",
          stock: 5,
          selling: true,
        },
      ],
    );
    const variantId = product.body.data.variants[0].id as string;
    const path = `/api/v1/shops/${shop.id}/variants/${variantId}/inventory-adjustments`;
    const requestDelta = (delta: number) =>
      request(app.getHttpServer())
        .post(path)
        .set("Authorization", `Bearer ${shop.token}`)
        .send({ delta, reason: "Counted stock", expectedVersion: 0 });
    const results = await Promise.all([requestDelta(2), requestDelta(3)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    const inventory = await db.prisma.inventory.findUniqueOrThrow({
      where: { variantId },
      include: { movements: true },
    });
    expect(inventory.availableQuantity).toBeGreaterThanOrEqual(7);
    expect(inventory.availableQuantity).toBeLessThanOrEqual(8);
    expect(inventory.version).toBe(1);
    const noStock = await request(app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({ delta: -999, reason: "Bad count", expectedVersion: 1 });
    expect([409, 422]).toContain(noStock.status);
    const zero = await request(app.getHttpServer())
      .post(path)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({ delta: 0, reason: "No-op", expectedVersion: 1 });
    expect([400, 422]).toContain(zero.status);
    expect(inventory.movements.filter((movement) => movement.kind === "ADJUST")).toHaveLength(1);
  });

  it("enforces cross-shop 404s and stops products without deleting history", async () => {
    const [shop, other] = await Promise.all([makeShop(), makeShop()]);
    const category = await makeCategory();
    const product = await createProduct(shop, category.id, [(await makeImage(shop)).id]);
    const foreignRead = await request(app.getHttpServer())
      .get(`/api/v1/shops/${other.id}/products/${product.body.data.id}/management`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(foreignRead.status).toBe(404);
    const stop = await request(app.getHttpServer())
      .patch(`/api/v1/shops/${shop.id}/products/${product.body.data.id}`)
      .set("Authorization", `Bearer ${shop.token}`)
      .send({ selling: false, expectedVersion: 0 });
    expect(stop.status).toBe(200);
    expect(stop.body.data.selling).toBe(false);
    const publicRead = await request(app.getHttpServer()).get(
      `/api/v1/products/${product.body.data.id}`,
    );
    expect(publicRead.status).toBe(404);
    const managementRead = await request(app.getHttpServer())
      .get(`/api/v1/shops/${shop.id}/products/${product.body.data.id}/management`)
      .set("Authorization", `Bearer ${shop.token}`);
    expect(managementRead.status).toBe(200);
    expect(await db.prisma.product.count({ where: { id: product.body.data.id } })).toBe(1);
  });
});
