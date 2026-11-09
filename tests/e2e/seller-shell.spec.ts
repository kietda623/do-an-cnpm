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

test("seller console shell lists shop navigation and switches active shop", async ({ page }) => {
  await mockConsole(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/shops/shop-one/dashboard");

  await expect(page.getByRole("link", { name: "sopi Seller Center — trang chủ" })).toBeVisible();
  await expect(page.getByText("Kênh người bán")).toBeVisible();
  await expect(page.locator(".mp-console__context-name")).toHaveText("Cửa hàng Một");

  const nav = page.getByRole("navigation", { name: "Điều hướng chính" }).first();
  await expect(nav.getByRole("link", { name: "Đến cửa hàng của tôi" })).toHaveAttribute(
    "href",
    "/shops",
  );
  await expect(nav.getByRole("link", { name: "Tổng quan" })).toHaveAttribute(
    "href",
    "/shops/shop-one/dashboard",
  );
  await expect(nav.getByRole("link", { name: "Đơn hàng" })).toHaveAttribute(
    "href",
    "/shops/shop-one/orders",
  );
  await expect(nav.getByRole("link", { name: "Sản phẩm" })).toHaveAttribute(
    "href",
    "/shops/shop-one/products",
  );
  await expect(nav.getByRole("link", { name: "Doanh thu" })).toHaveAttribute(
    "href",
    "/shops/shop-one/analytics",
  );
  await expect(nav.getByRole("link", { name: "Đánh giá" })).toHaveAttribute(
    "href",
    "/shops/shop-one/reviews",
  );
  await expect(nav.getByRole("link", { name: "Cài đặt cửa hàng" })).toHaveAttribute(
    "href",
    "/shops/shop-one/settings",
  );

  await page.getByLabel("Chọn cửa hàng").selectOption("shop-two");
  await expect(page).toHaveURL(/\/shops\/shop-two\/dashboard/);
});

test("seller console collapses into a focus-trapped drawer on narrow screens", async ({ page }) => {
  await mockConsole(page);
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/shops/shop-one/dashboard");

  const trigger = page.getByRole("button", { name: "Mở điều hướng" });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.getByRole("dialog", { name: "Điều hướng" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Tổng quan" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Cài đặt cửa hàng" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
});
