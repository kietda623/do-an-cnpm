import { expect, test } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000201";
const productId = "00000000-0000-4000-8000-000000000202";
test("seller sees simulated statistics and filters reviews (mock API)", async ({
  page,
}) => {
  let filter = "";
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "seller-token" } } });
    if (path === "/users/me")
      return route.fulfill({
        json: {
          data: {
            id: shopId,
            fullName: "Seller",
            email: "seller@example.test",
            roles: ["BUYER"],
            status: "ACTIVE",
            phone: null,
            avatar: null,
          },
        },
      });
    if (path === `/shops/${shopId}/stats`)
      return route.fulfill({
        json: {
          data: {
            shopId,
            productCount: 2,
            pendingCount: 1,
            processingCount: 2,
            completedCount: 3,
            completedRevenue: "303",
            currency: "VND",
            simulated: true,
            timezone: "Asia/Saigon",
          },
        },
      });
    if (path === `/shops/${shopId}/revenue`)
      return route.fulfill({
        json: {
          data: {
            shopId,
            groupBy: url.searchParams.get("groupBy"),
            points: [
              {
                period:
                  url.searchParams.get("groupBy") === "MONTH"
                    ? "2026-10"
                    : "2026-10-27",
                completedCount: 1,
                revenue: "303",
              },
            ],
            totalRevenue: "303",
            currency: "VND",
            simulated: true,
            timezone: "Asia/Saigon",
          },
        },
      });
    if (path === `/shops/${shopId}/reviews`) {
      filter = url.search;
      return route.fulfill({
        json: {
          data: [
            {
              id: productId,
              productId,
              buyerDisplayName: "Buyer",
              rating: 5,
              comment: "Rất tốt",
              createdAt: "2026-10-27T00:00:00Z",
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1 },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto(`/shops/${shopId}/dashboard`);
  await expect(page.getByText(/mô phỏng/i).first()).toBeVisible();
  await expect(page.getByText("303", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Nhóm doanh thu").selectOption("MONTH");
  await expect(page.getByText("2026-10", { exact: true })).toBeVisible();
  await page.getByLabel("Mã sản phẩm").fill(productId);
  await page.getByLabel("Lọc số sao").selectOption("5");
  await page.getByRole("button", { name: "Lọc đánh giá" }).click();
  await expect(page.getByText("Rất tốt")).toBeVisible();
  expect(filter).toContain(`productId=${productId}`);
  expect(filter).toContain("rating=5");
});
