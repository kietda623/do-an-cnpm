import { expect, test, type Page } from "@playwright/test";

const shopId = "shop-one";
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

const recentOrder = {
  id: "00000000-0000-4000-8000-000000000501",
  orderId: "00000000-0000-4000-8000-000000000500",
  status: "PENDING",
  version: 1,
  originalTotal: "303000",
  outstandingAmount: "303000",
  shipment: null,
  items: [
    { id: "00000000-0000-4000-8000-000000000502", productName: "Áo linen xanh", quantity: 1 },
  ],
};

type Seen = { stats: URLSearchParams[]; revenue: URLSearchParams[] };

async function mockDashboard(page: Page, seen: Seen) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: seller } } });
    if (path === "/users/me") return route.fulfill({ json: { data: seller } });
    if (path === "/users/me/shops")
      return route.fulfill({
        json: {
          data: [
            { shopId, shopName: "Cửa hàng Một", shopStatus: "ACTIVE", role: "OWNER" },
          ],
        },
      });
    if (path === `/shops/${shopId}/stats`) {
      seen.stats.push(url.searchParams);
      return route.fulfill({
        json: {
          data: {
            shopId,
            productCount: 7,
            pendingCount: 2,
            processingCount: 3,
            completedCount: 12,
            completedRevenue: "1500000",
            currency: "VND",
            simulated: true,
            from: url.searchParams.get("from"),
            to: url.searchParams.get("to"),
            timezone: "Asia/Saigon",
          },
        },
      });
    }
    if (path === `/shops/${shopId}/revenue`) {
      seen.revenue.push(url.searchParams);
      const groupBy = url.searchParams.get("groupBy") ?? "DAY";
      return route.fulfill({
        json: {
          data: {
            shopId,
            groupBy,
            points:
              groupBy === "MONTH"
                ? [{ period: "2026-10", completedCount: 3, revenue: "1500000" }]
                : [
                    { period: "2026-10-27", completedCount: 1, revenue: "500000" },
                    { period: "2026-10-28", completedCount: 2, revenue: "1000000" },
                  ],
            totalRevenue: "1500000",
            currency: "VND",
            simulated: true,
            timezone: "Asia/Saigon",
          },
        },
      });
    }
    if (path === `/shops/${shopId}/orders`)
      return route.fulfill({ json: { data: [recentOrder] } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("seller dashboard renders real KPI, simulated label and revenue chart", async ({ page }) => {
  const seen: Seen = { stats: [], revenue: [] };
  await mockDashboard(page, seen);
  await page.goto(`/shops/${shopId}/dashboard`);

  await expect(page.getByRole("heading", { name: "Tổng quan cửa hàng" })).toBeVisible();

  const kpi = page.getByRole("region", { name: "Thống kê cửa hàng" });
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Sản phẩm" })).toContainText("7");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Chờ xác nhận" })).toContainText("2");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Đang xử lý" })).toContainText("3");
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Hoàn thành" })).toContainText("12");
  const revenueKpi = kpi.locator(".mp-stat").filter({ hasText: "Doanh thu hoàn tất" });
  await expect(revenueKpi).toContainText("1.500.000₫");
  await expect(revenueKpi).toContainText("Số liệu mô phỏng");

  await expect(
    page.getByText("Số liệu doanh thu mô phỏng, không đại diện số tiền đã đối soát.").first(),
  ).toBeVisible();
  await expect(page.locator(".mp-note").getByText("Mô phỏng").first()).toBeVisible();

  const chart = page.getByRole("figure", { name: "Doanh thu theo kỳ" });
  await expect(chart).toBeVisible();
  await expect(chart.locator(".mp-chart__bars")).toContainText("2026-10-27");
  await expect(page.getByText("Tổng doanh thu")).toBeVisible();

  const orders = page.getByRole("table", { name: "Đơn hàng gần nhất" });
  await expect(orders).toContainText("00000000…");
  await expect(orders).toContainText("1 sản phẩm");
  await expect(orders).toContainText("Chờ xác nhận");
  await expect(orders).toContainText("303.000₫");

  expect(seen.stats.at(-1)?.has("from")).toBe(true);
  expect(seen.stats.at(-1)?.has("to")).toBe(true);
  expect(seen.revenue.at(-1)?.get("groupBy")).toBe("DAY");

  await page.getByLabel("Nhóm doanh thu").selectOption("MONTH");
  await expect
    .poll(() => seen.revenue.at(-1)?.get("groupBy"))
    .toBe("MONTH");
  await expect(chart.locator(".mp-chart__bars")).toContainText("2026-10");
});

test("seller dashboard rejects an inverted date range without calling the API", async ({
  page,
}) => {
  const seen: Seen = { stats: [], revenue: [] };
  await mockDashboard(page, seen);
  await page.goto(`/shops/${shopId}/dashboard`);

  await expect(page.getByRole("heading", { name: "Tổng quan cửa hàng" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Thống kê cửa hàng" })).toBeVisible();
  const statsBefore = seen.stats.length;
  const revenueBefore = seen.revenue.length;

  await page.getByLabel("Từ (giờ Việt Nam)").fill("2026-11-02T00:00");
  await page.getByLabel("Đến trước (giờ Việt Nam)").fill("2026-10-01T00:00");
  await page.getByRole("button", { name: "Áp dụng khoảng thời gian" }).click();

  await expect(
    page.getByText("Vui lòng nhập thời gian hợp lệ", { exact: false }),
  ).toBeVisible();
  expect(seen.stats.length).toBe(statsBefore);
  expect(seen.revenue.length).toBe(revenueBefore);
});
