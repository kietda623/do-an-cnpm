import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["buyer-account.spec.ts", "fulfillment-buyer.spec.ts"],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    actionTimeout: 5_000,
    navigationTimeout: 10_000,
    trace: "retain-on-failure",
  },
  expect: { timeout: 5_000 },
  webServer: {
    command:
      "corepack pnpm --filter @marketplace/storefront exec next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
