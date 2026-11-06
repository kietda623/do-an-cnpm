import * as argon2 from "argon2";
import { createHash } from "node:crypto";
import {
  Prisma,
  type PrismaClient,
} from "../../src/generated/prisma/client.js";
import { buildTargetSellerOrdersSnapshot } from "../../src/modules/payment/services/target-snapshot.js";
import {
  buildDemoFixturePlan,
  demoStableId,
  type DemoFixturePlan,
  type DemoOrderFixture,
  type DemoSeedPasswords,
  type DemoShopFixture,
} from "./demo-fixtures.js";

const INITIAL_STOCK = 25;
const ORDER_AMOUNT = "10000";
const FIXTURE_CREATED_AT = new Date("2026-10-01T09:00:00.000Z");
const PAYMENT_SETTLED_AT = new Date("2026-10-01T09:05:00.000Z");
const ORDER_CANCELLED_AT = new Date("2026-10-01T09:10:00.000Z");
const ORDER_COMPLETED_AT = new Date("2026-10-01T12:00:00.000Z");
const MOCK_PAYMENT_DEADLINE = new Date("2026-10-01T09:15:00.000Z");

function failConflict(kind: string, key: string): never {
  throw new Error(
    `Demo seed stable key conflicts with existing ${kind}: ${key}.`,
  );
}

function requireMatchingId(
  actualId: string,
  expectedId: string,
  kind: string,
  key: string,
): void {
  if (actualId !== expectedId) failConflict(kind, key);
}

function assetMetadata(input: {
  id: string;
  uploaderUserId: string;
  shopId: string | null;
  purpose: "SHOP_LOGO" | "PRODUCT_IMAGE";
  objectKey: string;
}) {
  return {
    id: input.id,
    uploaderUserId: input.uploaderUserId,
    shopId: input.shopId,
    purpose: input.purpose,
    objectKey: input.objectKey,
    mimeType: "image/png",
    byteSize: 68,
    width: 1,
    height: 1,
    status: "VERIFIED" as const,
    attachedAt: FIXTURE_CREATED_AT,
  };
}

async function seedUsers(
  prisma: PrismaClient,
  plan: DemoFixturePlan,
  passwords: DemoSeedPasswords,
): Promise<void> {
  const hashByPassword = new Map<string, string>();
  const hashFor = async (password: string): Promise<string> => {
    const cached = hashByPassword.get(password);
    if (cached) return cached;
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    hashByPassword.set(password, passwordHash);
    return passwordHash;
  };

  for (const fixture of plan.users) {
    const existing = await prisma.user.findUnique({
      where: { emailNormalized: fixture.email },
    });
    if (existing) {
      requireMatchingId(existing.id, fixture.id, "demo user", fixture.email);
      continue;
    }

    const password = fixture.key.startsWith("seller-")
      ? passwords.sellerPassword
      : fixture.key === "buyer-locked"
        ? passwords.lockedBuyerPassword
        : passwords.buyerPassword;
    await prisma.user.create({
      data: {
        id: fixture.id,
        emailNormalized: fixture.email,
        passwordHash: await hashFor(password),
        displayName: fixture.displayName,
        systemRole: "BUYER",
        status: fixture.status,
      },
    });
  }
}

async function seedCategories(
  prisma: PrismaClient,
  plan: DemoFixturePlan,
): Promise<void> {
  for (const fixture of plan.categories) {
    const category = await prisma.category.upsert({
      where: { slug: fixture.slug },
      update: {},
      create: {
        id: fixture.id,
        name: fixture.name,
        slug: fixture.slug,
        status: fixture.status,
      },
    });
    requireMatchingId(category.id, fixture.id, "demo category", fixture.slug);
  }
}

