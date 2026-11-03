import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: [
    "admin-return-confirmation.spec.ts",
    "admin-operations.spec.ts",
    "admin-dashboard.spec.ts",
    "admin-filters-pagination.spec.ts",
  ],
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "corepack pnpm --filter @marketplace/admin-panel exec next dev --hostname 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
