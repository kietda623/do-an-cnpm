import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    {
      name: "storefront",
      testMatch: "us8-storefront.spec.ts",
      use: { baseURL: "http://127.0.0.1:3100" },
    },
    {
      name: "seller",
      testMatch: "us8-seller.spec.ts",
      use: { baseURL: "http://127.0.0.1:3101" },
    },
  ],
  webServer: [
    {
      command:
        "corepack pnpm --filter @marketplace/storefront exec next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "corepack pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
