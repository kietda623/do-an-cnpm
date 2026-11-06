import { describe, expect, it } from "@jest/globals";
import {
  buildDemoFixturePlan,
  demoStableId,
} from "../prisma/seed/demo-fixtures.ts";

describe("demo seed fixture plan", () => {
  it("defines exactly ten shops, ten visible categories and 1,000 products at 100 per shop", () => {
    const plan = buildDemoFixturePlan();

    expect(plan.shops).toHaveLength(10);
    expect(new Set(plan.shops.map((shop) => shop.slug)).size).toBe(10);
    expect(plan.categories).toHaveLength(10);
    expect(new Set(plan.categories.map((category) => category.slug)).size).toBe(10);
    expect(plan.categories.every((category) => category.status === "VISIBLE")).toBe(true);
    expect(plan.products).toHaveLength(1_000);
    expect(
      plan.shops.map((shop) =>
        plan.products.filter((product) => product.shopKey === shop.key).length,
      ),
    ).toEqual(Array.from({ length: 10 }, () => 100));
  });

  it("includes one hidden product and decimal-string VND prices", () => {
    const plan = buildDemoFixturePlan();

    expect(plan.products.filter((product) => product.adminHidden)).toHaveLength(1);
    expect(
      plan.products.every(
        (product) => /^\d+$/.test(product.price) && BigInt(product.price) > 0n,
      ),
    ).toBe(true);
    expect(plan.products.map((product) => product.price)).toEqual(
      Array.from({ length: 1_000 }, (_, index) => String(10_000 + index * 1_000)),
    );
  });

  it("returns the same fixture IDs and public order numbers on every call", () => {
    const first = buildDemoFixturePlan();
    const second = buildDemoFixturePlan();

    expect(first).toEqual(second);
    expect(first.orders.map((order) => order.publicNumber)).toEqual([
      "DEMO-PENDING-COD-001",
      "DEMO-EXPIRED-MOCK-001",
      "DEMO-REFUNDED-MOCK-001",
      "DEMO-COMPLETED-COD-001",
    ]);
  });

  it("generates stable, distinct UUIDs for each demo fixture kind and key", () => {
    const fixtures: Array<[string, string]> = [
      ["user", "seller-01"],
      ["shop", "shop-01"],
      ["category", "category-01"],
      ["asset", "product-image-01"],
      ["product", "product-01"],
      ["variant", "variant-01"],
      ["order", "pending-cod"],
      ["payment", "pending-cod"],
      ["seller-order", "pending-cod"],
      ["order-item", "pending-cod"],
    ];
    const ids = fixtures.map(([kind, key]) => demoStableId(kind, key));

    expect(ids).toEqual(fixtures.map(([kind, key]) => demoStableId(kind, key)));
    expect(new Set(ids).size).toBe(fixtures.length);
    expect(
      ids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
      ),
    ).toBe(true);
  });
});
