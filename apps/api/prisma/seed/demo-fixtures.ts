import { createHash } from "node:crypto";

const DEMO_NAMESPACE = "04711f92-46ad-5c3a-9ca5-84c2f85fc38a";

export type DemoSeedPasswords = {
  sellerPassword: string;
  buyerPassword: string;
  lockedBuyerPassword: string;
};

export type DemoUserFixture = {
  key: string;
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "LOCKED";
};

export type DemoShopFixture = {
  key: string;
  id: string;
  ownerKey: string;
  slug: string;
  name: string;
  description: string;
  logoAssetId: string;
  logoObjectKey: string;
};

export type DemoCategoryFixture = {
  key: string;
  id: string;
  slug: string;
  name: string;
  status: "VISIBLE";
};

export type DemoProductFixture = {
  key: string;
  id: string;
  shopKey: string;
  categoryKey: string;
  name: string;
  description: string;
  sku: string;
  price: string;
  adminHidden: boolean;
  variantId: string;
  imageAssetId: string;
  imageObjectKey: string;
};

export type DemoOrderFixture = {
  key: string;
  id: string;
  publicNumber: string;
  paymentMethod: "COD" | "MOCK";
  expectedOrderStatus: "PENDING" | "CANCELLED" | "COMPLETED";
  expectedSellerOrderStatus: "PENDING" | "CANCELLED" | "COMPLETED";
  paymentId: string;
  sellerOrderId: string;
  orderItemId: string;
  orderEventId: string;
  paymentAttemptId: string | null;
  paymentEventId: string | null;
  allocationId: string | null;
  refundId: string | null;
  shipmentId: string | null;
  shipmentEventId: string | null;
};

export type DemoFixturePlan = {
  users: DemoUserFixture[];
  shops: DemoShopFixture[];
  categories: DemoCategoryFixture[];
  products: DemoProductFixture[];
  orders: DemoOrderFixture[];
};

function uuidBytes(value: string): Buffer {
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

export function demoStableId(kind: string, key: string): string {
  if (!kind.trim() || !key.trim()) {
    throw new Error("Demo stable IDs require a non-empty kind and key.");
  }

  const digest = createHash("sha1")
    .update(uuidBytes(DEMO_NAMESPACE))
    .update(`${kind}:${key}`, "utf8")
    .digest();
  digest[6] = (digest[6]! & 0x0f) | 0x50;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString("hex");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0");
}

function threeDigits(value: number): string {
  return String(value).padStart(3, "0");
}

function buildUsers(): DemoUserFixture[] {
  const sellers = Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const key = `seller-${twoDigits(number)}`;
    return {
      key,
      id: demoStableId("user", key),
      email: `demo-${key}@example.test`,
      displayName: `Demo Seller ${twoDigits(number)}`,
      status: "ACTIVE" as const,
    };
  });

  return [
    ...sellers,
    {
      key: "buyer-active",
      id: demoStableId("user", "buyer-active"),
      email: "demo-buyer@example.test",
      displayName: "Demo Buyer",
      status: "ACTIVE",
    },
    {
      key: "buyer-locked",
      id: demoStableId("user", "buyer-locked"),
      email: "demo-locked-buyer@example.test",
      displayName: "Demo Locked Buyer",
      status: "LOCKED",
    },
  ];
}

function buildShops(): DemoShopFixture[] {
  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const key = `shop-${twoDigits(number)}`;

    return {
      key,
      id: demoStableId("shop", key),
      ownerKey: `seller-${twoDigits(number)}`,
      slug: `demo-shop-${twoDigits(number)}`,
      name: `Demo Shop ${twoDigits(number)}`,
      description: `Deterministic demo storefront ${twoDigits(number)}.`,
      logoAssetId: demoStableId("asset", `shop-logo:${key}`),
      logoObjectKey: `seed/demo/shops/${twoDigits(number)}/logo.png`,
    };
  });
}

function buildCategories(): DemoCategoryFixture[] {
  return Array.from({ length: 10 }, (_, index) => {
    const number = index + 1;
    const key = `category-${twoDigits(number)}`;

    return {
      key,
      id: demoStableId("category", key),
      slug: `demo-category-${twoDigits(number)}`,
      name: `Demo Category ${twoDigits(number)}`,
      status: "VISIBLE" as const,
    };
  });
}

