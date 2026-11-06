import { expect, test, type Page } from "@playwright/test";

const admin = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "admin@example.test",
  fullName: "Admin Operator",
  phone: null,
  avatar: null,
  roles: ["ADMIN"],
  status: "ACTIVE",
  version: 0,
};

const pendingShop = {
  id: "00000000-0000-4000-8000-000000000301",
  name: "Linen Shop",
  slug: "linen-shop",
  status: "PENDING",
  version: 0,
  createdAt: "2026-10-27T09:00:00.000Z",
};

async function mockDashboard(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: admin } } });
    if (path === "/users/me") return route.fulfill({ json: { data: admin } });
    if (path === "/admin/stats")
      return route.fulfill({
        json: {
          data: {
            userCount: 12,
            shopCount: 4,
            productCount: 21,
            orderCount: 8,
            completedSellerOrderValue: "125000",
            simulated: true,
            from: "2026-10-01T00:00:00.000Z",
            to: "2026-11-01T00:00:00.000Z",
            countsByStatus: {
              SellerOrder: { PENDING: 2, COMPLETED: 5 },
              User: { ACTIVE: 10 },
            },
          },
        },
      });
    if (path === "/admin/shops")
      return route.fulfill({
        json: { data: [pendingShop], meta: { page: 1, pageSize: 5, total: 1 } },
      });
    if (path === "/admin/audit")
      return route.fulfill({
        json: { data: [], meta: { page: 1, pageSize: 8, total: 0 } },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("admin console theme toggle follows the system preference and persists", async ({
  page,
}) => {
  await mockDashboard(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

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

test("admin console theme toggle works with reduced motion at 360px", async ({ page }) => {
  await mockDashboard(page);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

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
