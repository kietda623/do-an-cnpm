import { resolve } from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Client generation and schema validation do not need a live database.
    // Migration scripts validate that DATABASE_URL is set before invoking Prisma.
    url: process.env.DATABASE_URL ?? "",
  },
});
