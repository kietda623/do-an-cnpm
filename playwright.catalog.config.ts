import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "product-publishing.spec.ts",
  fullyParallel: false,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "corepack pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command:
        "corepack pnpm --filter @marketplace/admin-panel exec next dev --hostname 127.0.0.1 --port 3102",
      url: "http://127.0.0.1:3102",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
