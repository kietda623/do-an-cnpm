import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["product-publishing.spec.ts", "seller-variant-form.spec.ts"],
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  webServer: [
    ...(!process.env.PLAYWRIGHT_BASE_URL
      ? [
          {
            command:
              "pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
            url: "http://127.0.0.1:3101",
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
    ...(!process.env.PLAYWRIGHT_ADMIN_URL
      ? [
          {
            command:
              "pnpm --filter @marketplace/admin-panel exec next dev --hostname 127.0.0.1 --port 3102",
            url: "http://127.0.0.1:3102",
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
  ],
});
