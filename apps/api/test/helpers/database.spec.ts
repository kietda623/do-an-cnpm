import { describe, expect, it } from "@jest/globals";
import { getDisposableDatabaseUrl } from "./database.js";

describe("disposable database URL guard", () => {
  const disposable = "postgresql://test:dummy@127.0.0.1:5432/marketplace_test?schema=public";

  it("requires a dedicated TEST_DATABASE_URL instead of falling back to DATABASE_URL", () => {
    expect(() => getDisposableDatabaseUrl({ DATABASE_URL: "postgresql://localhost/cnpm" })).toThrow(
      "TEST_DATABASE_URL",
    );
  });

  it("rejects application database names even when explicitly provided", () => {
    expect(() =>
      getDisposableDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://localhost:5432/cnpm",
        TEST_DATABASE_NAME_CONFIRMATION: "cnpm",
      }),
    ).toThrow("end in _test or _disposable");
  });

  it("requires confirmation to exactly match the disposable database name", () => {
    expect(() =>
      getDisposableDatabaseUrl({
        TEST_DATABASE_URL: disposable,
        TEST_DATABASE_NAME_CONFIRMATION: "marketplace_test_typo",
      }),
    ).toThrow("exact disposable database name");
  });

  it("rejects the example password placeholder before attempting a connection", () => {
    expect(() =>
      getDisposableDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://test:YOUR_PASSWORD@127.0.0.1:5432/marketplace_test",
        TEST_DATABASE_NAME_CONFIRMATION: "marketplace_test",
      }),
    ).toThrow("Replace the TEST_DATABASE_URL password placeholder");
  });

  it("accepts a specifically confirmed disposable database URL", () => {
    const parsed = getDisposableDatabaseUrl({
      TEST_DATABASE_URL: disposable,
      TEST_DATABASE_NAME_CONFIRMATION: "marketplace_test",
    });

    expect(parsed.pathname).toBe("/marketplace_test");
    expect(parsed.searchParams.get("schema")).toBe("public");
  });
});
