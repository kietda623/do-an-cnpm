import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { InventoryService } from "../../src/modules/inventory/services/inventory.service.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";
import type { Pool } from "pg";

describe("inventory ledger PostgreSQL integration", () => {
  let app: INestApplication;
  let pool: Pool;
  let db: DatabaseService;
  let inventory: InventoryService;
  let userId: string;
  let shopId: string;
  let variantId: string;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    db = app.get(DatabaseService);
    inventory = app.get(InventoryService);
    userId = (
      await db.prisma.user.create({
        data: {
          emailNormalized: `inventory-${randomUUID()}@example.test`,
          passwordHash: "integration",
          displayName: "Inventory tester",
        },
      })
    ).id;
    const logo = await db.prisma.asset.create({
      data: {
        uploaderUserId: userId,
        purpose: "SHOP_LOGO",
        objectKey: `inventory/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 64,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
    const shop = await db.prisma.shop.create({
      data: {
        ownerUserId: userId,
        name: "Inventory fixture",
        slugNormalized: `inventory-${randomUUID().slice(0, 8)}`,
        description: "Inventory integration fixture",
        logoAssetId: logo.id,
        contactAddress: "Test street",
        phone: "0901234567",
        status: "ACTIVE",
        approvedAt: new Date(),
      },
    });
    shopId = shop.id;
    await db.prisma.shopMember.create({
      data: { userId, shopId, role: "OWNER", status: "ACTIVE" },
    });
    await db.prisma.asset.update({
      where: { id: logo.id },
      data: { shopId, attachedAt: new Date() },
    });
    const category = await db.prisma.category.create({
      data: { name: "Inventory category", slug: `inventory-${randomUUID().slice(0, 8)}` },
    });
    const product = await db.prisma.product.create({
      data: { shopId, categoryId: category.id, name: "Inventory product", description: "Fixture" },
    });
    const variant = await db.prisma.productVariant.create({
      data: {
        productId: product.id,
        shopId,
        skuNormalized: `INV-${randomUUID().slice(0, 8)}`,
        attributes: {},
        attributesKey: "{}",
        price: "1000",
      },
    });
    variantId = variant.id;
    await db.prisma.inventory.create({ data: { variantId, shopId, availableQuantity: 1 } });
    await db.prisma.inventoryMovement.create({
      data: {
        inventoryId: variantId,
        shopId,
        actorUserId: userId,
        kind: "INITIAL",
        quantityDelta: 1,
        quantityAfter: 1,
        operationKey: `opening:${randomUUID()}`,
      },
    });
  }, 120_000);
  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("rejects zero and negative stock, serializes versioned adjustments, and protects the append-only ledger", async () => {
    await expect(
      inventory.adjust(userId, shopId, variantId, {
        delta: 0,
        reason: "No change",
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      inventory.adjust(userId, shopId, variantId, {
        delta: -2,
        reason: "Bad count",
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const writes = await Promise.allSettled([
      inventory.adjust(userId, shopId, variantId, {
        delta: 2,
        reason: "Count one",
        expectedVersion: 0,
      }),
      inventory.adjust(userId, shopId, variantId, {
        delta: 3,
        reason: "Count two",
        expectedVersion: 0,
      }),
    ]);
    expect(writes.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    expect(writes.filter((row) => row.status === "rejected")).toHaveLength(1);
    const row = await db.prisma.inventory.findUniqueOrThrow({
      where: { variantId },
      include: { movements: true },
    });
    expect(row.version).toBe(1);
    expect(row.availableQuantity).toBeGreaterThanOrEqual(3);
    expect(row.movements.filter((movement) => movement.kind === "ADJUST")).toHaveLength(1);
    await expect(
      db.prisma.inventoryMovement.update({
        where: { id: row.movements[0]!.id },
        data: { reason: "tampered" },
      }),
    ).rejects.toThrow(/append-only/);
  });
});