async function seedShop(
  prisma: PrismaClient,
  fixture: DemoShopFixture,
  ownerUserId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const logo = await tx.asset.upsert({
      where: { objectKey: fixture.logoObjectKey },
      update: {},
      create: assetMetadata({
        id: fixture.logoAssetId,
        uploaderUserId: ownerUserId,
        shopId: null,
        purpose: "SHOP_LOGO",
        objectKey: fixture.logoObjectKey,
      }),
    });
    requireMatchingId(
      logo.id,
      fixture.logoAssetId,
      "demo shop logo",
      fixture.logoObjectKey,
    );
    if (logo.uploaderUserId !== ownerUserId || logo.purpose !== "SHOP_LOGO") {
      failConflict("demo shop logo metadata", fixture.logoObjectKey);
    }

    const shop = await tx.shop.upsert({
      where: { slugNormalized: fixture.slug },
      update: {},
      create: {
        id: fixture.id,
        ownerUserId,
        name: fixture.name,
        slugNormalized: fixture.slug,
        description: fixture.description,
        logoAssetId: fixture.logoAssetId,
        contactAddress: "1 Demo Street, Ho Chi Minh City",
        phone: `09012345${fixture.slug.slice(-2)}`,
        status: "ACTIVE",
        approvedAt: FIXTURE_CREATED_AT,
      },
    });
    requireMatchingId(shop.id, fixture.id, "demo shop", fixture.slug);
    if (
      shop.ownerUserId !== ownerUserId ||
      shop.logoAssetId !== fixture.logoAssetId
    ) {
      failConflict("demo shop ownership", fixture.slug);
    }

    if (logo.shopId === null) {
      await tx.asset.update({
        where: { id: fixture.logoAssetId },
        data: { shopId: fixture.id, attachedAt: FIXTURE_CREATED_AT },
      });
    } else if (logo.shopId !== fixture.id) {
      failConflict("demo shop logo attachment", fixture.logoObjectKey);
    }

    const ownerMembership = await tx.shopMember.upsert({
      where: { shopId_userId: { shopId: fixture.id, userId: ownerUserId } },
      update: {},
      create: {
        shopId: fixture.id,
        userId: ownerUserId,
        role: "OWNER",
        status: "ACTIVE",
      },
    });
    if (ownerMembership.role !== "OWNER") {
      failConflict("demo shop owner membership", fixture.slug);
    }
  });
}

