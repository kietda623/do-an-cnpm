import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "commerce-fulfillment.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command:
        "pnpm --filter @marketplace/storefront exec next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4100/api/v1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4100/api/v1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "pnpm --filter @marketplace/admin-panel exec next dev --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4100/api/v1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
