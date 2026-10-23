import { describe, expect, it } from "@jest/globals";
import {
  canAdvanceShipment,
  canConfirmOrder,
  canConfirmReturn,
  canReceiveOrder,
  canRetryShipment,
  type ShippingStatus,
} from "./fulfillment-policy.js";

describe("fulfillment state boundaries", () => {
  it("allows only adjacent shipment transitions and keeps delivery terminal", () => {
    const states: ShippingStatus[] = [
      "WAITING_PICKUP",
      "PICKED_UP",
      "IN_TRANSIT",
      "DELIVERED",
      "FAILED",
    ];
    const allowed = new Set([
      "WAITING_PICKUP:PICKED_UP",
      "PICKED_UP:IN_TRANSIT",
      "IN_TRANSIT:DELIVERED",
      "IN_TRANSIT:FAILED",
    ]);
    for (const from of states)
      for (const to of states)
        expect(canAdvanceShipment(from, to)).toBe(allowed.has(`${from}:${to}`));
  });
  it("permits unpaid COD but rejects unpaid mock and expired confirmation", () => {
    const now = new Date("2026-10-23T00:00:00Z");
    expect(canConfirmOrder("PENDING", "COD", false, null, now)).toBe(true);
    expect(canConfirmOrder("PENDING", "MOCK", false, new Date(now.getTime() + 1000), now)).toBe(
      false,
    );
    expect(canConfirmOrder("PENDING", "MOCK", true, now, now)).toBe(false);
    expect(canConfirmOrder("CONFIRMED", "COD", false, null, now)).toBe(false);
  });
  it("requires delivery and settled money before buyer completion", () => {
    expect(canReceiveOrder("DELIVERED", "DELIVERED", "0")).toBe(true);
    expect(canReceiveOrder("DELIVERED", "DELIVERED", "1")).toBe(false);
    expect(canReceiveOrder("SHIPPING", "IN_TRANSIT", "0")).toBe(false);
  });
  it("makes retry and confirmed return mutually exclusive", () => {
    const returned = new Date();
    expect(canRetryShipment("FAILED", null)).toBe(true);
    expect(canConfirmReturn("FAILED", "SHIPPING", null)).toBe(true);
    expect(canRetryShipment("FAILED", returned)).toBe(false);
    expect(canConfirmReturn("FAILED", "CANCELLED", returned)).toBe(false);
  });
});
