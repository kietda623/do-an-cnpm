import { describe, expect, it } from "@jest/globals";
import { buildTargetSellerOrdersSnapshot } from "./target-snapshot.js";

const orderId = "00000000-0000-4000-8000-000000000001";
const otherOrderId = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const parts = [{ id, orderId, status: "PENDING" }];
const valid = [{ sellerOrderId: id, amount: "1250" }];
const build = (snapshot: unknown, amount = "1250", sellerOrders = parts) =>
  buildTargetSellerOrdersSnapshot({
    mode: "NEW",
    orderId,
    amount,
    sellerOrders,
    snapshot,
  });

describe("payment target snapshot", () => {
  it("accepts exact positive VND strings belonging to the payment order", () => {
    expect(build(valid)).toEqual(valid);
  });
  it.each([
    ["empty", []],
    ["duplicate", [...valid, ...valid]],
    ["numeric amount", [{ sellerOrderId: id, amount: 1250 }]],
    ["zero", [{ sellerOrderId: id, amount: "0" }]],
    ["negative", [{ sellerOrderId: id, amount: "-1" }]],
    ["fraction", [{ sellerOrderId: id, amount: "12.5" }]],
    ["invalid UUID", [{ sellerOrderId: "bad", amount: "1250" }]],
    ["extra fields", [{ sellerOrderId: id, amount: "1250", extra: 1 }]],
  ])("rejects %s", (_label, snapshot) =>
    expect(() => build(snapshot)).toThrow(),
  );
  it("rejects a mismatched sum and cancelled or foreign parts", () => {
    expect(() => build(valid, "1251")).toThrow();
    expect(() =>
      build(valid, "1250", [{ id, orderId, status: "CANCELLED" }]),
    ).toThrow();
    expect(() =>
      build(valid, "1250", [{ id, orderId: otherOrderId, status: "PENDING" }]),
    ).toThrow();
  });
  it("permits cancelled parts only for unchanged compensation of the original snapshot", () => {
    const originalAttempt = {
      paymentOrderId: orderId,
      amount: "1250",
      snapshot: valid,
    };
    const args = {
      mode: "LATE_COMPENSATION" as const,
      orderId,
      amount: "1250",
      sellerOrders: [{ id, orderId, status: "CANCELLED" }],
      snapshot: valid,
      originalAttempt,
    };
    expect(buildTargetSellerOrdersSnapshot(args)).toEqual(valid);
    expect(() =>
      buildTargetSellerOrdersSnapshot({
        ...args,
        snapshot: [{ sellerOrderId: id, amount: "1249" }],
      }),
    ).toThrow();
    expect(() =>
      buildTargetSellerOrdersSnapshot({
        ...args,
        sellerOrders: [{ id, orderId: otherOrderId, status: "CANCELLED" }],
      }),
    ).toThrow();
    expect(() =>
      buildTargetSellerOrdersSnapshot({ ...args, originalAttempt: undefined }),
    ).toThrow();
  });
  it("retains both original parts when only one is cancelled", () => {
    const secondId = "00000000-0000-4000-8000-000000000004";
    const snapshot = [
      { sellerOrderId: id, amount: "1250" },
      { sellerOrderId: secondId, amount: "500" },
    ];
    const args = {
      mode: "LATE_COMPENSATION" as const,
      orderId,
      amount: "1750",
      sellerOrders: [
        { id, orderId, status: "CANCELLED" },
        { id: secondId, orderId, status: "PENDING" },
      ],
      snapshot,
      originalAttempt: { paymentOrderId: orderId, amount: "1750", snapshot },
    };
    expect(buildTargetSellerOrdersSnapshot(args)).toEqual(snapshot);
    expect(() =>
      buildTargetSellerOrdersSnapshot({
        ...args,
        snapshot: [
          { sellerOrderId: id, amount: "1249" },
          { sellerOrderId: secondId, amount: "501" },
        ],
      }),
    ).toThrow();
  });
});
