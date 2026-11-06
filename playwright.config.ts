import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "buyer-account.spec.ts",
    "fulfillment-buyer.spec.ts",
    "polling-buyer.spec.ts",
    "theme-storefront.spec.ts",
  ],
  fullyParallel: false,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
  },
  expect: { timeout: 15_000 },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command:
          "corepack pnpm --filter @marketplace/storefront exec next dev --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