async function seedCatalogShop(
  prisma: PrismaClient,
  plan: DemoFixturePlan,
  shop: DemoShopFixture,
): Promise<void> {
  const shopProducts = plan.products.filter(
    (product) => product.shopKey === shop.key,
  );
  const owner = plan.users.find((user) => user.key === shop.ownerKey);
  if (!owner) throw new Error(`Demo seller is missing for ${shop.key}.`);

  await prisma.$transaction(
    async (tx) => {
      await tx.asset.createMany({
        data: shopProducts.map((product) =>
          assetMetadata({
            id: product.imageAssetId,
            uploaderUserId: owner.id,
            shopId: shop.id,
            purpose: "PRODUCT_IMAGE",
            objectKey: product.imageObjectKey,
          }),
        ),
        skipDuplicates: true,
      });
      await tx.product.createMany({
        data: shopProducts.map((product) => ({
          id: product.id,
          shopId: shop.id,
          categoryId: plan.categories.find(
            (category) => category.key === product.categoryKey,
          )!.id,
          name: product.name,
          description: product.description,
          saleStatus: "ACTIVE" as const,
          adminHidden: product.adminHidden,
          hiddenReason: product.adminHidden
            ? "Hidden demo catalog fixture."
            : null,
        })),
        skipDuplicates: true,
      });
      await tx.productVariant.createMany({
        data: shopProducts.map((product) => ({
          id: product.variantId,
          productId: product.id,
          shopId: shop.id,
          skuNormalized: product.sku,
          attributes: {},
          attributesKey: "{}",
          price: product.price,
          saleStatus: "ACTIVE" as const,
        })),
        skipDuplicates: true,
      });
      await tx.inventory.createMany({
        data: shopProducts.map((product) => ({
          variantId: product.variantId,
          shopId: shop.id,
          availableQuantity: 0,
        })),
        skipDuplicates: true,
      });
      await tx.productImage.createMany({
        data: shopProducts.map((product) => ({
          productId: product.id,
          assetId: product.imageAssetId,
          position: 0,
        })),
        skipDuplicates: true,
      });

      const initialKeys = shopProducts.map(
        (product) => `demo:inventory:initial:${product.variantId}`,
      );
      const existingInitialMovements = await tx.inventoryMovement.findMany({
        where: { operationKey: { in: initialKeys } },
        select: { inventoryId: true, operationKey: true },
      });
      const existingByKey = new Map(
        existingInitialMovements.map((movement) => [
          movement.operationKey,
          movement.inventoryId,
        ]),
      );
      for (const product of shopProducts) {
        const key = `demo:inventory:initial:${product.variantId}`;
        const inventoryId = existingByKey.get(key);
        if (inventoryId && inventoryId !== product.variantId) {
          failConflict("initial inventory movement", key);
        }
      }
      const missingProducts = shopProducts.filter(
        (product) =>
          !existingByKey.has(`demo:inventory:initial:${product.variantId}`),
      );
      if (missingProducts.length > 0) {
        const missingInventories = await tx.inventory.findMany({
          where: {
            variantId: {
              in: missingProducts.map((product) => product.variantId),
            },
          },
          select: { variantId: true, availableQuantity: true },
        });
        if (
          missingInventories.some(
            (inventory) => inventory.availableQuantity !== 0,
          )
        ) {
          throw new Error(
            "Demo initial stock is non-zero without its stable inventory movement.",
          );
        }
        const created = await tx.inventoryMovement.createMany({
          data: missingProducts.map((product) => ({
            id: demoStableId(
              "inventory-movement",
              `demo:inventory:initial:${product.variantId}`,
            ),
            inventoryId: product.variantId,
            shopId: shop.id,
            actorUserId: owner.id,
            kind: "INITIAL" as const,
            quantityDelta: INITIAL_STOCK,
            quantityAfter: INITIAL_STOCK,
            reason: "Initial demo catalog stock.",
            operationKey: `demo:inventory:initial:${product.variantId}`,
            createdAt: FIXTURE_CREATED_AT,
          })),
          skipDuplicates: true,
        });
        if (created.count !== missingProducts.length) {
          throw new Error(
            "Demo seed detected a concurrent run; run the seed command sequentially.",
          );
        }
        await tx.inventory.updateMany({
          where: {
            variantId: {
              in: missingProducts.map((product) => product.variantId),
            },
          },
          data: { availableQuantity: { increment: INITIAL_STOCK } },
        });
      }

      const [assets, products, variants, inventories, images] =
        await Promise.all([
          tx.asset.findMany({
            where: {
              id: { in: shopProducts.map((product) => product.imageAssetId) },
            },
            select: {
              id: true,
              objectKey: true,
              uploaderUserId: true,
              shopId: true,
              purpose: true,
            },
          }),
          tx.product.findMany({
            where: { id: { in: shopProducts.map((product) => product.id) } },
            select: { id: true, shopId: true, categoryId: true },
          }),
          tx.productVariant.findMany({
            where: {
              id: { in: shopProducts.map((product) => product.variantId) },
            },
            select: {
              id: true,
              productId: true,
              shopId: true,
              skuNormalized: true,
            },
          }),
          tx.inventory.findMany({
            where: {
              variantId: {
                in: shopProducts.map((product) => product.variantId),
              },
            },
            select: { variantId: true, shopId: true },
          }),
          tx.productImage.findMany({
            where: {
              productId: { in: shopProducts.map((product) => product.id) },
            },
            select: { productId: true, assetId: true, position: true },
          }),
        ]);
      if (
        [assets, products, variants, inventories, images].some(
          (rows) => rows.length !== shopProducts.length,
        )
      ) {
        throw new Error(
          `Demo catalog batch did not persist all rows for ${shop.key}.`,
        );
      }
      for (const product of shopProducts) {
        const asset = assets.find((row) => row.id === product.imageAssetId);
        const storedProduct = products.find((row) => row.id === product.id);
        const variant = variants.find((row) => row.id === product.variantId);
        const inventory = inventories.find(
          (row) => row.variantId === product.variantId,
        );
        const image = images.find((row) => row.productId === product.id);
        const categoryId = plan.categories.find(
          (category) => category.key === product.categoryKey,
        )!.id;
        if (
          !asset ||
          asset.objectKey !== product.imageObjectKey ||
          asset.uploaderUserId !== owner.id ||
          asset.shopId !== shop.id ||
          asset.purpose !== "PRODUCT_IMAGE" ||
          !storedProduct ||
          storedProduct.shopId !== shop.id ||
          storedProduct.categoryId !== categoryId ||
          !variant ||
          variant.productId !== product.id ||
          variant.shopId !== shop.id ||
          variant.skuNormalized !== product.sku ||
          !inventory ||
          inventory.shopId !== shop.id ||
          !image ||
          image.assetId !== product.imageAssetId ||
          image.position !== 0
        ) {
          failConflict("demo catalog relationship", product.key);
        }
      }
    },
    { timeout: 30_000 },
  );
}

