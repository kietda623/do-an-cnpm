import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });
const testUrl = process.env.TEST_DATABASE_URL?.trim();
if (!testUrl)
  throw new Error("Set TEST_DATABASE_URL; shop fixtures are restricted to disposable databases.");
const parsed = new URL(testUrl);
const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
if (
  !/(?:_test|_disposable)$/i.test(dbName) ||
  process.env.TEST_DATABASE_NAME_CONFIRMATION !== dbName
) {
  throw new Error("Confirm the exact disposable TEST_DATABASE_URL database name before seeding.");
}
process.env.DATABASE_URL = testUrl;
const ownerEmail = process.env.IDENTITY_BUYER_EMAIL?.trim().toLowerCase();
if (!ownerEmail) throw new Error("Seed the identity buyer first by setting IDENTITY_BUYER_EMAIL.");

const pool = new Pool({ connectionString: testUrl, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
const fixtures = [
  { suffix: "pending", status: "PENDING" as const, reason: null, approvedAt: null },
  {
    suffix: "rejected",
    status: "REJECTED" as const,
    reason: "Please provide a clearer shop description.",
    approvedAt: null,
  },
  {
    suffix: "active",
    status: "ACTIVE" as const,
    reason: null,
    approvedAt: new Date("2026-01-01T00:00:00Z"),
  },
  {
    suffix: "suspended",
    status: "SUSPENDED" as const,
    reason: "Demo suspension for moderation testing.",
    approvedAt: new Date("2026-01-01T00:00:00Z"),
  },
];

try {
  const owner = await prisma.user.findUnique({ where: { emailNormalized: ownerEmail } });
  if (!owner)
    throw new Error(`No seeded buyer account found for ${ownerEmail}. Run seed:identity first.`);
  for (const fixture of fixtures) {
    const slug = `demo-${fixture.suffix}`;
    const asset = await prisma.asset.upsert({
      where: { objectKey: `seed/shops/${slug}.png` },
      create: {
        uploaderUserId: owner.id,
        purpose: "SHOP_LOGO",
        objectKey: `seed/shops/${slug}.png`,
        mimeType: "image/png",
        byteSize: 68,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
      update: { uploaderUserId: owner.id, status: "VERIFIED" },
    });
    const shop = await prisma.shop.upsert({
      where: { slugNormalized: slug },
      create: {
        ownerUserId: owner.id,
        name: `Demo ${fixture.suffix} shop`,
        slugNormalized: slug,
        description: `Seed fixture for the ${fixture.status.toLowerCase()} shop flow.`,
        logoAssetId: asset.id,
        contactAddress: "1 Demo Street, Ho Chi Minh City",
        phone: "0901234567",
        status: fixture.status,
        decisionReason: fixture.reason,
        approvedAt: fixture.approvedAt,
      },
      update: {
        ownerUserId: owner.id,
        name: `Demo ${fixture.suffix} shop`,
        logoAssetId: asset.id,
        status: fixture.status,
        decisionReason: fixture.reason,
        approvedAt: fixture.approvedAt,
      },
    });
    await prisma.shopMember.upsert({
      where: { shopId_userId: { shopId: shop.id, userId: owner.id } },
      create: { shopId: shop.id, userId: owner.id, role: "OWNER", status: "ACTIVE" },
      update: { role: "OWNER", status: "ACTIVE" },
    });
    await prisma.asset.update({
      where: { id: asset.id },
      data: { shopId: shop.id, attachedAt: new Date() },
    });
    console.info(`Seeded ${fixture.status} shop fixture ${slug}.`);
  }
} finally {
  await prisma.$disconnect();
}
