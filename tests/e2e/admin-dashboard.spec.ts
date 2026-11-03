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
    if (path === "/admin/stats") {
      expect(url.searchParams.has("from")).toBe(true);
      expect(url.searchParams.has("to")).toBe(true);
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
    }
    if (path === "/admin/shops")
      return route.fulfill({
        json: { data: { data: [pendingShop], meta: { page: 1, pageSize: 5, total: 1 } } },
      });
    if (path === "/admin/audit")
      return route.fulfill({
        json: {
          data: [
            {
              id: "audit-1",
              action: "shop.approved",
              resourceType: "Shop",
              resourceId: pendingShop.id,
              reason: "Policy review",
              actorId: admin.id,
              requestId: "abcdef12-3456-7890-abcd-ef1234567890",
              createdAt: "2026-10-27T10:00:00.000Z",
              metadata: {},
            },
          ],
          meta: { page: 1, pageSize: 8, total: 1 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("admin dashboard shows platform KPI, status bars, pending shops and audit", async ({
  page,
}) => {
  await mockDashboard(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Tổng quan nền tảng" })).toBeVisible();

  const kpi = page.getByRole("region", { name: "Thống kê nền tảng" });
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Người dùng" })).toContainText("12");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Cửa hàng" })).toContainText("4");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Sản phẩm" })).toContainText("21");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Đơn hàng" })).toContainText("8");
  const valueCard = kpi.locator(".mp-stat").filter({ hasText: "Giá trị seller order hoàn tất" });
  await expect(valueCard).toContainText("125.000₫");
  await expect(valueCard).toContainText("Số liệu mô phỏng");

  await expect(page.locator(".mp-note").getByText("Mô phỏng")).toBeVisible();

  const distribution = page
    .getByRole("region", { name: "SellerOrder" });
  await expect(distribution).toContainText("PENDING");
  await expect(distribution).toContainText("2");
  await expect(page.getByRole("region", { name: "User" })).toContainText("ACTIVE");

  // No monthly GMV chart: the API exposes only status counts.
  await expect(page.locator(".mp-chart")).toHaveCount(0);

  const shops = page.getByRole("table", { name: "Cửa hàng chờ duyệt" });
  await expect(shops).toContainText("Linen Shop");
  await expect(shops).toContainText("Chờ duyệt");

  const audit = page.getByRole("table", { name: "Hoạt động quản trị gần đây" });
  await expect(audit).toContainText("shop.approved");
  await expect(audit).toContainText("Policy review");
});
