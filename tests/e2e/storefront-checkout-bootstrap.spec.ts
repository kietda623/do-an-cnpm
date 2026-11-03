import { expect, test, type Page, type Route } from "@playwright/test";

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

const address = {
  id: "00000000-0000-4000-8000-000000000060",
  recipientName: "E2E Buyer",
  phone: "0901234567",
  line1: "1 Test Street",
  ward: "Ward 1",
  district: "District 1",
  province: "HCMC",
  country: "VN",
  isDefault: true,
};

type BootstrapOptions = {
  refreshStatus?: number;
  addressStatus?: number;
};

type BootstrapState = {
  addressStatus: number;
};

async function mockCheckoutBootstrap(
  page: Page,
  options: BootstrapOptions = {},
): Promise<BootstrapState> {
  const state: BootstrapState = {
    addressStatus: options.addressStatus ?? 200,
  };
  await page.route("**/api/v1/**", async (route: Route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return options.refreshStatus === 401
        ? route.fulfill({
            status: 401,
            json: {
              error: { code: "UNAUTHORIZED", message: "Unauthorized" },
            },
          })
        : route.fulfill({
            json: { data: { accessToken: "access", user: buyer } },
          });
    if (path.endsWith("/users/me"))
      return route.fulfill({ json: { data: buyer } });
    if (path.endsWith("/users/me/addresses")) {
      if (state.addressStatus === 500)
        return route.fulfill({
          status: 500,
          json: { error: { code: "INTERNAL_ERROR", message: "Internal" } },
        });
      return route.fulfill({ json: { data: [address] } });
    }
    if (path.endsWith("/cart"))
      return route.fulfill({
        json: {
          data: {
            id: "cart",
            version: 1,
            groups: [],
            selectedTotal: "0",
            currency: "VND",
          },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  return state;
}

test("checkout keeps the session and retries after a server error", async ({
  page,
}) => {
  const state = await mockCheckoutBootstrap(page, { addressStatus: 500 });

  await page.goto("/checkout");
  await expect(
    page.getByRole("alert").filter({ hasText: "Không thể tải thông tin thanh toán" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/checkout$/);

  state.addressStatus = 200;
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(
    page.getByRole("button", { name: "Kiểm tra giá và tồn kho" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/checkout$/);
});

test("checkout redirects to login only when the restored session is rejected", async ({
  page,
}) => {
  await mockCheckoutBootstrap(page, { refreshStatus: 401 });

  await page.goto("/checkout");
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout/);
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();
});
