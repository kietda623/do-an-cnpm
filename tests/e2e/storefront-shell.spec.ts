import { expect, test, type Page } from "@playwright/test";

const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "E2E Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
};

async function mockShell(page: Page, { authenticated }: { authenticated: boolean }) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return authenticated
        ? route.fulfill({ json: { data: { accessToken: "access", user: buyer } } })
        : route.fulfill({
            status: 401,
            json: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
          });
    if (path.endsWith("/users/me")) return route.fulfill({ json: { data: buyer } });
    if (path.endsWith("/cart"))
      return route.fulfill({
        json: {
          data: {
            id: "cart",
            version: 1,
            groups: [{ items: [{ quantity: 2 }, { quantity: 1 }] }],
            selectedTotal: "0",
            currency: "VND",
          },
        },
      });
    if (path.endsWith("/categories")) return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/products"))
      return route.fulfill({
        json: { data: [], meta: { page: 1, pageSize: 20, total: 0 } },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("guest header search, footer and mobile drawer expose working navigation", async ({
  page,
}) => {
  await mockShell(page, { authenticated: false });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("link", { name: "sopi — trang chủ" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Danh mục chính" }).getByRole("link", { name: "Sản phẩm" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập" }).first()).toBeVisible();

  await page.getByLabel("Tìm trên sopi").fill("linen");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  await expect(page).toHaveURL(/\/products\?q=linen/);

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByRole("navigation", { name: "Mua sắm" }).getByRole("link")).toHaveCount(3);
  await expect(footer.getByRole("link", { name: "Sổ địa chỉ" })).toBeVisible();
  await expect(footer.getByText("Giá và tồn kho được xác nhận lại khi thanh toán.")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('summary[aria-label="Mở menu"]').click();
  const mobileNav = page.getByRole("navigation", {
    name: "Điều hướng trên thiết bị di động",
  });
  await expect(mobileNav.getByRole("link", { name: "Trang chủ" })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Giỏ hàng" })).toBeVisible();
  await expect(
    page.locator(".mp-mobile-menu__panel").getByRole("link", { name: "Đăng nhập" }),
  ).toBeVisible();
});

test("signed-in header shows cart badge and account menu", async ({ page }) => {
  await mockShell(page, { authenticated: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const cartLink = page.getByRole("link", { name: "Giỏ hàng, 3 sản phẩm" });
  await expect(cartLink).toBeVisible();
  await expect(cartLink).toHaveAttribute("href", "/cart");

  await page.locator("summary.mp-account").click();
  const accountMenu = page.locator(".mp-menu__panel");
  await expect(accountMenu.getByText("E2E Buyer")).toBeVisible();
  await expect(accountMenu.getByText("buyer@example.test")).toBeVisible();
  await expect(accountMenu.getByRole("link", { name: "Tài khoản" })).toHaveAttribute(
    "href",
    "/account",
  );
  await expect(accountMenu.getByRole("link", { name: "Sổ địa chỉ" })).toBeVisible();
  await expect(accountMenu.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
});
