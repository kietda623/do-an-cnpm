import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { readDemoSeedConfig } from "./demo-seed-config.ts";
import { seedDemoDatabase } from "./demo-seed.ts";

dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });
const config = readDemoSeedConfig(process.env);
const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
});

try {
  await seedDemoDatabase(prisma, config.passwords);
  console.info(
    "Seeded deterministic demo data: 10 shops, 1,000 products, and four order fixtures.",
  );
} finally {
  await prisma.$disconnect();
}
