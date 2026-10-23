export type ShippingStatus = "WAITING_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "FAILED";

const shippingTransitions: Record<ShippingStatus, readonly ShippingStatus[]> = {
  WAITING_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["IN_TRANSIT"],
  IN_TRANSIT: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: [],
};

export function canAdvanceShipment(from: ShippingStatus, to: ShippingStatus): boolean {
  return shippingTransitions[from].includes(to);
}

export function canConfirmOrder(
  status: string,
  method: "COD" | "MOCK",
  paid: boolean,
  deadline: Date | null,
  databaseNow: Date,
): boolean {
  return (
    status === "PENDING" &&
    (method === "COD" || (paid && deadline !== null && databaseNow < deadline))
  );
}

export function canReceiveOrder(
  status: string,
  shipmentStatus: ShippingStatus | null,
  outstandingAmount: string,
): boolean {
  return (
    status === "DELIVERED" && shipmentStatus === "DELIVERED" && BigInt(outstandingAmount) === 0n
  );
}

export function canRetryShipment(
  status: ShippingStatus,
  returnedConfirmedAt: Date | null,
): boolean {
  return status === "FAILED" && returnedConfirmedAt === null;
}

export function canConfirmReturn(
  status: ShippingStatus,
  sellerOrderStatus: string,
  returnedConfirmedAt: Date | null,
): boolean {
  return status === "FAILED" && sellerOrderStatus === "SHIPPING" && returnedConfirmedAt === null;
}