async function applyOrderInventoryMovement(
  tx: Prisma.TransactionClient,
  input: {
    fixture: DemoOrderFixture;
    variantId: string;
    shopId: string;
    actorUserId: string | null;
    delta: number;
    kind: "SALE" | "CANCEL_RETURN";
    effectType: "SALE" | "RESTORE";
    reason: string;
  },
): Promise<void> {
  const suffix = input.kind === "SALE" ? "sale" : "cancel-return";
  const operationKey = `demo:inventory:${input.fixture.key}:${input.variantId}:${suffix}`;
  const movementId = demoStableId("inventory-movement", operationKey);
  const existing = await tx.inventoryMovement.findUnique({
    where: { operationKey },
  });
  if (existing) {
    requireMatchingId(
      existing.id,
      movementId,
      "inventory movement",
      operationKey,
    );
    if (
      existing.inventoryId !== input.variantId ||
      existing.orderItemId !== input.fixture.orderItemId ||
      existing.effectType !== input.effectType
    ) {
      failConflict("inventory movement relationship", operationKey);
    }
    return;
  }

  const inventory = await tx.inventory.findUniqueOrThrow({
    where: { variantId: input.variantId },
  });
  const quantityAfter = inventory.availableQuantity + input.delta;
  if (quantityAfter < 0) {
    throw new Error(
      `Demo order movement would make stock negative for ${input.variantId}.`,
    );
  }
  await tx.inventory.update({
    where: { variantId: input.variantId },
    data: { availableQuantity: quantityAfter },
  });
  await tx.inventoryMovement.create({
    data: {
      id: movementId,
      inventoryId: input.variantId,
      sellerOrderId: input.fixture.sellerOrderId,
      orderItemId: input.fixture.orderItemId,
      actorUserId: input.actorUserId,
      shopId: input.shopId,
      kind: input.kind,
      effectType: input.effectType,
      quantityDelta: input.delta,
      quantityAfter,
      reason: input.reason,
      operationKey,
      createdAt: FIXTURE_CREATED_AT,
    },
  });
}

