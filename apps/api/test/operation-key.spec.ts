import { describe, expect, it } from "@jest/globals";
import { scopedOperationKey } from "../src/common/idempotency/operation-key.js";

const key = "11111111-1111-4111-8111-111111111111";

describe("operation key scoping", () => {
  it("namespaces a client key by its owner or resource", () => {
    expect(scopedOperationKey("mock-attempt", "buyer-a", key)).toBe(
      `mock-attempt:buyer-a:${key}`,
    );
    expect(scopedOperationKey("mock-attempt", "buyer-b", key)).not.toBe(
      scopedOperationKey("mock-attempt", "buyer-a", key),
    );
    expect(scopedOperationKey("shipment:event", "shipment-a", key)).not.toBe(
      scopedOperationKey("shipment:event", "shipment-b", key),
    );
  });
});
