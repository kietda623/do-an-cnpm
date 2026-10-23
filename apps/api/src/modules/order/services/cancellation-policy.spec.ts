import { describe, expect, it } from "@jest/globals";
import {
  buyerCancellationBlockers,
  canCancelSellerOrder,
} from "../../payment/services/payment-policy.js";

describe("cancellation state policy", () => {
  it("allows a full buyer cancellation only when every live part is pending", () => {
    expect(
      buyerCancellationBlockers([
        { id: "a", status: "PENDING" },
        { id: "b", status: "CANCELLED" },
        { id: "c", status: "PENDING" },
      ]),
    ).toEqual([]);
    expect(
      buyerCancellationBlockers([
        { id: "a", status: "PENDING" },
        { id: "b", status: "CONFIRMED" },
        { id: "c", status: "SHIPPING" },
      ]),
    ).toEqual(["b", "c"]);
  });

  it.each([
    ["BUYER", "PENDING", true],
    ["BUYER", "CONFIRMED", false],
    ["SELLER", "PENDING", true],
    ["SELLER", "CONFIRMED", true],
    ["SELLER", "PACKING", false],
  ] as const)("actor=%s status=%s may cancel=%s", (actor, status, allowed) => {
    expect(canCancelSellerOrder(status, actor)).toBe(allowed);
  });
});