function buildProducts(): DemoProductFixture[] {
  return Array.from({ length: 1_000 }, (_, index) => {
    const shopNumber = Math.floor(index / 100) + 1;
    const productNumber = (index % 100) + 1;
    const shopKey = `shop-${twoDigits(shopNumber)}`;
    const productKey = `${shopKey}-product-${threeDigits(productNumber)}`;
    const productLabel = `${twoDigits(shopNumber)}-${threeDigits(productNumber)}`;

    return {
      key: productKey,
      id: demoStableId("product", productKey),
      shopKey,
      categoryKey: `category-${twoDigits((index % 10) + 1)}`,
      name: `Demo Product ${productLabel}`,
      description: `Deterministic demo catalog item ${productLabel}.`,
      sku: `DEMO-${productLabel}`,
      price: String(10_000 + index * 1_000),
      adminHidden: index === 999,
      variantId: demoStableId("variant", productKey),
      imageAssetId: demoStableId("asset", `product-image:${productKey}`),
      imageObjectKey: `seed/demo/products/${twoDigits(shopNumber)}/${threeDigits(productNumber)}.png`,
    };
  });
}

function buildOrders(): DemoOrderFixture[] {
  const fixtures = [
    {
      key: "pending-cod",
      publicNumber: "DEMO-PENDING-COD-001",
      paymentMethod: "COD",
      expectedOrderStatus: "PENDING",
      expectedSellerOrderStatus: "PENDING",
      hasAttempt: false,
      hasPaymentEvent: false,
      hasAllocation: false,
      hasRefund: false,
      hasShipment: false,
    },
    {
      key: "expired-mock",
      publicNumber: "DEMO-EXPIRED-MOCK-001",
      paymentMethod: "MOCK",
      expectedOrderStatus: "CANCELLED",
      expectedSellerOrderStatus: "CANCELLED",
      hasAttempt: true,
      hasPaymentEvent: true,
      hasAllocation: false,
      hasRefund: false,
      hasShipment: false,
    },
    {
      key: "refunded-mock",
      publicNumber: "DEMO-REFUNDED-MOCK-001",
      paymentMethod: "MOCK",
      expectedOrderStatus: "CANCELLED",
      expectedSellerOrderStatus: "CANCELLED",
      hasAttempt: true,
      hasPaymentEvent: true,
      hasAllocation: true,
      hasRefund: true,
      hasShipment: false,
    },
    {
      key: "completed-cod",
      publicNumber: "DEMO-COMPLETED-COD-001",
      paymentMethod: "COD",
      expectedOrderStatus: "COMPLETED",
      expectedSellerOrderStatus: "COMPLETED",
      hasAttempt: true,
      hasPaymentEvent: true,
      hasAllocation: true,
      hasRefund: false,
      hasShipment: true,
    },
  ] as const;

  return fixtures.map((fixture) => {
    const key = fixture.key;
    return {
      key,
      id: demoStableId("order", key),
      publicNumber: fixture.publicNumber,
      paymentMethod: fixture.paymentMethod,
      expectedOrderStatus: fixture.expectedOrderStatus,
      expectedSellerOrderStatus: fixture.expectedSellerOrderStatus,
      paymentId: demoStableId("payment", key),
      sellerOrderId: demoStableId("seller-order", key),
      orderItemId: demoStableId("order-item", key),
      orderEventId: demoStableId("order-event", `${key}:status`),
      paymentAttemptId: fixture.hasAttempt ? demoStableId("payment-attempt", key) : null,
      paymentEventId: fixture.hasPaymentEvent ? demoStableId("payment-event", key) : null,
      allocationId: fixture.hasAllocation ? demoStableId("payment-allocation", key) : null,
      refundId: fixture.hasRefund ? demoStableId("simulated-refund", key) : null,
      shipmentId: fixture.hasShipment ? demoStableId("shipment", key) : null,
      shipmentEventId: fixture.hasShipment ? demoStableId("shipment-event", key) : null,
    };
  });
}

export function buildDemoFixturePlan(): DemoFixturePlan {
  return {
    users: buildUsers(),
    shops: buildShops(),
    categories: buildCategories(),
    products: buildProducts(),
    orders: buildOrders(),
  };
}
