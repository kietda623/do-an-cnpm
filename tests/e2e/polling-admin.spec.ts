import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

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

const auditRow = {
  id: "audit-1",
  action: "shop.approved",
  resourceType: "Shop",
  resourceId: pendingShop.id,
  reason: "Policy review",
  actorId: admin.id,
  requestId: "abcdef12-3456-7890-abcd-ef1234567890",
  createdAt: "2026-10-27T10:00:00.000Z",
  metadata: {},
};

function platformStats(userCount: number) {
  return {
    userCount,
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
  };
}

type ApiHandler = (route: Route, path: string, url: URL) => Promise<boolean>;

async function mockAdminApi(page: Page, handle: ApiHandler) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (await handle(route, path, url)) return;
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "e2e-csrf-token" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: admin } } });
    if (path === "/users/me") return route.fulfill({ json: { data: admin } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("admin dashboard refreshes stats, queue and audit every 60s", async ({ page }) => {
  await page.clock.install();
  let statsCalls = 0;
  let shopsCalls = 0;
  let auditCalls = 0;
  let refreshed = false;

  await mockAdminApi(page, async (route, path) => {
    if (path === "/admin/stats") {
      statsCalls += 1;
      await route.fulfill({ json: { data: platformStats(refreshed ? 13 : 12) } });
      return true;
    }
    if (path === "/admin/shops") {
      shopsCalls += 1;
      await route.fulfill({
        json: { data: [pendingShop], meta: { page: 1, pageSize: 5, total: 1 } },
      });
      return true;
    }
    if (path === "/admin/audit") {
      auditCalls += 1;
      await route.fulfill({ json: { data: [auditRow], meta: { page: 1, pageSize: 8, total: 1 } } });
      return true;
    }
    return false;
  });

  await page.goto("/");
  const kpi = page.getByRole("region", { name: "Thống kê nền tảng" });
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Người dùng" })).toContainText("12");
  const initialStatsCalls = statsCalls;
  const initialShopsCalls = shopsCalls;
  const initialAuditCalls = auditCalls;

  refreshed = true;
  await page.clock.runFor(60_000);
  await expect.poll(() => statsCalls).toBeGreaterThan(initialStatsCalls);
  await expect(kpi.locator(".mp-stat").filter({ hasText: "Người dùng" })).toContainText("13");
  await expect.poll(() => shopsCalls).toBeGreaterThan(initialShopsCalls);
  await expect.poll(() => auditCalls).toBeGreaterThan(initialAuditCalls);
});

test("admin shop queue refreshes every 30s and pauses while a review dialog is open", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;

  await mockAdminApi(page, async (route, path) => {
    if (path !== "/admin/shops" || route.request().method() !== "GET") return false;
    calls += 1;
    await route.fulfill({
      json: { data: [pendingShop], meta: { page: 1, pageSize: 20, total: 1 } },
    });
    return true;
  });

  await page.goto("/shops");
  await expect(page.getByText("Linen Shop")).toBeVisible();
  const initialCalls = calls;

  await page.clock.runFor(30_000);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);

  await page.getByRole("button", { name: "Duyệt", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const pausedCalls = calls;

  await page.clock.runFor(65_000);
  await page.waitForTimeout(500);
  expect(calls).toBe(pausedCalls);

  await page.getByRole("button", { name: "Hủy" }).click();
  await page.clock.runFor(30_000);
  await expect.poll(() => calls).toBeGreaterThan(pausedCalls);
});

test("admin audit refreshes every 60s and pauses while the detail dialog is open", async ({
  page,
}) => {
  await page.clock.install();
  let calls = 0;

  await mockAdminApi(page, async (route, path) => {
    if (path !== "/admin/audit" || route.request().method() !== "GET") return false;
    calls += 1;
    await route.fulfill({ json: { data: [auditRow], meta: { page: 1, pageSize: 20, total: 1 } } });
    return true;
  });

  await page.goto("/audit");
  await expect(page.getByText("shop.approved")).toBeVisible();
  const initialCalls = calls;

  await page.clock.runFor(60_000);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);

  await page.getByRole("button", { name: "Chi tiết" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const pausedCalls = calls;

  await page.clock.runFor(65_000);
  await page.waitForTimeout(500);
  expect(calls).toBe(pausedCalls);
});
