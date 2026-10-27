import { resolve } from "node:path";
import dotenv from "dotenv";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });
const rawUrl = process.env.TEST_DATABASE_URL?.trim();
if (!rawUrl)
  throw new Error("Set TEST_DATABASE_URL for US8 disposable fixtures.");
const url = new URL(rawUrl);
const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
if (
  !["postgres:", "postgresql:"].includes(url.protocol) ||
  !/(?:_test|_disposable)$/i.test(name) ||
  process.env.TEST_DATABASE_NAME_CONFIRMATION !== name
)
  throw new Error(
    "US8 seed requires an explicitly confirmed disposable PostgreSQL database.",
  );
const existingOptions = url.searchParams.getAll("options").join(" ");
url.searchParams.set("options", `${existingOptions} -c timezone=UTC`.trim());
const pool = new Pool({ connectionString: url.toString(), max: 2 });
const db = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
});
const ids = {
  product: "88888888-8888-4888-8888-000000000001",
  variant: "88888888-8888-4888-8888-000000000002",
  orders: [
    "88888888-8888-4888-8888-000000000011",
    "88888888-8888-4888-8888-000000000012",
    "88888888-8888-4888-8888-000000000013",
  ],
  parts: [
    "88888888-8888-4888-8888-000000000021",
    "88888888-8888-4888-8888-000000000022",
    "88888888-8888-4888-8888-000000000023",
  ],
  items: [
    "88888888-8888-4888-8888-000000000031",
    "88888888-8888-4888-8888-000000000032",
    "88888888-8888-4888-8888-000000000033",
  ],
  payment: "88888888-8888-4888-8888-000000000041",
  attempt: "88888888-8888-4888-8888-000000000042",
  allocation: "88888888-8888-4888-8888-000000000043",
  refund: "88888888-8888-4888-8888-000000000044",
};
try {
  const passwordHash = await argon2.hash("Disposable US8 fixture only 2026!", {
    type: argon2.argon2id,
  });
  await db.$transaction(
    async (tx) => {
      const buyer = await tx.user.upsert({
        where: { emailNormalized: "us8-seed-buyer@example.test" },
        update: {},
        create: {
          emailNormalized: "us8-seed-buyer@example.test",
          passwordHash,
          displayName: "US8 Buyer",
        },
      });
      const seller = await tx.user.upsert({
        where: { emailNormalized: "us8-seed-seller@example.test" },
        update: {},
        create: {
          emailNormalized: "us8-seed-seller@example.test",
          passwordHash,
          displayName: "US8 Seller",
        },
      });
      const logo = await tx.asset.upsert({
        where: { objectKey: "seed/us8/shop.png" },
        update: {},
        create: {
          uploaderUserId: seller.id,
          purpose: "SHOP_LOGO",
          objectKey: "seed/us8/shop.png",
          mimeType: "image/png",
          byteSize: 64,
          width: 1,
          height: 1,
          status: "VERIFIED",
        },
      });
      const shop = await tx.shop.upsert({
        where: { slugNormalized: "us8-statistics-seed" },
        update: {},
        create: {
          ownerUserId: seller.id,
          name: "US8 statistics fixture",
          slugNormalized: "us8-statistics-seed",
          description: "Disposable review and reporting fixture",
          logoAssetId: logo.id,
          contactAddress: "1 Fixture Road",
          phone: "0901234567",
          status: "ACTIVE",
          approvedAt: new Date("2026-01-01T00:00:00Z"),
        },
      });
      await tx.shopMember.upsert({
        where: { shopId_userId: { shopId: shop.id, userId: seller.id } },
        update: {},
        create: {
          shopId: shop.id,
          userId: seller.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
      const category = await tx.category.upsert({
        where: { slug: "us8-statistics-seed" },
        update: {},
        create: {
          slug: "us8-statistics-seed",
          name: "US8 fixture category",
          status: "VISIBLE",
        },
      });
      const product = await tx.product.upsert({
        where: { id: ids.product },
        update: {},
        create: {
          id: ids.product,
          shopId: shop.id,
          categoryId: category.id,
          name: "US8 fixture product",
          description: "Disposable review fixture product",
          saleStatus: "ACTIVE",
        },
      });
      const variant = await tx.productVariant.upsert({
        where: { id: ids.variant },
        update: {},
        create: {
          id: ids.variant,
          productId: product.id,
          shopId: shop.id,
          skuNormalized: "US8-STATISTICS-SEED",
          attributes: {},
          attributesKey: "{}",
          price: "101",
          saleStatus: "ACTIVE",
          inventory: { create: { availableQuantity: 5 } },
        },
      });
      const fixtures = [
        {
          amount: "101",
          status: "COMPLETED" as const,
          completedAt: new Date("2026-10-26T16:59:59Z"),
        },
        {
          amount: "202",
          status: "COMPLETED" as const,
          completedAt: new Date("2026-10-26T17:00:00Z"),
        },
        { amount: "999", status: "CANCELLED" as const, completedAt: null },
      ];
      for (const [index, fixture] of fixtures.entries()) {
        const createdAt = new Date("2026-10-26T15:00:00Z");
        await tx.marketplaceOrder.upsert({
          where: { id: ids.orders[index]! },
          update: {},
          create: {
            id: ids.orders[index]!,
            buyerUserId: buyer.id,
            publicNumber: `US8-SEED-${fixture.amount}`,
            recipientSnapshot: {
              recipientName: "US8 Buyer",
              phone: "0901234567",
              line1: "1 Fixture Road",
              ward: "Ward",
              district: "District",
              province: "HCMC",
              country: "VN",
            },
            paymentMethod: "MOCK",
            paymentDeadline: new Date("2026-10-26T15:15:00Z"),
            originalTotal: fixture.amount,
            status: fixture.status,
            createdAt,
          },
        });
        await tx.sellerOrder.upsert({
          where: { id: ids.parts[index]! },
          update: {},
          create: {
            id: ids.parts[index]!,
            orderId: ids.orders[index]!,
            shopId: shop.id,
            shopNameSnapshot: shop.name,
            status: fixture.status,
            originalTotal: fixture.amount,
            completedAt: fixture.completedAt,
            ...(fixture.status === "CANCELLED"
              ? {
                  cancelledAt: new Date("2026-10-26T17:00:00Z"),
                  cancellationReason: "Cancelled fixture",
                }
              : {}),
          },
        });
        await tx.orderItem.upsert({
          where: { id: ids.items[index]! },
          update: {},
          create: {
            id: ids.items[index]!,
            sellerOrderId: ids.parts[index]!,
            shopId: shop.id,
            productId: product.id,
            variantId: variant.id,
            productNameSnapshot: product.name,
            skuSnapshot: variant.skuNormalized,
            attributesSnapshot: {},
            unitPrice: fixture.amount,
            quantity: 1,
            lineTotal: fixture.amount,
          },
        });
      }
      await tx.review.upsert({
        where: { orderItemId: ids.items[0]! },
        update: {},
        create: {
          buyerUserId: buyer.id,
          orderItemId: ids.items[0]!,
          productId: product.id,
          rating: 5,
          comment: "Disposable seed review",
        },
      });
      await tx.payment.upsert({
        where: { id: ids.payment },
        update: {},
        create: { id: ids.payment, orderId: ids.orders[2]!, method: "MOCK" },
      });
      await tx.paymentAttempt.upsert({
        where: { id: ids.attempt },
        update: {},
        create: {
          id: ids.attempt,
          paymentId: ids.payment,
          attemptNumber: 1,
          provider: "MOCK",
          status: "SUCCEEDED",
          targetSellerOrdersSnapshot: [
            { sellerOrderId: ids.parts[2]!, amount: "999" },
          ],
          amount: "999",
          operationKey: "seed-us8-attempt",
        },
      });
      await tx.paymentAllocation.upsert({
        where: { id: ids.allocation },
        update: {},
        create: {
          id: ids.allocation,
          attemptId: ids.attempt,
          sellerOrderId: ids.parts[2]!,
          amount: "999",
          kind: "MOCK_PREPAYMENT",
        },
      });
      await tx.simulatedRefund.upsert({
        where: { id: ids.refund },
        update: {},
        create: {
          id: ids.refund,
          allocationId: ids.allocation,
          sellerOrderId: ids.parts[2]!,
          amount: "999",
          reason: "CANCELLATION",
          operationKey: "seed-us8-refund",
        },
      });
    },
    { timeout: 20_000 },
  );
  console.info(
    "Seeded US8 disposable fixtures: completed VND 101 + 202, cancelled/refunded VND 999, and one review.",
  );
} finally {
  await db.$disconnect();
}
