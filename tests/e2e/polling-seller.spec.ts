import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

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

const partA = {
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

const membership = {
  shopId,
  shopName: "Cửa hàng Một",
  shopStatus: "PENDING",
  role: "OWNER",
};

function shop(status: string, version = 0) {
  return {
    id: shopId,
    name: "Cửa hàng Một",
    slug: "cua-hang-mot",
    description: "Mô tả",
    contactAddress: "1 Test Street",
    phone: "0901234567",
    logo: { id: "logo", url: "https://assets.example.test/logo.png" },
    banner: null,
    status,
    rejectionReason: null,
    approvedAt: status === "ACTIVE" ? "2026-11-02T00:00:00.000Z" : null,
    version,
  };
}

function stats(pendingCount: number) {
  return {
    shopId,
    productCount: 7,
    pendingCount,
    processingCount: 3,
    completedCount: 12,
    completedRevenue: "1500000",
    currency: "VND",
    simulated: true,
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-11-01T00:00:00.000Z",
    timezone: "Asia/Saigon",
  };
}

function revenue() {
  return {
    shopId,
    groupBy: "DAY",
    points: [{ period: "2026-10-27", completedCount: 1, revenue: "500000" }],
    totalRevenue: "500000",
    currency: "VND",
    simulated: true,
    timezone: "Asia/Saigon",
  };
}

type ApiHandler = (route: Route, path: string, url: URL) => Promise<boolean>;

async function mockSellerApi(page: Page, handle: ApiHandler) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (await handle(route, path, url)) return;
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "e2e-csrf-token" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: seller } } });
    if (path === "/users/me") return route.fulfill({ json: { data: seller } });
    if (path === "/users/me/shops") return route.fulfill({ json: { data: [membership] } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("seller order queue refreshes every 30s without a loading flash", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let gateNext = false;
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });

  await mockSellerApi(page, async (route, path) => {
    if (path !== `/shops/${shopId}/orders` || route.request().method() !== "GET") return false;
    calls += 1;
    const polling = gateNext;
    if (polling) await secondGate;
    const status = polling ? "CONFIRMED" : "PENDING";
    await route.fulfill({ json: { data: [{ ...partA, status, version: calls }] } });
    return true;
  });

  await page.goto(`/shops/${shopId}/orders`);
  await expect(page.getByText("Áo linen xanh")).toBeVisible();
  await expect(page.locator(".mp-badge").filter({ hasText: "Chờ xác nhận" })).toBeVisible();
  const initialCalls = calls;

  gateNext = true;
  await page.clock.runFor(30_000);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);
  await expect(page.locator(".mp-skeleton--block")).toHaveCount(0);

  releaseSecond();
  await expect(page.locator(".mp-badge").filter({ hasText: "Đã xác nhận" })).toBeVisible();
});

test("seller dashboard refreshes stats and recent orders every 60s", async ({ page }) => {
  await page.clock.install();
  let statsCalls = 0;
  let orderCalls = 0;

  await mockSellerApi(page, async (route, path) => {
    if (path === `/shops/${shopId}/stats`) {
      statsCalls += 1;
      await route.fulfill({ json: { data: stats(statsCalls === 1 ? 2 : 5) } });
      return true;
    }
    if (path === `/shops/${shopId}/revenue`) {
      await route.fulfill({ json: { data: revenue() } });
      return true;
    }
    if (path === `/shops/${shopId}/orders`) {
      orderCalls += 1;
      await route.fulfill({ json: { data: [partA] } });
      return true;
    }
    return false;
  });

  await page.goto(`/shops/${shopId}/dashboard`);
  const kpi = page.getByRole("region", { name: "Thống kê cửa hàng" });
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Chờ xác nhận" })).toContainText("2");
  const initialStatsCalls = statsCalls;
  const initialOrderCalls = orderCalls;

  await page.clock.runFor(60_000);
  await expect.poll(() => statsCalls).toBeGreaterThan(initialStatsCalls);
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Chờ xác nhận" })).toContainText("5");
  await expect.poll(() => orderCalls).toBeGreaterThan(initialOrderCalls);
});

test("pending shop status refreshes without resetting the selected shop", async ({ page }) => {
  await page.clock.install();
  let membershipCalls = 0;
  let managementCalls = 0;
  let approved = false;

  await mockSellerApi(page, async (route, path) => {
    if (path === "/users/me/shops") {
      membershipCalls += 1;
      await route.fulfill({ json: { data: [membership] } });
      return true;
    }
    if (path === `/shops/${shopId}/management`) {
      managementCalls += 1;
      await route.fulfill({
        json: { data: shop(approved ? "ACTIVE" : "PENDING", approved ? 1 : 0) },
      });
      return true;
    }
    return false;
  });

  await page.goto("/shops");
  const pendingNotice = page.getByText("Hồ sơ cửa hàng đang chờ quản trị viên duyệt.");
  await expect(pendingNotice).toBeVisible();
  const initialMembershipCalls = membershipCalls;
  const initialManagementCalls = managementCalls;

  approved = true;
  await page.clock.runFor(30_000);
  await expect.poll(() => managementCalls).toBeGreaterThan(initialManagementCalls);
  await expect(pendingNotice).toHaveCount(0);
  expect(membershipCalls).toBe(initialMembershipCalls);
});
