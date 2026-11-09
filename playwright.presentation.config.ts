import { defineConfig, devices } from "@playwright/test";

// Reuse the existing fixture-backed journeys against the three running apps.
// This suite does not start servers, seed data or reset a database.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/presentation",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "buyer",
      testMatch: [
        "commerce-layout.spec.ts",
        "buyer-account.spec.ts",
        "fulfillment-buyer.spec.ts",
        "polling-buyer.spec.ts",
        "theme-storefront.spec.ts",
        "discovery.spec.ts",
        "storefront-shell.spec.ts",
        "multi-shop-checkout.spec.ts",
        "storefront-checkout-bootstrap.spec.ts",
        "us8-storefront.spec.ts",
      ],
      use: { baseURL: "http://localhost:3000" },
    },
    {
      name: "seller",
      testMatch: [
        "shop-onboarding.spec.ts",
        "seller-shell.spec.ts",
        "seller-dashboard.spec.ts",
        "seller-orders-split.spec.ts",
        "seller-product-filters.spec.ts",
        "polling-seller.spec.ts",
        "theme-seller.spec.ts",
        "us8-seller.spec.ts",
      ],
      use: { baseURL: "http://localhost:3001" },
    },
    {
      name: "admin",
      testMatch: [
        "admin-return-confirmation.spec.ts",
        "admin-operations.spec.ts",
        "admin-dashboard.spec.ts",
        "admin-filters-pagination.spec.ts",
        "polling-admin.spec.ts",
        "theme-admin.spec.ts",
      ],
      use: { baseURL: "http://localhost:3002" },
    },
  ],
});
