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

const pendingOrder = {
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

const confirmedOrder = {
  ...pendingOrder,
  id: "00000000-0000-4000-8000-000000000511",
  status: "CONFIRMED",
  version: 2,
  items: [
    { id: "00000000-0000-4000-8000-000000000512", productName: "Túi vải", quantity: 2 },
  ],
};

type Calls = {
  statuses: Array<string | null>;
  confirmBody: Record<string, unknown> | null;
  rejectBody: Record<string, unknown> | null;
};

async function mockOrders(page: Page, calls: Calls) {
  let rows = [pendingOrder, confirmedOrder];
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
          data: [{ shopId, shopName: "Cửa hàng Một", shopStatus: "ACTIVE", role: "OWNER" }],
        },
      });
    if (path === `/shops/${shopId}/orders` && route.request().method() === "GET") {
      const status = url.searchParams.get("status");
      calls.statuses.push(status);
      return route.fulfill({
        json: { data: status ? rows.filter((row) => row.status === status) : rows },
      });
    }
    if (path === `/shops/${shopId}/orders/${pendingOrder.id}/confirm`) {
      calls.confirmBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      rows = rows.map((row) => (row.id === pendingOrder.id ? { ...row, status: "CONFIRMED" } : row));
      return route.fulfill({ json: { data: { ...pendingOrder, status: "CONFIRMED" } } });
    }
    if (path === `/shops/${shopId}/orders/${confirmedOrder.id}/reject`) {
      calls.rejectBody = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      return route.fulfill({ json: { data: { ...confirmedOrder, status: "CANCELLED" } } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("seller order queue filters by tab and confirms a pending part", async ({ page }) => {
  const calls: Calls = { statuses: [], confirmBody: null, rejectBody: null };
  await mockOrders(page, calls);
  await page.goto(`/shops/${shopId}/orders`);

  await expect(page.getByRole("heading", { name: "Xử lý đơn hàng" })).toBeVisible();
  await expect(page.getByText(`Đơn ${pendingOrder.id}`)).toBeVisible();
  await expect(page.getByText(`Đơn ${confirmedOrder.id}`)).toBeVisible();

  await page.getByRole("tab", { name: "Chờ xác nhận" }).click();
  await expect.poll(() => calls.statuses.at(-1)).toBe("PENDING");
  await expect(page.getByText(`Đơn ${pendingOrder.id}`)).toBeVisible();
  await expect(page.getByText(`Đơn ${confirmedOrder.id}`)).toBeHidden();

  await page.getByRole("tab", { name: "Tất cả" }).click();
  await expect.poll(() => calls.statuses.at(-1)).toBeNull();

  await page
    .locator(".mp-panel")
    .filter({ hasText: pendingOrder.id })
    .getByRole("button", { name: "Xác nhận đơn" })
    .click();

  await expect.poll(() => calls.confirmBody).not.toBeNull();
  expect(calls.confirmBody).toEqual({ expectedVersion: 1 });

  await expect(
    page
      .locator(".mp-panel")
      .filter({ hasText: pendingOrder.id })
      .getByRole("button", { name: "Đã đóng gói" }),
  ).toBeVisible();
});

test("seller must give a reason before rejecting a part order", async ({ page }) => {
  const calls: Calls = { statuses: [], confirmBody: null, rejectBody: null };
  await mockOrders(page, calls);
  await page.goto(`/shops/${shopId}/orders`);

  const target = page.locator(".mp-panel").filter({ hasText: confirmedOrder.id });
  const reject = target.getByRole("button", { name: "Từ chối đơn" });
  await expect(reject).toBeDisabled();

  await page
    .getByLabel("Lý do cho từ chối/giao thất bại/giao lại")
    .fill("Người nhận không nghe máy");
  await expect(reject).toBeEnabled();
  await reject.click();

  await expect.poll(() => calls.rejectBody).not.toBeNull();
  expect(calls.rejectBody).toEqual({
    reason: "Người nhận không nghe máy",
    expectedVersion: 2,
  });
});
