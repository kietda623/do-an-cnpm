import { describe, expect, it } from "@jest/globals";
import { readDemoSeedConfig } from "../prisma/seed/demo-seed-config.ts";

const credentials = {
  DEMO_SELLER_PASSWORD: "seller-bootstrap-password-01",
  DEMO_BUYER_PASSWORD: "buyer-bootstrap-password-01",
  DEMO_LOCKED_BUYER_PASSWORD: "locked-bootstrap-password-01",
};

function validEnv(): Record<string, string | undefined> {
  return {
    TEST_DATABASE_URL: "postgresql://demo:local@127.0.0.1:55439/marketplace_demo_disposable",
    TEST_DATABASE_NAME_CONFIRMATION: "marketplace_demo_disposable",
    ...credentials,
  };
}

describe("demo seed configuration", () => {
  it("accepts an explicitly confirmed PostgreSQL disposable database and bootstrap passwords", () => {
    expect(readDemoSeedConfig(validEnv())).toEqual({
      databaseUrl:
        "postgresql://demo:local@127.0.0.1:55439/marketplace_demo_disposable",
      databaseName: "marketplace_demo_disposable",
      passwords: {
        sellerPassword: credentials.DEMO_SELLER_PASSWORD,
        buyerPassword: credentials.DEMO_BUYER_PASSWORD,
        lockedBuyerPassword: credentials.DEMO_LOCKED_BUYER_PASSWORD,
      },
    });
  });

  it("does not fall back to DATABASE_URL when TEST_DATABASE_URL is absent", () => {
    const env = validEnv();
    delete env.TEST_DATABASE_URL;
    env.DATABASE_URL = "postgresql://shared:secret@localhost/marketplace";

    expect(() => readDemoSeedConfig(env)).toThrow();
  });

  it.each([
    ["malformed URL", "not-a-url", "marketplace_demo_disposable"],
    ["non-PostgreSQL URL", "mysql://demo:local@localhost/marketplace_demo_disposable", "marketplace_demo_disposable"],
    ["unsafe database suffix", "postgresql://demo:local@localhost/marketplace", "marketplace"],
    ["mismatched confirmation", "postgresql://demo:local@localhost/marketplace_demo_disposable", "different_name"],
  ])("rejects %s before returning seed configuration", (_label, url, confirmation) => {
    const env = {
      ...validEnv(),
      TEST_DATABASE_URL: url,
      TEST_DATABASE_NAME_CONFIRMATION: confirmation,
    };

    expect(() => readDemoSeedConfig(env)).toThrow();
  });

  it.each([
    "DEMO_SELLER_PASSWORD",
    "DEMO_BUYER_PASSWORD",
    "DEMO_LOCKED_BUYER_PASSWORD",
  ])("requires %s", (variable) => {
    const env = validEnv();
    delete env[variable];

    expect(() => readDemoSeedConfig(env)).toThrow();
  });

  it("rejects a too-short password without echoing the supplied secret", () => {
    const secret = "too-short";
    const env = { ...validEnv(), DEMO_BUYER_PASSWORD: secret };

    let message = "";
    try {
      readDemoSeedConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(secret);
    expect(message).not.toContain("local");
  });

  it("does not echo database URL credentials on validation errors", () => {
    const databaseSecret = "database-password-secret";
    const env = {
      ...validEnv(),
      TEST_DATABASE_URL: `postgresql://demo:${databaseSecret}@127.0.0.1/marketplace_demo_disposable`,
      TEST_DATABASE_NAME_CONFIRMATION: "wrong_confirmation",
    };

    let message = "";
    try {
      readDemoSeedConfig(env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).not.toContain(databaseSecret);
    expect(message).not.toContain(credentials.DEMO_SELLER_PASSWORD);
  });

  it("rejects passwords longer than the 128-character policy", () => {
    const env = { ...validEnv(), DEMO_BUYER_PASSWORD: "p".repeat(129) };

    expect(() => readDemoSeedConfig(env)).toThrow();
  });
});
