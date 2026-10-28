import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import request from "supertest";
import { Pool } from "pg";
import { AppModule } from "../../src/app.module.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { createContractValidationPipe } from "../../src/common/http/validation.pipe.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import {
  getDisposableDatabaseUrl,
  resetAndDeployMigrations,
} from "../helpers/database.js";
import { Barrier } from "../helpers/concurrency.js";
import { buildTargetSellerOrdersSnapshot } from "../../src/modules/payment/services/target-snapshot.js";

type Actor = { id: string; token: string };
const reportRange = "from=2026-10-01T00%3A00%3A00Z&to=2026-12-01T00%3A00%3A00Z";
describe("US8 reviews and revenue on PostgreSQL", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  let app: INestApplication;
  let pool: Pool;
  let db: DatabaseService;
  let buyer: Actor, stranger: Actor, seller: Actor, otherSeller: Actor;
  let shopId: string,
    otherShopId: string,
    productId: string,
    otherProductId: string;
  let completedItem: string, secondCompletedItem: string, pendingItem: string;

  async function register(name: string): Promise<Actor> {
    const result = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: `us8-${randomUUID()}@example.test`,
        password: "Correct horse battery staple 9!",
        fullName: name,
        clientPlatform: "ANDROID",
      });
    expect(result.status).toBe(201);
    return {
      id: result.body.data.user.id,
      token: result.body.data.accessToken,
    };
  }

  async function createShop(owner: Actor) {
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: owner.id,
        purpose: "SHOP_LOGO",
        objectKey: `us8/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shop = await db.prisma.shop.create({
      data: {
        ownerUserId: owner.id,
        name: "US8 shop",
        slugNormalized: `us8-${randomUUID().slice(0, 12)}`,
        description: "Disposable US8 shop",
        logoAssetId: logo.id,
        contactAddress: "1 Test Road",
        phone: "0901234567",
        status: "ACTIVE",
        approvedAt: new Date(),
        members: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
      },
    });
    const category = await db.prisma.category.create({
      data: {
        name: "US8 category",
        slug: `us8-${randomUUID().slice(0, 12)}`,
        status: "VISIBLE",
      },
    });
    const product = await db.prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: category.id,
        name: "US8 product",
        description: "Review fixture",
        saleStatus: "ACTIVE",
      },
    });
    const variant = await db.prisma.productVariant.create({
      data: {
        productId: product.id,
        shopId: shop.id,
        skuNormalized: `US8-${randomUUID().slice(0, 12)}`,
        attributes: {},
        attributesKey: "{}",
        price: "101",
        saleStatus: "ACTIVE",
        inventory: { create: { availableQuantity: 10 } },
      },
    });
    return { shop, product, variant };
  }

  async function createItem(
    fixture: Awaited<ReturnType<typeof createShop>>,
    status:
      | "PENDING"
      | "CONFIRMED"
      | "PACKING"
      | "SHIPPING"
      | "DELIVERED"
      | "COMPLETED"
      | "CANCELLED",
    amount: string,
    completedAt?: Date,
  ) {
    const order = await db.prisma.marketplaceOrder.create({
      data: {
        buyerUserId: buyer.id,
        publicNumber: `US8-${randomUUID().slice(0, 12)}`,
        recipientSnapshot: {
          recipientName: "US8 Buyer",
          phone: "0901234567",
          line1: "1 Test Road",
          ward: "Ward",
          district: "District",
          province: "HCMC",
          country: "VN",
        },
        paymentMethod: "COD",
        originalTotal: amount,
      },
    });
    const part = await db.prisma.sellerOrder.create({
      data: {
        orderId: order.id,
        shopId: fixture.shop.id,
        shopNameSnapshot: fixture.shop.name,
        status,
        originalTotal: amount,
        ...(completedAt ? { completedAt } : {}),
        ...(status === "CANCELLED"
          ? {
              cancelledAt: new Date("2026-10-26T17:00:00Z"),
              cancellationReason: "Returned",
            }
          : {}),
      },
    });
    const item = await db.prisma.orderItem.create({
      data: {
        sellerOrderId: part.id,
        shopId: fixture.shop.id,
        productId: fixture.product.id,
        variantId: fixture.variant.id,
        productNameSnapshot: fixture.product.name,
        skuSnapshot: fixture.variant.skuNormalized,
        attributesSnapshot: {},
        unitPrice: amount,
        quantity: 1,
        lineTotal: amount,
      },
    });
    return item.id;
  }

  beforeAll(async () => {
    await resetAndDeployMigrations();
    const testUrl = getDisposableDatabaseUrl();
    pool = new Pool({
      connectionString: testUrl.toString(),
      options: "-c timezone=Asia/Bangkok",
      max: 1,
    });
    testUrl.searchParams.set("options", "-c timezone=Asia/Bangkok");
    process.env.DATABASE_URL = testUrl.toString();
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
    buyer = await register("Buyer Display");
    stranger = await register("Other Buyer");
    seller = await register("Seller A");
    otherSeller = await register("Seller B");
    const first = await createShop(seller);
    const second = await createShop(otherSeller);
    shopId = first.shop.id;
    otherShopId = second.shop.id;
    productId = first.product.id;
    otherProductId = second.product.id;
    for (const saleStatus of ["DRAFT", "DISCONTINUED"] as const) {
      await db.prisma.product.create({
        data: {
          shopId,
          categoryId: first.product.categoryId,
          name: `US8 ${saleStatus}`,
          description: "Count fixture",
          saleStatus,
        },
      });
    }
    completedItem = await createItem(
      first,
      "COMPLETED",
      "101",
      new Date("2026-10-31T16:59:59Z"),
    );
    secondCompletedItem = await createItem(
      first,
      "COMPLETED",
      "202",
      new Date("2026-10-31T17:00:00Z"),
    );
    pendingItem = await createItem(first, "PENDING", "700");
    for (const status of [
      "CONFIRMED",
      "PACKING",
      "SHIPPING",
      "DELIVERED",
    ] as const)
      await createItem(first, status, "701");
    const cancelledItem = await createItem(first, "PENDING", "999");
    const cancelled = await db.prisma.orderItem.findUniqueOrThrow({
      where: { id: cancelledItem },
      include: { sellerOrder: true },
    });
    await db.prisma
      .$executeRaw`UPDATE marketplace_orders SET payment_method = 'MOCK', payment_deadline = created_at + INTERVAL '15 minutes' WHERE id = ${cancelled.sellerOrder.orderId}::uuid`;
    const payment = await db.prisma.payment.create({
      data: { orderId: cancelled.sellerOrder.orderId, method: "MOCK" },
    });
    const attempt = await db.prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        provider: "MOCK",
        status: "SUCCEEDED",
        targetSellerOrdersSnapshot: buildTargetSellerOrdersSnapshot({
          mode: "NEW",
          orderId: payment.orderId,
          amount: "999",
          sellerOrders: [cancelled.sellerOrder],
          snapshot: [{ sellerOrderId: cancelled.sellerOrderId, amount: "999" }],
        }),
        amount: "999",
        operationKey: `us8-attempt-${randomUUID()}`,
      },
    });
    await db.prisma.sellerOrder.update({
      where: { id: cancelled.sellerOrderId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: "fixture cancellation",
      },
    });
    const allocation = await db.prisma.paymentAllocation.create({
      data: {
        attemptId: attempt.id,
        sellerOrderId: cancelled.sellerOrderId,
        amount: "999",
        kind: "MOCK_PREPAYMENT",
      },
    });
    await db.prisma.simulatedRefund.create({
      data: {
        allocationId: allocation.id,
        sellerOrderId: cancelled.sellerOrderId,
        amount: "999",
        reason: "CANCELLATION",
        operationKey: `us8-refund-${randomUUID()}`,
      },
    });
    await createItem(
      second,
      "COMPLETED",
      "9999",
      new Date("2026-10-31T17:00:00Z"),
    );
  }, 120_000);
  afterAll(async () => {
    await app?.close();
    await pool?.end();
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("uses UTC for API database sessions and preserves completion instants despite a non-UTC connection option", async () => {
    const serverZone = await pool.query<{ TimeZone: string }>("SHOW TimeZone");
    expect(serverZone.rows[0]?.TimeZone).toBe("Asia/Bangkok");
    const session = await db.prisma.$queryRaw<
      Array<{ zone: string }>
    >`SELECT current_setting('TimeZone') AS zone`;
    expect(session[0]?.zone).toBe("UTC");
    const item = await db.prisma.orderItem.findUniqueOrThrow({
      where: { id: completedItem },
      include: { sellerOrder: true },
    });
    expect(item.sellerOrder.completedAt?.toISOString()).toBe(
      "2026-10-31T16:59:59.000Z",
    );
    const persisted = await pool.query<{ utc_time: string }>(
      "SELECT to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS utc_time FROM seller_orders WHERE id = $1",
      [item.sellerOrderId],
    );
    expect(persisted.rows[0]?.utc_time).toBe("2026-10-31T16:59:59Z");
  });

  it("rejects another buyer, incomplete purchases and invalid ratings", async () => {
    const post = (actor: Actor, orderItemId: string, rating: number) =>
      request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${actor.token}`)
        .send({ orderItemId, rating, comment: "A review" });
    expect((await post(stranger, completedItem, 5)).status).toBe(404);
    expect((await post(buyer, pendingItem, 5)).status).toBe(422);
    expect((await post(buyer, completedItem, 6)).status).toBe(400);
    expect((await post(buyer, completedItem, 0)).status).toBe(400);
    expect(
      (
        await request(app.getHttpServer())
          .post("/api/v1/reviews")
          .set("Authorization", `Bearer ${buyer.token}`)
          .send({ orderItemId: completedItem, rating: 5, comment: "   " })
      ).status,
    ).toBe(400);
  });

  it("allows one of two concurrent reviews and publishes only a safe display name", async () => {
    const post = () =>
      request(app.getHttpServer())
        .post("/api/v1/reviews")
        .set("Authorization", `Bearer ${buyer.token}`)
        .send({
          orderItemId: completedItem,
          rating: 5,
          comment: "  Excellent  ",
        });
    const results = await Promise.all([post(), post()]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await db.prisma.review.count({ where: { orderItemId: completedItem } }),
    ).toBe(1);
    const list = await request(app.getHttpServer()).get(
      `/api/v1/products/${productId}/reviews`,
    );
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        buyerDisplayName: "Buyer Display",
        rating: 5,
        comment: "Excellent",
      }),
    ]);
    expect(JSON.stringify(list.body)).not.toContain("@example.test");
    expect(JSON.stringify(list.body)).not.toContain("recipientSnapshot");
    const filtered = await request(app.getHttpServer()).get(
      `/api/v1/products/${productId}/reviews?rating=4`,
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toEqual([]);
    expect(
      (
        await request(app.getHttpServer()).get(
          `/api/v1/products/${productId}/reviews?rating=0`,
        )
      ).status,
    ).toBe(400);
    const detail = await request(app.getHttpServer()).get(
      `/api/v1/products/${productId}`,
    );
    expect(detail.body.data).toMatchObject({
      ratingAverage: "5",
      ratingCount: 1,
    });
    const item = await db.prisma.orderItem.findUniqueOrThrow({
      where: { id: completedItem },
      include: { sellerOrder: true },
    });
    const order = await request(app.getHttpServer())
      .get(`/api/v1/orders/${item.sellerOrder.orderId}`)
      .set("Authorization", `Bearer ${buyer.token}`);
    const reviewed = order.body.data.sellerOrders
      .flatMap((part: { items: Array<{ id: string }> }) => part.items)
      .find((row: { id: string }) => row.id === completedItem);
    expect(reviewed.reviewId).toBe(
      results.find((result) => result.status === 201)?.body.data.id,
    );
    expect(reviewed.review).toMatchObject({ rating: 5, comment: "Excellent" });
    const admin = await register("Admin Reviewer");
    await db.prisma.user.update({
      where: { id: admin.id },
      data: { systemRole: "ADMIN" },
    });
    const products = await request(app.getHttpServer())
      .get(`/api/v1/admin/products?shopId=${shopId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(products.status).toBe(200);
    expect(products.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: productId,
          ratingAverage: "5",
          ratingCount: 1,
        }),
      ]),
    );
  });

  it("isolates shops and permits active members of suspended shops to read", async () => {
    await db.prisma.shop.update({
      where: { id: shopId },
      data: { status: "SUSPENDED", decisionReason: "Moderation" },
    });
    const reviews = await request(app.getHttpServer())
      .get(`/api/v1/shops/${shopId}/reviews`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(reviews.status).toBe(200);
    expect(
      (
        await request(app.getHttpServer()).get(
          `/api/v1/products/${productId}/reviews`,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/shops/${shopId}/reviews?productId=${otherProductId}`)
          .set("Authorization", `Bearer ${seller.token}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/v1/shops/${shopId}/stats?${reportRange}`)
          .set("Authorization", `Bearer ${otherSeller.token}`)
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .get(
            `/api/v1/shops/${otherShopId}/revenue?${reportRange}&groupBy=DAY`,
          )
          .set("Authorization", `Bearer ${seller.token}`)
      ).status,
    ).toBe(404);
  });

  it("enforces one review per item when two PostgreSQL connections race", async () => {
    const racePool = new Pool({
      connectionString: getDisposableDatabaseUrl().toString(),
      options: "-c timezone=UTC",
      max: 2,
    });
    const clients = await Promise.all([racePool.connect(), racePool.connect()]);
    const barrier = new Barrier(2);
    try {
      const compete = async (client: (typeof clients)[number]) => {
        try {
          await client.query("BEGIN");
          await barrier.wait();
          await client.query(
            "INSERT INTO reviews (buyer_user_id,order_item_id,product_id,rating,comment) VALUES ($1,$2,$3,4,'race')",
            [buyer.id, secondCompletedItem, productId],
          );
          await client.query("COMMIT");
          return "committed";
        } catch (error) {
          await client.query("ROLLBACK");
          return typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "unknown";
        }
      };
      const results = await Promise.all(clients.map(compete));
      expect(results.sort()).toEqual(["23505", "committed"]);
      expect(
        await db.prisma.review.count({
          where: { orderItemId: secondCompletedItem },
        }),
      ).toBe(1);
    } finally {
      clients.forEach((client) => client.release());
      await racePool.end();
    }
  });

  it("enforces rating bounds in the database", async () => {
    for (const rating of [0, 6]) {
      await expect(
        pool.query(
          "INSERT INTO reviews (buyer_user_id,order_item_id,product_id,rating,comment) VALUES ($1,$2,$3,$4,'invalid')",
          [buyer.id, pendingItem, productId, rating],
        ),
      ).rejects.toMatchObject({ code: "23514" });
    }
  });

  it("counts only this shop and groups exact VND by Vietnam completion date", async () => {
    const query =
      "from=2026-10-31T00%3A00%3A00.000Z&to=2026-11-02T00%3A00%3A00.000Z";
    const stats = await request(app.getHttpServer())
      .get(`/api/v1/shops/${shopId}/stats?${query}`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.data).toMatchObject({
      productCount: 2,
      pendingCount: 1,
      processingCount: 4,
      completedCount: 2,
      completedRevenue: "303",
      simulated: true,
    });
    expect(await db.prisma.simulatedRefund.count()).toBe(1);
    const daily = await request(app.getHttpServer())
      .get(`/api/v1/shops/${shopId}/revenue?${query}&groupBy=DAY`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(daily.status).toBe(200);
    expect(daily.body.data).toMatchObject({
      totalRevenue: "303",
      simulated: true,
      points: [
        { period: "2026-10-31", completedCount: 1, revenue: "101" },
        { period: "2026-11-01", completedCount: 1, revenue: "202" },
      ],
    });
    const monthly = await request(app.getHttpServer())
      .get(`/api/v1/shops/${shopId}/revenue?${query}&groupBy=MONTH`)
      .set("Authorization", `Bearer ${seller.token}`);
    expect(monthly.status).toBe(200);
    expect(monthly.body.data).toMatchObject({
      totalRevenue: "303",
      points: [
        { period: "2026-10", completedCount: 1, revenue: "101" },
        { period: "2026-11", completedCount: 1, revenue: "202" },
      ],
    });
  });

  it("requires every report parameter, rejects invalid ranges and permits long ranges", async () => {
    const get = (query: string) =>
      request(app.getHttpServer())
        .get(`/api/v1/shops/${shopId}/revenue?${query}`)
        .set("Authorization", `Bearer ${seller.token}`);
    expect(
      (await get("groupBy=DAY&from=2026-10-27&to=2026-10-28")).status,
    ).toBe(400);
    expect(
      (
        await get(
          "groupBy=DAY&from=2026-10-28T00%3A00%3A00Z&to=2026-10-27T00%3A00%3A00Z",
        )
      ).status,
    ).toBe(400);
    expect(
      (await get("groupBy=DAY&from=2999-01-01T00%3A00%3A00Z")).status,
    ).toBe(400);
    expect((await get("from=2026-10-26T00%3A00%3A00Z")).status).toBe(400);
    const withoutFrom = await get("to=2026-11-01T00%3A00%3A00Z&groupBy=DAY");
    expect(withoutFrom.status).toBe(400);
    expect(withoutFrom.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "from" })]),
    );
    expect(
      (
        await get(
          "from=1900-01-01T00%3A00%3A00Z&to=2999-01-01T00%3A00%3A00Z&groupBy=MONTH",
        )
      ).status,
    ).toBe(200);
  });

  it("denies revoked members, locked users and pending or rejected shops", async () => {
    const paths = [
      `/api/v1/shops/${shopId}/reviews`,
      `/api/v1/shops/${shopId}/stats?${reportRange}`,
      `/api/v1/shops/${shopId}/revenue?${reportRange}&groupBy=DAY`,
    ];
    expect((await request(app.getHttpServer()).get(paths[0]!)).status).toBe(
      401,
    );
    await db.prisma.shopMember.update({
      where: { shopId_userId: { shopId, userId: seller.id } },
      data: { status: "REVOKED" },
    });
    for (const path of paths)
      expect(
        (
          await request(app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${seller.token}`)
        ).status,
      ).toBe(404);
    await db.prisma.shopMember.update({
      where: { shopId_userId: { shopId, userId: seller.id } },
      data: { status: "ACTIVE" },
    });
    await db.prisma.user.update({
      where: { id: seller.id },
      data: { status: "LOCKED" },
    });
    for (const path of paths)
      expect(
        (
          await request(app.getHttpServer())
            .get(path)
            .set("Authorization", `Bearer ${seller.token}`)
        ).status,
      ).toBe(401);
    await db.prisma.user.update({
      where: { id: seller.id },
      data: { status: "ACTIVE" },
    });
    for (const status of ["PENDING", "REJECTED"] as const) {
      await db.prisma.shop.update({
        where: { id: shopId },
        data: {
          status,
          approvedAt: null,
          decisionReason: status === "REJECTED" ? "Rejected" : null,
        },
      });
      for (const path of paths)
        expect(
          (
            await request(app.getHttpServer())
              .get(path)
              .set("Authorization", `Bearer ${seller.token}`)
          ).status,
        ).toBe(404);
    }
  });

  it("seeds completed, refunded and midnight cases idempotently in the disposable database", async () => {
    for (let run = 0; run < 2; run++) {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-loader",
          "./scripts/resolve-prisma-generated-ts.mjs",
          "--experimental-strip-types",
          "prisma/seed/reviews-statistics.seed.ts",
        ],
        { cwd: process.cwd(), env: process.env, encoding: "utf8" },
      );
      expect({ status: result.status, stderr: result.stderr }).toMatchObject({
        status: 0,
      });
    }
    const rejected = spawnSync(
      process.execPath,
      [
        "--experimental-loader",
        "./scripts/resolve-prisma-generated-ts.mjs",
        "--experimental-strip-types",
        "prisma/seed/reviews-statistics.seed.ts",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, TEST_DATABASE_NAME_CONFIRMATION: "wrong-name" },
        encoding: "utf8",
      },
    );
    expect(rejected.status).not.toBe(0);
    const shop = await db.prisma.shop.findUniqueOrThrow({
      where: { slugNormalized: "us8-statistics-seed" },
    });
    const parts = await db.prisma.sellerOrder.findMany({
      where: { shopId: shop.id },
      include: { refunds: true },
      orderBy: { originalTotal: "asc" },
    });
    expect(
      parts.map((part) => [
        part.status,
        part.originalTotal.toFixed(0),
        part.refunds.length,
      ]),
    ).toEqual([
      ["COMPLETED", "101", 0],
      ["COMPLETED", "202", 0],
      ["CANCELLED", "999", 1],
    ]);
    expect(parts[0]?.completedAt?.toISOString()).toBe(
      "2026-10-26T16:59:59.000Z",
    );
    expect(parts[1]?.completedAt?.toISOString()).toBe(
      "2026-10-26T17:00:00.000Z",
    );
    expect(
      await db.prisma.review.count({ where: { product: { shopId: shop.id } } }),
    ).toBe(1);
  });

  it("rechecks buyer status under the user lock when an account is locked concurrently", async () => {
    const racePool = new Pool({
      connectionString: getDisposableDatabaseUrl().toString(),
      max: 1,
    });
    const client = await racePool.connect();
    let committed = false;
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET status='LOCKED' WHERE id=$1", [
        buyer.id,
      ]);
      const pending = Promise.resolve(
        request(app.getHttpServer())
          .post("/api/v1/reviews")
          .set("Authorization", `Bearer ${buyer.token}`)
          .send({
            orderItemId: completedItem,
            rating: 4,
            comment: "Concurrent lock",
          }),
      );
      let waitingForUserLock = false;
      for (let attempt = 0; attempt < 80 && !waitingForUserLock; attempt++) {
        const waits = await pool.query<{ waiting: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM users WHERE id%') AS waiting",
        );
        waitingForUserLock = waits.rows[0]?.waiting ?? false;
        if (!waitingForUserLock)
          await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await client.query("COMMIT");
      committed = true;
      const response = await pending;
      expect(waitingForUserLock).toBe(true);
      expect(response.status).toBe(401);
    } finally {
      if (!committed) await client.query("ROLLBACK");
      client.release();
      await racePool.end();
      await db.prisma.user.update({
        where: { id: buyer.id },
        data: { status: "ACTIVE" },
      });
    }
  });
});
