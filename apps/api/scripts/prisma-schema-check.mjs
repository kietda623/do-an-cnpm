import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });

const rawUrl = process.env.TEST_DATABASE_URL?.trim();
if (!rawUrl) {
  throw new Error("Schema diff requires TEST_DATABASE_URL; DATABASE_URL is never a fallback.");
}

let testUrl;
try {
  testUrl = new URL(rawUrl);
} catch {
  throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
}

if (testUrl.protocol !== "postgres:" && testUrl.protocol !== "postgresql:") {
  throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
}

if (/^(?:YOUR_PASSWORD|CHANGE_ME)$/i.test(decodeURIComponent(testUrl.password))) {
  throw new Error("Replace the TEST_DATABASE_URL password placeholder before the schema diff.");
}

const databaseName = decodeURIComponent(testUrl.pathname.replace(/^\//, ""));
if (!/(?:_test|_disposable)$/i.test(databaseName)) {
  throw new Error("The schema diff database name must end in _test or _disposable.");
}

if (process.env.TEST_DATABASE_NAME_CONFIRMATION !== databaseName) {
  throw new Error("Set TEST_DATABASE_NAME_CONFIRMATION to the exact disposable database name.");
}

const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
const result = spawnSync(
  process.execPath,
  [
    prismaCli,
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--exit-code",
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
