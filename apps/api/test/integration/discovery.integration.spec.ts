import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { cpus, hostname } from "node:os";
import request from "supertest";
import type { Pool } from "pg";
import { AppModule } from "../../src/app.module.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../src/common/http/validation.pipe.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";

const password = "Correct horse battery staple 9!";
const email = () => `discovery-${randomUUID()}@example.test`;
type Shop = { id: string; ownerId: string; token: string };

describe("public discovery PostgreSQL integration", () => {
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
    app.useGlobalPipes(createContractValidationPipe());
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
    db = app.get(DatabaseService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function register() {
    return request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({ email: email(), password, fullName: "Discovery Fixture", clientPlatform: "ANDROID" });
  }

  async function shopFixture(): Promise<Shop> {
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
        name: "Discovery Shop",
        slug: `discovery-${randomUUID().slice(0, 8)}`,
        description: "Public shop",
        logoAssetId: logo.id,
        contactAddress: "private address",
        phone: "0900000000",
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

  async function category(adminToken: string, parentId: string | null = null) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/categories")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `Category ${randomUUID().slice(0, 6)}`, parentId, visible: true });
    expect(response.status).toBe(201);
    return response.body.data as { id: string; version: number };
  }

  async function publish(
    shop: Shop,
    categoryId: string,
    name: string,
    prices: string[],
    stocks: number[],
  ) {
    const image = await db.prisma.asset.create({
      data: {
        uploaderUserId: shop.ownerId,
        shopId: shop.id,
        purpose: "PRODUCT_IMAGE",
        objectKey: `products/${randomUUID()}.png`,
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
        name,
        description: "discovery fixture text",
        categoryId,
        imageAssetIds: [image.id],
        selling: true,
        variants: prices.map((price, i) => ({
          sku: `${name}-${i}-${randomUUID().slice(0, 4)}`,
          attributes: { size: `${i}` },
          price,
          stock: stocks[i] ?? 0,
          selling: true,
        })),
      });
    expect(response.status).toBe(201);
    return response.body.data as { id: string };
  }

  it("filters active products by visible category descendants, active prices and stock; keeps stable paging", async () => {
    const shop = await shopFixture();
    const admin = await register();
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    const root = await category(admin.body.data.accessToken);
    const child = await category(admin.body.data.accessToken, root.id);
    const first = await publish(shop, child.id, "Alpha Linen Shirt", ["1200", "950"], [0, 0]);
    const second = await publish(shop, child.id, "Beta Linen Shirt", ["950"], [3]);
    const hiddenAncestor = await category(admin.body.data.accessToken);
    const hiddenChild = await category(admin.body.data.accessToken, hiddenAncestor.id);
    const hidden = await publish(shop, hiddenChild.id, "Hidden Publicity", ["100"], [10]);
    const hiddenParentResponse = await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${hiddenAncestor.id}`)
      .set("Authorization", `Bearer ${admin.body.data.accessToken}`)
      .send({ visible: false, expectedVersion: hiddenAncestor.version ?? 0 });
    expect([200, 409]).toContain(hiddenParentResponse.status);

    const list = await request(app.getHttpServer()).get(
      `/api/v1/products?categoryId=${root.id}&minPrice=900&maxPrice=1000&sort=PRICE_ASC&page=1&pageSize=1`,
    );
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    const orderedIds = [first.id, second.id].sort();
    expect(list.body.data[0]).toMatchObject({
      id: orderedIds[0],
      minimumPrice: "950",
      available: orderedIds[0] === second.id,
    });
    expect(list.body.meta).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    const search = await request(app.getHttpServer()).get(
      `/api/v1/products?q=Linen&categoryId=${root.id}&sort=PRICE_DESC&pageSize=10`,
    );
    expect(search.body.data.map((item: { id: string }) => item.id)).toEqual(orderedIds);
    const secondPage = await request(app.getHttpServer()).get(
      `/api/v1/products?categoryId=${root.id}&minPrice=900&maxPrice=1000&sort=PRICE_ASC&page=2&pageSize=1`,
    );
    expect(secondPage.body.data[0].id).not.toBe(list.body.data[0].id);
    const outOfStockDetail = await request(app.getHttpServer()).get(`/api/v1/products/${first.id}`);
    expect(outOfStockDetail.status).toBe(200);
    expect(
      outOfStockDetail.body.data.variants.every(
        (variant: { availableQuantity: number }) => variant.availableQuantity === 0,
      ),
    ).toBe(true);
    const hiddenDetail = await request(app.getHttpServer()).get(`/api/v1/products/${hidden.id}`);
    expect(hiddenDetail.status).toBe(404);
    expect(JSON.stringify(outOfStockDetail.body)).not.toMatch(
      /adminHidden|saleStatus|version|ownerUserId|contactAddress|phone|rejectionReason/,
    );
  });

  it("rejects inverted or malformed price ranges and hides suspended shop listings", async () => {
    const shop = await shopFixture();
    const admin = await register();
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    const cat = await category(admin.body.data.accessToken);
    await publish(shop, cat.id, "Range Product", ["100"], [1]);
    expect(
      (await request(app.getHttpServer()).get("/api/v1/products?minPrice=200&maxPrice=100")).status,
    ).toBe(400);
    expect((await request(app.getHttpServer()).get("/api/v1/products?minPrice=oops")).status).toBe(
      400,
    );
    await db.prisma.shop.update({
      where: { id: shop.id },
      data: { status: "SUSPENDED", decisionReason: "Policy violation" },
    });
    expect(
      (await request(app.getHttpServer()).get(`/api/v1/shops/${shop.id}/products`)).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer()).get(
          `/api/v1/shops/${shop.id}/products?shopId=${shop.id}`,
        )
      ).status,
    ).toBe(400);
  });

  it("exposes an index-assisted query plan for the catalog lookup", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL enable_seqscan = off");
      const plan = await client.query(
        "EXPLAIN SELECT id FROM products WHERE shop_id = $1::uuid AND sale_status = 'ACTIVE' AND admin_hidden = false",
        ["00000000-0000-0000-0000-000000000000"],
      );
      expect(JSON.stringify(plan.rows)).toContain("products_shop_status_created_id_idx");
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });

  it("records a 100-observation discovery baseline over 1,000 products, 10 shops and 20 concurrent guests", async () => {
    const shop = await shopFixture();
    const admin = await register();
    await db.prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    const cat = await category(admin.body.data.accessToken);
    const template = await db.prisma.shop.findUniqueOrThrow({
      where: { id: shop.id },
      include: { logo: true },
    });
    const shopIds = [shop.id];
    for (let i = 1; i < 10; i += 1) {
      const logo = await db.prisma.asset.create({
        data: {
          uploaderUserId: shop.ownerId,
          purpose: "SHOP_LOGO",
          objectKey: `load/${randomUUID()}.png`,
          mimeType: "image/png",
          byteSize: 64,
          width: 1,
          height: 1,
          status: "VERIFIED",
        },
      });
      const next = await db.prisma.shop.create({
        data: {
          ownerUserId: template.ownerUserId,
          name: `Load Shop ${i}`,
          slugNormalized: `load-shop-${i}-${randomUUID().slice(0, 6)}`,
          description: "Load fixture",
          logoAssetId: logo.id,
          contactAddress: "fixture",
          phone: "0900000000",
          status: "ACTIVE",
          approvedAt: new Date(),
        },
      });
      shopIds.push(next.id);
    }
    await db.prisma.$executeRaw`
      WITH shop_rows AS (SELECT id FROM unnest(${shopIds}::uuid[]) AS id), inserted AS (
        INSERT INTO products (id, shop_id, category_id, name, description, sale_status, admin_hidden)
        SELECT gen_random_uuid(), shop_rows.id, ${cat.id}::uuid, 'Load item ' || n, 'Performance fixture', 'ACTIVE', false
        FROM shop_rows CROSS JOIN generate_series(1, 100) AS n RETURNING id, shop_id
      )
      INSERT INTO product_variants (id, product_id, shop_id, sku_normalized, attributes_key, price, sale_status)
      SELECT gen_random_uuid(), id, shop_id, 'LOAD-' || id::text, '{}', 100000, 'ACTIVE' FROM inserted`;

    const observations: number[] = [];
    for (let batch = 0; batch < 5; batch += 1) {
      const requests = Array.from({ length: 20 }, async () => {
        const start = performance.now();
        const response = await request(app.getHttpServer()).get(
          "/api/v1/products?q=Load%20item&pageSize=20",
        );
        observations.push(performance.now() - start);
        expect(response.status).toBe(200);
        expect(response.body.meta.total).toBe(1000);
        expect(response.body.data).toHaveLength(20);
      });
      await Promise.all(requests);
    }
    observations.sort((a, b) => a - b);
    const p95 = observations[Math.ceil(observations.length * 0.95) - 1]!;
    expect(p95).toBeLessThan(2_000);
    process.stdout.write(
      `Discovery baseline: 100 observations, 20 concurrent, 1,000 products / 10 shops; p95=${p95.toFixed(1)}ms; host=${hostname()} ${process.platform}/${process.arch}; CPU=${cpus()[0]?.model ?? "unknown"}; API=Supertest in-process; database=integration helper\n`,
    );
  }, 120_000);
});
