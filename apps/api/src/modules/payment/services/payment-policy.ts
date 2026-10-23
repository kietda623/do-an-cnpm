export type PaymentTotals = {
  originalTotal: string;
  cancelledTotal: string;
  paidGross: string;
  refundedTotal: string;
};

export function sumVnd(amounts: readonly string[]): string {
  return amounts
    .reduce((sum, amount) => {
      if (!/^(0|[1-9]\d*)$/.test(amount))
        throw new Error("Money must be a non-negative integer VND string.");
      return sum + BigInt(amount);
    }, 0n)
    .toString();
}

export function derivePaymentAmounts(totals: PaymentTotals) {
  const original = BigInt(totals.originalTotal);
  const cancelled = BigInt(totals.cancelledTotal);
  const paid = BigInt(totals.paidGross);
  const refunded = BigInt(totals.refundedTotal);
  if (cancelled > original || refunded > paid) throw new Error("Payment totals are inconsistent.");
  const netPaid = paid - refunded;
  const effective = original - cancelled;
  const due = effective > netPaid ? effective - netPaid : 0n;
  let status = "UNPAID";
  if (refunded > 0n) status = refunded === paid ? "REFUNDED" : "PARTIALLY_REFUNDED";
  else if (paid > 0n) status = effective > 0n && netPaid >= effective ? "PAID" : "PARTIALLY_PAID";
  return {
    paidGross: paid.toString(),
    refundedTotal: refunded.toString(),
    netPaid: netPaid.toString(),
    amountDue: due.toString(),
    status,
  };
}

export function isAttemptTerminal(status: string): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
}

export function buyerCancellationBlockers(
  parts: readonly { id: string; status: string }[],
): string[] {
  return parts
    .filter(({ status }) => status !== "CANCELLED" && status !== "PENDING")
    .map(({ id }) => id);
}

export function canCancelSellerOrder(status: string, actor: "BUYER" | "SELLER"): boolean {
  return actor === "BUYER" ? status === "PENDING" : status === "PENDING" || status === "CONFIRMED";
}
