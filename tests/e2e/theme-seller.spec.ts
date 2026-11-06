import { expect, test, type Page } from "@playwright/test";

const seller = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "seller@example.test",
  fullName: "E2E Seller",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
};

const memberships = [
  { shopId: "shop-one", shopName: "Cửa hàng Một", shopStatus: "ACTIVE", role: "OWNER" },
  { shopId: "shop-two", shopName: "Cửa hàng Hai", shopStatus: "ACTIVE", role: "OWNER" },
];

function emptyStats(shopId: string) {
  return {
    shopId,
    productCount: 0,
    pendingCount: 0,
    processingCount: 0,
    completedCount: 0,
    completedRevenue: "0",
    currency: "VND",
    simulated: false,
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-11-01T00:00:00.000Z",
    timezone: "Asia/Saigon",
  };
}

function emptyRevenue(shopId: string, groupBy: string) {
  return {
    shopId,
    groupBy,
    points: [],
    totalRevenue: "0",
    currency: "VND",
    simulated: false,
    timezone: "Asia/Saigon",
  };
}

async function mockConsole(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: seller } } });
    if (path === "/users/me") return route.fulfill({ json: { data: seller } });
    if (path === "/users/me/shops") return route.fulfill({ json: { data: memberships } });
    const stats = /^\/shops\/([^/]+)\/stats$/.exec(path);
    if (stats)
      return route.fulfill({ json: { data: emptyStats(decodeURIComponent(stats[1]!)) } });
    const revenue = /^\/shops\/([^/]+)\/revenue$/.exec(path);
    if (revenue)
      return route.fulfill({
        json: {
          data: emptyRevenue(
            decodeURIComponent(revenue[1]!),
            url.searchParams.get("groupBy") ?? "DAY",
          ),
        },
      });
    if (/^\/shops\/[^/]+\/orders$/.test(path))
      return route.fulfill({ json: { data: [] } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("seller console theme toggle follows the system preference and persists", async ({
  page,
}) => {
  await mockConsole(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/shops/shop-one/dashboard");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-theme-mode", "system");

  const topbar = page.locator(".mp-console__topbar-actions");
  const toggle = topbar.getByRole("button", { name: "Chuyển sang giao diện sáng" });
  await expect(toggle).toBeVisible();
  await toggle.click();

  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => window.localStorage.getItem("marketplace-theme"))).toBe(
    "light",
  );

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-theme-mode", "light");
  await expect(
    topbar.getByRole("button", { name: "Chuyển sang giao diện tối" }),
  ).toBeVisible();
});

test("seller console theme toggle works with reduced motion at 360px", async ({ page }) => {
  await mockConsole(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/shops/shop-one/dashboard");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");

  const toggle = page
    .locator(".mp-console__topbar-actions")
    .getByRole("button", { name: "Chuyển sang giao diện sáng" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme-mode", "light");
  await page
    .locator(".mp-console__topbar-actions")
    .getByRole("button", { name: "Chuyển sang giao diện tối" })
    .click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});
