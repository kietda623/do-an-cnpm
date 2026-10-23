import { describe, expect, it } from "@jest/globals";
import { derivePaymentAmounts, isAttemptTerminal, sumVnd } from "./payment-policy.js";

describe("payment money and attempt policy", () => {
  it("sums VND as exact integer strings without floating point", () => {
    expect(sumVnd(["999999999999999999", "1", "150"])).toBe("1000000000000000150");
    expect(() => sumVnd(["1.5"])).toThrow("non-negative integer VND string");
  });

  it.each([
    ["0", "0", "0", "0", "UNPAID", "0"],
    ["1000", "0", "1000", "0", "PAID", "0"],
    ["1000", "500", "500", "0", "PARTIALLY_PAID", "0"],
    ["1000", "0", "1000", "1000", "REFUNDED", "1000"],
    ["1000", "0", "1000", "400", "PARTIALLY_REFUNDED", "400"],
    ["1000", "1000", "0", "0", "UNPAID", "0"],
  ])(
    "derives status for total=%s cancelled=%s paid=%s refunded=%s",
    (original, cancelled, paid, refunded, status, due) => {
      expect(
        derivePaymentAmounts({
          originalTotal: original as string,
          cancelledTotal: cancelled as string,
          paidGross: paid as string,
          refundedTotal: refunded as string,
        }),
      ).toMatchObject({ status, amountDue: due });
    },
  );

  it("keeps successful, failed, and cancelled attempts terminal", () => {
    expect(isAttemptTerminal("PENDING")).toBe(false);
    for (const status of ["SUCCEEDED", "FAILED", "CANCELLED"])
      expect(isAttemptTerminal(status)).toBe(true);
  });
});
