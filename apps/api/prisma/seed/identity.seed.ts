import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required to seed identity accounts.");

const pool = new Pool({ connectionString, max: 2 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });

async function seedAccount(kind: "ADMIN" | "BUYER"): Promise<void> {
  const prefix = `IDENTITY_${kind}`;
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  const fullName =
    process.env[`${prefix}_FULL_NAME`]?.trim() ||
    (kind === "ADMIN" ? "Marketplace Admin" : "Demo Buyer");
  if (!email || !password)
    throw new Error(
      `${prefix}_EMAIL and ${prefix}_PASSWORD must be set; seed secrets are never committed.`,
    );
  if (password.length < 12 || password.length > 128)
    throw new Error(`${prefix}_PASSWORD must contain 12 to 128 characters.`);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { emailNormalized: email },
    create: {
      emailNormalized: email,
      passwordHash,
      displayName: fullName,
      systemRole: kind,
      status: "ACTIVE",
    },
    update: {
      passwordHash,
      displayName: fullName,
      systemRole: kind,
      status: "ACTIVE",
      authVersion: { increment: 1 },
    },
  });
  console.info(`Seeded ${kind} account ${email}.`);
}

try {
  await seedAccount("ADMIN");
  await seedAccount("BUYER");
} finally {
  await prisma.$disconnect();
}