async function skipExistingOrderFixture(
  tx: Prisma.TransactionClient,
  fixture: DemoOrderFixture,
): Promise<boolean> {
  const existingOrder = await tx.marketplaceOrder.findUnique({
    where: { id: fixture.id },
  });
  if (!existingOrder) return false;
  requireMatchingId(
    existingOrder.id,
    fixture.id,
    "demo order",
    fixture.publicNumber,
  );
  if (existingOrder.publicNumber !== fixture.publicNumber) {
    failConflict("demo order public number", fixture.publicNumber);
  }

  const [sellerOrder, orderItem, payment, orderEvent] = await Promise.all([
    tx.sellerOrder.findUnique({ where: { id: fixture.sellerOrderId } }),
    tx.orderItem.findUnique({ where: { id: fixture.orderItemId } }),
    tx.payment.findUnique({ where: { id: fixture.paymentId } }),
    tx.orderEvent.findUnique({ where: { id: fixture.orderEventId } }),
  ]);
  if (!sellerOrder || !orderItem || !payment || !orderEvent) {
    throw new Error(
      `Existing demo transaction graph is incomplete for ${fixture.publicNumber}.`,
    );
  }
  const optionalChildren = await Promise.all([
    fixture.paymentAttemptId
      ? tx.paymentAttempt.findUnique({
          where: { id: fixture.paymentAttemptId },
        })
      : Promise.resolve(true),
    fixture.paymentEventId
      ? tx.paymentEvent.findUnique({ where: { id: fixture.paymentEventId } })
      : Promise.resolve(true),
    fixture.allocationId
      ? tx.paymentAllocation.findUnique({ where: { id: fixture.allocationId } })
      : Promise.resolve(true),
    fixture.refundId
      ? tx.simulatedRefund.findUnique({ where: { id: fixture.refundId } })
      : Promise.resolve(true),
    fixture.shipmentId
      ? tx.shipment.findUnique({ where: { id: fixture.shipmentId } })
      : Promise.resolve(true),
    fixture.shipmentEventId
      ? tx.shipmentEvent.findUnique({ where: { id: fixture.shipmentEventId } })
      : Promise.resolve(true),
  ]);
  if (optionalChildren.some((child) => child === null)) {
    throw new Error(
      `Existing demo transaction graph is incomplete for ${fixture.publicNumber}.`,
    );
  }
  return true;
}

