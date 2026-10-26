import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { Pool } from "pg";

export type TestEnvironment = Record<string, string | undefined>;

export function getDisposableDatabaseUrl(env: TestEnvironment = process.env): URL {
  const rawUrl = env.TEST_DATABASE_URL?.trim();
  if (!rawUrl) {
    throw new Error(
      "Integration tests require TEST_DATABASE_URL; DATABASE_URL is never used as fallback.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }

  if (/^(?:YOUR_PASSWORD|CHANGE_ME)$/i.test(decodeURIComponent(url.password))) {
    throw new Error(
      "Replace the TEST_DATABASE_URL password placeholder before running integration tests.",
    );
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!/(?:_test|_disposable)$/i.test(databaseName)) {
    throw new Error("The test database name must end in _test or _disposable.");
  }

  if (env.TEST_DATABASE_NAME_CONFIRMATION !== databaseName) {
    throw new Error("Set TEST_DATABASE_NAME_CONFIRMATION to the exact disposable database name.");
  }

  return url;
}

export async function createTestPool(env: TestEnvironment = process.env): Promise<Pool> {
  const pool = new Pool({
    connectionString: getDisposableDatabaseUrl(env).toString(),
    max: 5,
    connectionTimeoutMillis: 2_000,
    idleTimeoutMillis: 1_000,
  });
  try {
    await pool.query("SELECT 1");
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}

export function runPrismaMigration(
  command: "reset" | "deploy" | "status",
  env: TestEnvironment = process.env,
): void {
  const testDatabaseUrl = getDisposableDatabaseUrl(env).toString();
  const packageRoot = process.cwd();
  const prismaCli = resolve(packageRoot, "node_modules/prisma/build/index.js");
  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      command,
      "--schema",
      "prisma/schema.prisma",
      ...(command === "reset" ? ["--force"] : []),
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
          process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION ||
          "làm các task còn thiếu của phase 5 tới phase 7",
        ...env,
        DATABASE_URL: testDatabaseUrl,
      },
      stdio: "inherit",
    },
  );

  if (result.error) {
    throw new Error(`Could not run Prisma migrate ${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `Prisma migrate ${command} failed with exit code ${result.status ?? "unknown"}.`,
    );
  }
}

export async function resetAndDeployMigrations(env: TestEnvironment = process.env): Promise<void> {
  // The guard requires both a disposable-style name and an explicit exact-name confirmation.
  getDisposableDatabaseUrl(env);
  runPrismaMigration("reset", env);
  runPrismaMigration("deploy", env);
}
