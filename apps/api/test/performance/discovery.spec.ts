import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { cpus, hostname } from "node:os";
import { performance } from "node:perf_hooks";
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
import { summarizeLatencies } from "../helpers/performance-metrics.js";

const password = "Correct horse battery staple 9!";
const email = () => `performance-${randomUUID()}@example.test`;

describe("T147 discovery performance on PostgreSQL", () => {
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

  async function createOwner() {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: email(),
        password,
        fullName: "Performance Fixture Owner",
        clientPlatform: "ANDROID",
      });
    expect(response.status).toBe(201);
    return response.body.data.user.id as string;
  }

  async function createShop(ownerUserId: string, index: number) {
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: ownerUserId,
        purpose: "SHOP_LOGO",
        objectKey: `performance/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shop = await db.prisma.shop.create({
      data: {
        ownerUserId,
        name: `Performance Shop ${index + 1}`,
        slugNormalized: `performance-${index}-${randomUUID().slice(0, 8)}`,
        description: "Disposable performance fixture",
        logoAssetId: logo.id,
        contactAddress: "Disposable fixture",
        phone: "0900000000",
        status: "ACTIVE",
        approvedAt: new Date(),
      },
    });
    return shop.id;
  }

  it("records 100 search latencies and the natural query plan over reconciled fixture data", async () => {
    const ownerUserId = await createOwner();
    const shopIds: string[] = [];
    for (let index = 0; index < 10; index += 1)
      shopIds.push(await createShop(ownerUserId, index));

    const category = await db.prisma.category.create({
      data: {
        name: "Performance Fixture Category",
        slug: `performance-${randomUUID().slice(0, 12)}`,
        status: "VISIBLE",
      },
    });

    await db.prisma.$executeRaw`
      WITH shop_rows AS (
        SELECT id FROM unnest(${shopIds}::uuid[]) AS id
      ), inserted_products AS (
        INSERT INTO products (id, shop_id, category_id, name, description, sale_status, admin_hidden)
        SELECT gen_random_uuid(), shop_rows.id, ${category.id}::uuid,
          'Load item ' || n, 'Performance fixture', 'ACTIVE', false
        FROM shop_rows CROSS JOIN generate_series(1, 100) AS n
        RETURNING id, shop_id
      ), inserted_variants AS (
        INSERT INTO product_variants (
          id, product_id, shop_id, sku_normalized, attributes_key, price, sale_status
        )
        SELECT gen_random_uuid(), id, shop_id, 'LOAD-' || id::text, '{}', 100000, 'ACTIVE'
        FROM inserted_products
        RETURNING id, shop_id
      )
      INSERT INTO inventory (variant_id, shop_id, available_quantity)
      SELECT id, shop_id, 5 FROM inserted_variants`;

    const totals = await db.prisma.$queryRaw<
      Array<{
        productCount: number;
        unitPriceTotal: string;
        availableUnits: number;
      }>
    >`
      SELECT COUNT(DISTINCT p.id)::int AS "productCount",
        COALESCE(SUM(v.price), 0)::text AS "unitPriceTotal",
        COALESCE(SUM(i.available_quantity), 0)::int AS "availableUnits"
      FROM products p
      JOIN product_variants v ON v.product_id = p.id AND v.shop_id = p.shop_id
      JOIN inventory i ON i.variant_id = v.id AND i.shop_id = v.shop_id
      WHERE p.name LIKE 'Load item %'`;
    expect(totals[0]).toEqual({
      productCount: 1_000,
      unitPriceTotal: "100000000",
      availableUnits: 5_000,
    });

    await pool.query("ANALYZE products");
    await pool.query("ANALYZE product_variants");
    await pool.query("ANALYZE inventory");
    await pool.query("ANALYZE shops");

    // Mirror both SQL statements in DiscoveryRepository.list for q=Load item and default filters.
    const discoveryCtes = `WITH RECURSIVE visible_categories AS (
      SELECT id, parent_id FROM categories WHERE status = 'VISIBLE' AND parent_id IS NULL
      UNION ALL
      SELECT child.id, child.parent_id
      FROM categories child JOIN visible_categories parent ON child.parent_id = parent.id
      WHERE child.status = 'VISIBLE'
    ), selected_categories AS (
      SELECT id FROM visible_categories WHERE id = $1::uuid
      UNION ALL
      SELECT child.id FROM categories child JOIN selected_categories parent ON child.parent_id = parent.id
      WHERE child.status = 'VISIBLE'
    ), eligible_products AS (
      SELECT p.id, p.shop_id, p.name, p.description, p.category_id, s.name AS shop_name, p.created_at,
        MIN(v.price) AS minimum_price,
        BOOL_OR(COALESCE(i.available_quantity, 0) > 0) AS available
      FROM products p
      JOIN shops s ON s.id = p.shop_id AND s.status = 'ACTIVE'
      JOIN visible_categories vc ON vc.id = p.category_id
      JOIN product_variants v ON v.product_id = p.id AND v.shop_id = p.shop_id AND v.sale_status = 'ACTIVE'
      LEFT JOIN inventory i ON i.variant_id = v.id AND i.shop_id = v.shop_id
      WHERE p.sale_status = 'ACTIVE' AND p.admin_hidden = false
        AND ($2::uuid IS NULL OR p.shop_id = $2::uuid)
        AND ($1::uuid IS NULL OR p.category_id IN (SELECT id FROM selected_categories))
        AND ($3::text IS NULL OR p.name ILIKE '%' || $3::text || '%'
          OR p.description ILIKE '%' || $3::text || '%')
      GROUP BY p.id, s.name
      HAVING ($4::numeric IS NULL OR MIN(v.price) >= $4::numeric)
        AND ($5::numeric IS NULL OR MIN(v.price) <= $5::numeric)
    )`;
    const queryParams = [null, null, "Load item", null, null, "NEWEST", 20, 0];
    const countPlan = await pool.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       ${discoveryCtes}
       SELECT COUNT(*)::int AS total FROM eligible_products`,
      queryParams.slice(0, 5),
    );
    const itemsPlan = await pool.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       ${discoveryCtes}
       SELECT id, shop_name AS "shopName", minimum_price::text AS "minimumPrice", available,
         created_at AS "createdAt"
       FROM eligible_products
       ORDER BY
         CASE WHEN $6::text = 'PRICE_ASC' THEN minimum_price END ASC,
         CASE WHEN $6::text = 'PRICE_DESC' THEN minimum_price END DESC,
         CASE WHEN $6::text = 'NEWEST' THEN created_at END DESC,
         id ASC
       LIMIT $7::int OFFSET $8::int`,
      queryParams,
    );

    const observations: Array<{ latencyMs: number; valid: boolean }> = [];
    for (let batch = 0; batch < 5; batch += 1) {
      const responses = await Promise.all(
        Array.from({ length: 20 }, async () => {
          const startedAt = performance.now();
          try {
            const response = await request(app.getHttpServer()).get(
              "/api/v1/products?q=Load%20item&pageSize=20",
            );
            const valid =
              response.status === 200 &&
              response.body.meta.total === 1_000 &&
              response.body.data.length === 20 &&
              response.body.data.every(
                (item: { minimumPrice?: string; available?: boolean }) =>
                  item.minimumPrice === "100000" && item.available === true,
              );
            observations.push({
              latencyMs: performance.now() - startedAt,
              valid,
            });
          } catch {
            observations.push({
              latencyMs: performance.now() - startedAt,
              valid: false,
            });
          }
        }),
      );
      expect(responses).toHaveLength(20);
    }

    const metrics = summarizeLatencies(
      observations.map(({ latencyMs }) => latencyMs),
      2_000,
    );
    const failedResponses = observations.filter(({ valid }) => !valid).length;
    const versionResult = await pool.query<{ serverVersion: string }>(
      "SELECT current_setting('server_version') AS \"serverVersion\"",
    );
    const serverVersion = versionResult.rows[0]?.serverVersion ?? "unknown";
    process.stdout.write(
      `T147_SC006 ${JSON.stringify({
        ...metrics,
        validatedResponses: observations.length - failedResponses,
        failedResponses,
        fixture: {
          products: 1_000,
          shops: 10,
          priceTotalVnd: 100_000_000,
          stockUnits: 5_000,
        },
        host: hostname(),
        platform: `${process.platform}/${process.arch}`,
        cpu: cpus()[0]?.model ?? "unknown",
        node: process.version,
        postgres: serverVersion,
        transport: "Supertest in-process",
        countPlan: countPlan.rows[0]?.["QUERY PLAN"],
        itemsPlan: itemsPlan.rows[0]?.["QUERY PLAN"],
      })}\n`,
    );
    expect(metrics.sampleCount).toBe(100);
    expect(failedResponses).toBe(0);
    expect(metrics.underThresholdCount).toBeGreaterThanOrEqual(95);
    expect(metrics.p95Ms).toBeLessThan(2_000);
  }, 180_000);
});
