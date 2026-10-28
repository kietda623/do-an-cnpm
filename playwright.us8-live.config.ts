import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "us8-live.spec.ts",
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: [
    {
      command:
        "corepack pnpm --filter @marketplace/storefront exec next dev --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4101/api/v1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command:
        "corepack pnpm --filter @marketplace/seller-center exec next dev --hostname 127.0.0.1 --port 3101",
      url: "http://127.0.0.1:3101",
      env: { NEXT_PUBLIC_API_URL: "http://127.0.0.1:4101/api/v1" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
