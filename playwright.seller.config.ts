import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "shop-onboarding.spec.ts",
    "commerce-fulfillment.spec.ts",
    "seller-shell.spec.ts",
    "seller-dashboard.spec.ts",
    "seller-orders-split.spec.ts",
    "seller-product-filters.spec.ts",
    "polling-seller.spec.ts",
    "theme-seller.spec.ts",
  ],
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "corepack pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
        url: "http://127.0.0.1:3101",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
