import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || /(?:CHANGE_ME|YOUR_PASSWORD)/i.test(databaseUrl)) {
  console.error("Set a real DATABASE_URL before running Prisma migrations.");
  process.exit(2);
}

if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  console.error("DATABASE_URL must use the PostgreSQL connection URL format.");
  process.exit(2);
}

const [command] = process.argv.slice(2);
if (!command || !["dev", "deploy", "status"].includes(command)) {
  console.error("Usage: prisma:migrate:<dev|deploy|status>");
  process.exit(2);
}

const result = spawnSync("prisma", ["migrate", command, "--schema", "prisma/schema.prisma"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`Could not start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
