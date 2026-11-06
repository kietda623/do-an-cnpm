import type { DemoSeedPasswords } from "./demo-fixtures.js";

export type DemoSeedConfig = {
  databaseUrl: string;
  databaseName: string;
  passwords: DemoSeedPasswords;
};

const PASSWORD_KEYS = {
  sellerPassword: "DEMO_SELLER_PASSWORD",
  buyerPassword: "DEMO_BUYER_PASSWORD",
  lockedBuyerPassword: "DEMO_LOCKED_BUYER_PASSWORD",
} as const;

export function readDemoSeedConfig(
  env: Record<string, string | undefined>,
): DemoSeedConfig {
  const databaseUrl = env.TEST_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Set TEST_DATABASE_URL for the demo seed command.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ""));
  } catch {
    throw new Error("TEST_DATABASE_URL must contain a valid database name.");
  }
  if (!/(?:_test|_disposable)$/i.test(databaseName)) {
    throw new Error(
      "Demo seed database name must end in _test or _disposable.",
    );
  }
  if (env.TEST_DATABASE_NAME_CONFIRMATION !== databaseName) {
    throw new Error(
      "Confirm the exact disposable TEST_DATABASE_URL database name.",
    );
  }

  const passwords = Object.fromEntries(
    Object.entries(PASSWORD_KEYS).map(([field, variable]) => {
      const password = env[variable];
      if (!password) {
        throw new Error(
          `${variable} must be set; bootstrap secrets are never committed.`,
        );
      }
      if (password.length < 12 || password.length > 128) {
        throw new Error(`${variable} must contain 12 to 128 characters.`);
      }
      return [field, password];
    }),
  ) as DemoSeedPasswords;

  return { databaseUrl, databaseName, passwords };
}