async function seedOrderFixture(
  prisma: PrismaClient,
  plan: DemoFixturePlan,
  fixture: DemoOrderFixture,
): Promise<void> {
  const buyer = plan.users.find((user) => user.key === "buyer-active")!;
  const shop = plan.shops[0]!;
  const seller = plan.users.find((user) => user.key === shop.ownerKey)!;
  const product = plan.products[0]!;
  const orderDate = FIXTURE_CREATED_AT;
  const paymentDeadline =
    fixture.paymentMethod === "MOCK" ? MOCK_PAYMENT_DEADLINE : null;

  await prisma.$transaction(async (tx) => {
    if (await skipExistingOrderFixture(tx, fixture)) return;

    await tx.marketplaceOrder.create({
      data: {
        id: fixture.id,
        buyerUserId: buyer.id,
        publicNumber: fixture.publicNumber,
        recipientSnapshot: {
          recipientName: buyer.displayName,
          phone: "0901234567",
          line1: "1 Demo Street",
          ward: "Demo Ward",
          district: "Demo District",
          province: "Ho Chi Minh City",
          country: "VN",
        },
        paymentMethod: fixture.paymentMethod,
        originalTotal: ORDER_AMOUNT,
        shippingTotal: "0",
        paymentDeadline,
        status: "PENDING",
        createdAt: orderDate,
      },
    });
    await tx.sellerOrder.create({
      data: {
        id: fixture.sellerOrderId,
        orderId: fixture.id,
        shopId: shop.id,
        shopNameSnapshot: shop.name,
        status: "PENDING",
        originalTotal: ORDER_AMOUNT,
        createdAt: orderDate,
      },
    });
    await tx.orderItem.create({
      data: {
        id: fixture.orderItemId,
        sellerOrderId: fixture.sellerOrderId,
        shopId: shop.id,
        productId: product.id,
        variantId: product.variantId,
        productNameSnapshot: product.name,
        skuSnapshot: product.sku,
        attributesSnapshot: {},
        imageAssetId: product.imageAssetId,
        imageKeySnapshot: product.imageObjectKey,
        unitPrice: ORDER_AMOUNT,
        quantity: 1,
        lineTotal: ORDER_AMOUNT,
        createdAt: orderDate,
      },
    });
    await tx.payment.create({
      data: {
        id: fixture.paymentId,
        orderId: fixture.id,
        method: fixture.paymentMethod,
        currency: "VND",
      },
    });

    const settledAt =
      fixture.paymentAttemptId && fixture.key !== "expired-mock"
        ? PAYMENT_SETTLED_AT
        : null;
    if (fixture.paymentAttemptId) {
      const attemptStatus =
        fixture.key === "expired-mock" ? "CANCELLED" : "SUCCEEDED";
      const provider =
        fixture.paymentMethod === "MOCK" ? "MOCK" : "COD_SIMULATION";
      await tx.paymentAttempt.create({
        data: {
          id: fixture.paymentAttemptId,
          paymentId: fixture.paymentId,
          attemptNumber: 1,
          provider,
          settlementKind: "NORMAL",
          status: attemptStatus,
          targetSellerOrdersSnapshot: buildTargetSellerOrdersSnapshot({
            mode: "NEW",
            orderId: fixture.id,
            amount: ORDER_AMOUNT,
            sellerOrders: [
              {
                id: fixture.sellerOrderId,
                orderId: fixture.id,
                status: "PENDING",
              },
            ],
            snapshot: [
              { sellerOrderId: fixture.sellerOrderId, amount: ORDER_AMOUNT },
            ],
          }),
          amount: ORDER_AMOUNT,
          externalTransactionId:
            attemptStatus === "SUCCEEDED"
              ? `demo-transaction-${fixture.key}`
              : null,
          expiresAt:
            fixture.paymentMethod === "MOCK" ? MOCK_PAYMENT_DEADLINE : null,
          settledAt,
          operationKey: `demo:payment-attempt:${fixture.key}`,
          createdAt: orderDate,
        },
      });
      await tx.payment.update({
        where: { id: fixture.paymentId },
        data: { version: { increment: 1 } },
      });

      const observedStatus =
        fixture.key === "expired-mock" ? "CANCELLED" : "SUCCEEDED";
      await tx.paymentEvent.create({
        data: {
          id: fixture.paymentEventId!,
          paymentId: fixture.paymentId,
          attemptId: fixture.paymentAttemptId,
          provider,
          externalEventId: `demo-payment-event-${fixture.key}`,
          payloadDigest: createHash("sha256")
            .update(`demo-payment-event:${fixture.key}:${observedStatus}`)
            .digest("hex"),
          observedStatus,
          processingResult:
            fixture.key === "refunded-mock" ? "REFUNDED" : "APPLIED",
          receivedAt: settledAt ?? MOCK_PAYMENT_DEADLINE,
        },
      });
    }

    await applyOrderInventoryMovement(tx, {
      fixture,
      variantId: product.variantId,
      shopId: shop.id,
      actorUserId: buyer.id,
      delta: -1,
      kind: "SALE",
      effectType: "SALE",
      reason: "Reserve one unit for demo order.",
    });

    if (fixture.allocationId) {
      await tx.paymentAllocation.create({
        data: {
          id: fixture.allocationId,
          attemptId: fixture.paymentAttemptId!,
          sellerOrderId: fixture.sellerOrderId,
          amount: ORDER_AMOUNT,
          kind:
            fixture.paymentMethod === "MOCK"
              ? "MOCK_PREPAYMENT"
              : "COD_COLLECTION",
          createdAt: settledAt ?? PAYMENT_SETTLED_AT,
        },
      });
    }
    if (fixture.refundId) {
      await tx.simulatedRefund.create({
        data: {
          id: fixture.refundId,
          allocationId: fixture.allocationId!,
          sellerOrderId: fixture.sellerOrderId,
          amount: ORDER_AMOUNT,
          reason: "CANCELLATION",
          operationKey: `demo:refund:${fixture.key}`,
          createdAt: ORDER_CANCELLED_AT,
        },
      });
    }

    if (fixture.expectedOrderStatus === "CANCELLED") {
      await applyOrderInventoryMovement(tx, {
        fixture,
        variantId: product.variantId,
        shopId: shop.id,
        actorUserId: null,
        delta: 1,
        kind: "CANCEL_RETURN",
        effectType: "RESTORE",
        reason: "Restore stock for cancelled demo order.",
      });
      await tx.sellerOrder.update({
        where: { id: fixture.sellerOrderId },
        data: {
          status: "CANCELLED",
          cancelledAt: ORDER_CANCELLED_AT,
          cancellationReason: "Deterministic demo cancellation fixture.",
          stockReturnedAt: ORDER_CANCELLED_AT,
          version: { increment: 1 },
        },
      });
      await tx.marketplaceOrder.update({
        where: { id: fixture.id },
        data: { status: "CANCELLED", version: { increment: 1 } },
      });
    } else if (fixture.expectedOrderStatus === "COMPLETED") {
      await tx.sellerOrder.update({
        where: { id: fixture.sellerOrderId },
        data: {
          status: "COMPLETED",
          completedAt: ORDER_COMPLETED_AT,
          version: { increment: 1 },
        },
      });
      await tx.marketplaceOrder.update({
        where: { id: fixture.id },
        data: { status: "COMPLETED", version: { increment: 1 } },
      });
      await tx.shipment.create({
        data: {
          id: fixture.shipmentId!,
          sellerOrderId: fixture.sellerOrderId,
          trackingCode: `DEMO-TRACK-${fixture.publicNumber}`,
          status: "DELIVERED",
          deliveryAttempt: 1,
          deliveredAt: ORDER_COMPLETED_AT,
          createdAt: ORDER_CREATED_AT,
        },
      });
      await tx.shipmentEvent.create({
        data: {
          id: fixture.shipmentEventId!,
          shipmentId: fixture.shipmentId!,
          actorUserId: seller.id,
          fromStatus: "IN_TRANSIT",
          toStatus: "DELIVERED",
          deliveryAttempt: 1,
          reason: "Deterministic demo delivery fixture.",
          operationKey: `demo:shipment:${fixture.key}:delivered`,
          createdAt: ORDER_COMPLETED_AT,
        },
      });
    }

    await tx.orderEvent.create({
      data: {
        id: fixture.orderEventId,
        orderId: fixture.id,
        sellerOrderId: fixture.sellerOrderId,
        actorUserId:
          fixture.expectedOrderStatus === "COMPLETED" ? seller.id : null,
        actorKind:
          fixture.expectedOrderStatus === "COMPLETED" ? "USER" : "SYSTEM",
        action: "DEMO_FIXTURE_STATE",
        fromStatus:
          fixture.expectedOrderStatus === "PENDING" ? null : "PENDING",
        toStatus: fixture.expectedOrderStatus,
        reason: "Deterministic demo seed fixture.",
        operationKey: `demo:order:${fixture.key}:status`,
        createdAt:
          fixture.expectedOrderStatus === "CANCELLED"
            ? ORDER_CANCELLED_AT
            : fixture.expectedOrderStatus === "COMPLETED"
              ? ORDER_COMPLETED_AT
              : orderDate,
      },
    });
  });
}

const ORDER_CREATED_AT = FIXTURE_CREATED_AT;

export async function seedDemoDatabase(
  prisma: PrismaClient,
  passwords: DemoSeedPasswords,
): Promise<void> {
  const plan = buildDemoFixturePlan();
  await seedUsers(prisma, plan, passwords);
  await seedCategories(prisma, plan);

  for (const shop of plan.shops) {
    const owner = plan.users.find((user) => user.key === shop.ownerKey)!;
    await seedShop(prisma, shop, owner.id);
    await seedCatalogShop(prisma, plan, shop);
  }

  for (const order of plan.orders) {
    await seedOrderFixture(prisma, plan, order);
  }
}
