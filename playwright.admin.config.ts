import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3102";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "admin-return-confirmation.spec.ts",
    "admin-operations.spec.ts",
    "admin-dashboard.spec.ts",
    "admin-filters-pagination.spec.ts",
    "polling-admin.spec.ts",
    "theme-admin.spec.ts",
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
          "corepack pnpm --filter @marketplace/admin-panel exec next dev --hostname 127.0.0.1 --port 3102",
        url: "http://127.0.0.1:3102",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
