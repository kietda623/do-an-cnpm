import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { Pool } from "pg";
dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });
const url = process.env.TEST_DATABASE_URL?.trim();
if (!url)
  throw new Error("TEST_DATABASE_URL is required for catalog fixtures.");
const dbName = decodeURIComponent(new URL(url).pathname.slice(1));
if (
  !/(?:_test|_disposable)$/i.test(dbName) ||
  process.env.TEST_DATABASE_NAME_CONFIRMATION !== dbName
)
  throw new Error(
    "Catalog fixtures are restricted to the confirmed disposable database.",
  );
const ownerEmail = process.env.IDENTITY_BUYER_EMAIL?.trim().toLowerCase();
if (!ownerEmail)
  throw new Error("Seed the identity buyer before catalog fixtures.");
const pool = new Pool({ connectionString: url, max: 2 });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
});
try {
  const owner = await prisma.user.findUnique({
    where: { emailNormalized: ownerEmail },
  });
  const shop = await prisma.shop.findUnique({
    where: { slugNormalized: "demo-active" },
  });
  if (
    !owner ||
    !shop ||
    shop.ownerUserId !== owner.id ||
    shop.status !== "ACTIVE"
  )
    throw new Error("Run identity and active shop seed first.");
  const visible = await prisma.category.upsert({
    where: { slug: "demo-catalog-visible" },
    create: {
      name: "Demo Catalog",
      slug: "demo-catalog-visible",
      status: "VISIBLE",
    },
    update: { status: "VISIBLE" },
  });
  const hidden = await prisma.category.upsert({
    where: { slug: "demo-catalog-hidden" },
    create: {
      name: "Demo Hidden Category",
      slug: "demo-catalog-hidden",
      status: "HIDDEN",
    },
    update: { status: "HIDDEN" },
  });
  const image = await prisma.asset.upsert({
    where: { objectKey: "seed/catalog/product-demo.png" },
    create: {
      uploaderUserId: owner.id,
      shopId: shop.id,
      purpose: "PRODUCT_IMAGE",
      objectKey: "seed/catalog/product-demo.png",
      mimeType: "image/png",
      byteSize: 68,
      width: 1,
      height: 1,
      status: "VERIFIED",
      attachedAt: new Date(),
    },
    update: {
      uploaderUserId: owner.id,
      shopId: shop.id,
      status: "VERIFIED",
      purpose: "PRODUCT_IMAGE",
    },
  });
  const product =
    (await prisma.product.findFirst({
      where: { shopId: shop.id, name: "Demo stopped catalog product" },
    })) ??
    (await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: visible.id,
        name: "Demo stopped catalog product",
        description: "Fixture with stock 0, 1 and 5.",
        saleStatus: "DISCONTINUED",
        images: { create: { assetId: image.id, position: 0 } },
      },
    }));
  for (const [suffix, stock] of [
    ["ZERO", 0],
    ["ONE", 1],
    ["FIVE", 5],
  ] as const) {
    const sku = `DEMO-${suffix}`;
    const variant = await prisma.productVariant.upsert({
      where: { shopId_skuNormalized: { shopId: shop.id, skuNormalized: sku } },
      create: {
        productId: product.id,
        shopId: shop.id,
        skuNormalized: sku,
        attributes: { stock: suffix },
        attributesKey: JSON.stringify({ stock: suffix }),
        price: "25000",
        saleStatus: "ACTIVE",
      },
      update: {
        productId: product.id,
        attributes: { stock: suffix },
        attributesKey: JSON.stringify({ stock: suffix }),
        price: "25000",
        saleStatus: "ACTIVE",
      },
    });
    await prisma.inventory.upsert({
      where: { variantId: variant.id },
      create: {
        variantId: variant.id,
        shopId: shop.id,
        availableQuantity: stock,
      },
      update: { availableQuantity: stock },
    });
    if (stock > 0) {
      const key = `seed-initial:${variant.id}`;
      if (
        !(await prisma.inventoryMovement.findUnique({
          where: { operationKey: key },
        }))
      )
        await prisma.inventoryMovement.create({
          data: {
            inventoryId: variant.id,
            shopId: shop.id,
            actorUserId: owner.id,
            kind: "INITIAL",
            quantityDelta: stock,
            quantityAfter: stock,
            reason: "Demo fixture stock",
            operationKey: key,
          },
        });
    }
  }
  console.info(
    `Seeded catalog fixtures for ${shop.slugNormalized}: categories ${visible.slug}/${hidden.slug}; stopped product ${product.id}; variant stocks 0, 1 and 5.`,
  );
} finally {
  await prisma.$disconnect();
}
