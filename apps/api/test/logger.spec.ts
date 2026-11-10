import { describe, expect, it, jest } from "@jest/globals";
import { StructuredLogger } from "../src/common/logging/logger.js";

describe("StructuredLogger security redaction", () => {
  it("removes credential and personal data from structured fields and text", () => {
    const write = jest
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const logger = new StructuredLogger();
    const correlationId = "11111111-1111-4111-8111-111111111111";

    logger.log({
      authorization: "Bearer header-secret",
      nested: {
        refreshToken: "refresh-secret",
        apiKey: "api-key-secret",
        email: "buyer@example.test",
      },
      note: "Bearer inline-secret password=plain-secret email=inline@example.test",
      contact: "Contact: buyer@example.test",
      trace: `request ${correlationId}; phone 090-1234-5678`,
      database:
        "postgresql://app-user:database-secret@db.example.test/marketplace",
    });

    const output = write.mock.calls.map(([chunk]) => String(chunk)).join("");
    expect(output).not.toContain("header-secret");
    expect(output).not.toContain("refresh-secret");
    expect(output).not.toContain("api-key-secret");
    expect(output).not.toContain("buyer@example.test");
    expect(output).not.toContain("inline-secret");
    expect(output).not.toContain("plain-secret");
    expect(output).not.toContain("inline@example.test");
    expect(output).not.toContain("database-secret");
    expect(output).not.toContain("app-user");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("[REDACTED_EMAIL]");
    expect(output).toContain(correlationId);
    expect(output).toContain("[REDACTED_PHONE]");
  });
});
