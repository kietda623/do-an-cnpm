import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "E2E Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
};

const tokens = { accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token", user: buyer };

const orderA = {
  id: "00000000-0000-4000-8000-000000000201",
  orderNumber: "ORD-1001",
  status: "PENDING",
  paymentStatus: "UNPAID",
  originalTotal: "100000",
  createdAt: "2026-11-01T00:00:00.000Z",
};

const orderB = {
  ...orderA,
  id: "00000000-0000-4000-8000-000000000202",
  orderNumber: "ORD-1002",
};

function orderDetail(status: string, paymentStatus: string) {
  return {
    orderNumber: "ORD-2001",
    status,
    paymentMethod: "MOCK",
    originalTotal: "100000",
    paymentDeadline: "2026-11-07T09:00:00.000Z",
    paymentStatus,
    outstandingAmount: status === "CANCELLED" ? "0" : "100000",
    version: 0,
    createdAt: "2026-11-01T00:00:00.000Z",
    sellerOrders: [],
  };
}

const paymentAttempt = {
  id: "00000000-0000-4000-8000-000000000401",
  status: "PENDING",
  settlementKind: "CAPTURE",
  amount: "100000",
  transactionCode: "MOCK-POLL-1",
  refunds: [],
};

type ApiHandler = (route: Route, path: string, url: URL) => Promise<boolean>;

async function mockBuyerApi(page: Page, handle: ApiHandler) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (await handle(route, path, url)) return;
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "e2e-csrf-token" } } });
    if (path === "/auth/refresh") return route.fulfill({ json: { data: tokens } });
    if (path === "/users/me") return route.fulfill({ json: { data: buyer } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

async function installVisibilityControl(page: Page) {
  await page.addInitScript(() => {
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    const target = window as unknown as { __setTabHidden?: (value: boolean) => void };
    target.__setTabHidden = (value: boolean) => {
      hidden = value;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
}

async function setTabHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    const target = window as unknown as { __setTabHidden: (next: boolean) => void };
    target.__setTabHidden(value);
  }, hidden);
}

test("orders list refreshes every 30s without a loading flash", async ({ page }) => {
  await page.clock.install();
  let calls = 0;
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => {
    releaseSecond = resolve;
  });

  await mockBuyerApi(page, async (route, path) => {
    if (path !== "/orders" || route.request().method() !== "GET") return false;
    calls += 1;
    if (calls === 2) await secondGate;
    await route.fulfill({ json: { data: calls === 1 ? [orderA] : [orderA, orderB] } });
    return true;
  });

  await page.goto("/orders");
  await expect(page.getByText("ORD-1001")).toBeVisible();
  expect(calls).toBe(1);

  await page.clock.runFor(30_000);
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

  releaseSecond();
  await expect(page.getByText("ORD-1002")).toBeVisible();
});

test("payment attempts refresh every 10s while a mock payment is pending", async ({ page }) => {
  await page.clock.install();
  let paymentCalls = 0;

  await mockBuyerApi(page, async (route, path) => {
    if (path === `/orders/${orderA.id}` && route.request().method() === "GET") {
      await route.fulfill({ json: { data: orderDetail("PENDING", "UNPAID") } });
      return true;
    }
    if (path === "/payments" && route.request().method() === "GET") {
      paymentCalls += 1;
      await route.fulfill({ json: { data: paymentCalls === 1 ? [] : [paymentAttempt] } });
      return true;
    }
    return false;
  });

  await page.goto(`/orders/${orderA.id}`);
  await expect(page.getByText("Thanh toán", { exact: true })).toBeVisible();
  const initialCalls = paymentCalls;
  expect(initialCalls).toBeGreaterThanOrEqual(1);

  await page.clock.runFor(10_000);

  await expect.poll(() => paymentCalls).toBe(initialCalls + 1);
  await expect(page.getByText("MOCK-POLL-1")).toBeVisible();
});

test("completed order detail stops polling", async ({ page }) => {
  await page.clock.install();
  let orderCalls = 0;

  await mockBuyerApi(page, async (route, path) => {
    if (path === `/orders/${orderA.id}` && route.request().method() === "GET") {
      orderCalls += 1;
      await route.fulfill({ json: { data: orderDetail("COMPLETED", "PAID") } });
      return true;
    }
    if (path === "/payments" && route.request().method() === "GET") {
      await route.fulfill({ json: { data: [] } });
      return true;
    }
    return false;
  });

  await page.goto(`/orders/${orderA.id}`);
  await expect(page.getByText("ORD-2001")).toBeVisible();
  expect(orderCalls).toBe(1);

  await page.clock.runFor(31_000);
  await page.waitForTimeout(500);

  expect(orderCalls).toBe(1);
});

test("orders list pauses while the tab is hidden and refreshes when it returns", async ({ page }) => {
  await page.clock.install();
  await installVisibilityControl(page);
  let calls = 0;

  await mockBuyerApi(page, async (route, path) => {
    if (path !== "/orders" || route.request().method() !== "GET") return false;
    calls += 1;
    await route.fulfill({ json: { data: [orderA] } });
    return true;
  });

  await page.goto("/orders");
  await expect(page.getByText("ORD-1001")).toBeVisible();
  expect(calls).toBe(1);

  await setTabHidden(page, true);
  await page.clock.runFor(65_000);
  await page.waitForTimeout(500);
  expect(calls).toBe(1);

  await setTabHidden(page, false);
  await expect.poll(() => calls).toBe(2);
});

