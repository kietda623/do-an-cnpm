type SnapshotPart = { sellerOrderId: string; amount: string };
type SellerOrder = { id: string; orderId: string; status: string };
type OriginalAttempt = {
  paymentOrderId: string;
  amount: string;
  snapshot: unknown;
};
type SnapshotInput = {
  mode: "NEW" | "LATE_COMPENSATION";
  orderId: string;
  amount: string;
  sellerOrders: SellerOrder[];
  snapshot: unknown;
  originalAttempt?: OriginalAttempt;
};

export function buildTargetSellerOrdersSnapshot(
  input: SnapshotInput,
): SnapshotPart[] {
  const fail = (): never => {
    throw new Error("Invalid payment target snapshot");
  };
  if (!Array.isArray(input.snapshot) || input.snapshot.length === 0)
    return fail();
  const seen = new Set<string>();
  let total = 0n;
  const result: SnapshotPart[] = input.snapshot.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return fail();
    const item = value as Record<string, unknown>;
    if (
      Object.keys(item).length !== 2 ||
      typeof item.sellerOrderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        item.sellerOrderId,
      ) ||
      typeof item.amount !== "string" ||
      !/^\d+$/.test(item.amount) ||
      BigInt(item.amount) <= 0n
    )
      return fail();
    const id = item.sellerOrderId.toLowerCase();
    const order = input.sellerOrders.find(
      (part) => part.id.toLowerCase() === id,
    );
    if (
      seen.has(id) ||
      !order ||
      order.orderId !== input.orderId ||
      (input.mode === "NEW" && order.status === "CANCELLED")
    )
      return fail();
    seen.add(id);
    total += BigInt(item.amount);
    return { sellerOrderId: item.sellerOrderId, amount: item.amount };
  });
  if (!/^\d+$/.test(input.amount) || BigInt(input.amount) !== total)
    return fail();
  if (input.mode === "LATE_COMPENSATION") {
    const original = input.originalAttempt;
    if (
      !original ||
      original.paymentOrderId !== input.orderId ||
      original.amount !== input.amount ||
      !Array.isArray(original.snapshot) ||
      original.snapshot.length !== result.length ||
      original.snapshot.some((part: unknown, index: number) => {
        if (!part || typeof part !== "object") return true;
        const source = part as Record<string, unknown>;
        return (
          Object.keys(source).length !== 2 ||
          source.sellerOrderId !== result[index]?.sellerOrderId ||
          source.amount !== result[index]?.amount
        );
      })
    )
      return fail();
  }
  return result;
}
