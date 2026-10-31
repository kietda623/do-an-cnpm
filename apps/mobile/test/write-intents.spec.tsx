import { WriteIntentRegistry } from "../src/features/commerce/write-intents";

function createIdFactory() {
  let next = 1;
  return () =>
    `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
}

describe("WriteIntentRegistry", () => {
  test("reuses an unresolved intent for the same scope and body", () => {
    let generated = 0;
    const createId = createIdFactory();
    const registry = new WriteIntentRegistry(() => {
      generated += 1;
      return createId();
    });
    const body = { quoteId: "quote-1" };

    const first = registry.getOrCreate("buyer-1:POST:/checkout", body);
    const retry = registry.getOrCreate("buyer-1:POST:/checkout", body);

    expect(retry).toEqual(first);
    expect(generated).toBe(2);
  });

  test("canonicalizes object key order in request bodies", () => {
    const registry = new WriteIntentRegistry(createIdFactory());

    const first = registry.getOrCreate("buyer-1:PATCH:/cart", {
      quantity: 2,
      selected: true,
    });
    const reordered = registry.getOrCreate("buyer-1:PATCH:/cart", {
      selected: true,
      quantity: 2,
    });

    expect(reordered).toEqual(first);
  });

  test("creates a new intent when the body changes", () => {
    const registry = new WriteIntentRegistry(createIdFactory());

    const initial = registry.getOrCreate("buyer-1:POST:/orders", {
      expectedVersion: 3,
    });
    const changedBody = registry.getOrCreate("buyer-1:POST:/orders", {
      expectedVersion: 4,
    });

    expect(changedBody.idempotencyKey).not.toBe(initial.idempotencyKey);
    expect(changedBody.eventId).not.toBe(initial.eventId);
  });

  test("creates a new intent when the scope changes", () => {
    const registry = new WriteIntentRegistry(createIdFactory());
    const body = { expectedVersion: 3 };

    const firstScope = registry.getOrCreate("buyer-1:POST:/orders", body);
    const secondScope = registry.getOrCreate("buyer-2:POST:/orders", body);

    expect(secondScope.idempotencyKey).not.toBe(firstScope.idempotencyKey);
    expect(secondScope.eventId).not.toBe(firstScope.eventId);
  });

  test("completes only the matching scope and body intent", () => {
    const registry = new WriteIntentRegistry(createIdFactory());
    const firstBody = { expectedVersion: 1 };
    const secondBody = { expectedVersion: 2 };
    const first = registry.getOrCreate("buyer-1:POST:/orders", firstBody);
    const second = registry.getOrCreate("buyer-1:POST:/orders", secondBody);

    registry.complete("buyer-1:POST:/orders", firstBody);

    expect(registry.getOrCreate("buyer-1:POST:/orders", secondBody)).toEqual(
      second,
    );
    expect(
      registry.getOrCreate("buyer-1:POST:/orders", firstBody).idempotencyKey,
    ).not.toBe(first.idempotencyKey);
  });

  test("isolates intents between buyer accounts", () => {
    const registry = new WriteIntentRegistry(createIdFactory());
    const body = { quantity: 1 };

    const firstBuyer = registry.getOrCreate("buyer-1:PATCH:/cart/item-1", body);
    const secondBuyer = registry.getOrCreate("buyer-2:PATCH:/cart/item-1", body);

    expect(secondBuyer.idempotencyKey).not.toBe(firstBuyer.idempotencyKey);
    expect(
      registry.getOrCreate("buyer-1:PATCH:/cart/item-1", body),
    ).toEqual(firstBuyer);
  });

  test("generates UUIDv4-shaped keys and event IDs by default", () => {
    const intent = new WriteIntentRegistry().getOrCreate(
      "buyer-1:POST:/orders",
      { orderId: "order-1" },
    );

    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(intent.idempotencyKey).toMatch(uuidV4);
    expect(intent.eventId).toMatch(uuidV4);
  });
});
