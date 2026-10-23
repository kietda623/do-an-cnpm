import { expect, test } from "@playwright/test";

const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "E2E Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
};
const shop = {
  id: "00000000-0000-4000-8000-000000000010",
  name: "E2E Shop",
  slug: "e2e-shop",
  description: "Test shop",
  contactAddress: "Test address",
  phone: "0901234567",
  logo: { id: "00000000-0000-4000-8000-000000000011", url: "https://assets.example.test/logo.png" },
  banner: null,
  status: "PENDING",
  rejectionReason: null,
  approvedAt: null,
  version: 0,
};

test("a buyer can sign in to Seller Center and submit a shop application", async ({ page }) => {
  let created = false;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login"))
      return route.fulfill({ json: { data: { accessToken: "token", user: buyer } } });
    if (path.endsWith("/users/me/shops"))
      return route.fulfill({
        json: {
          data: created
            ? [{ shopId: shop.id, shopName: shop.name, shopStatus: shop.status, role: "OWNER" }]
            : [],
        },
      });
    if (path.endsWith("/users/me/assets"))
      return route.fulfill({ status: 201, json: { data: shop.logo } });
    if (path.endsWith("/shops") && request.method() === "POST") {
      created = true;
      return route.fulfill({ status: 201, json: { data: shop } });
    }
    if (path.endsWith(`/shops/${shop.id}/management`))
      return route.fulfill({ json: { data: shop } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(buyer.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("link", { name: /cửa hàng của tôi/i }).click();
  await page.getByLabel(/tên cửa hàng/i).fill(shop.name);
  await page.getByLabel(/đường dẫn/i).fill(shop.slug);
  await page.getByLabel(/mô tả/i).fill(shop.description);
  await page.getByLabel(/địa chỉ liên hệ/i).fill(shop.contactAddress);
  await page.getByLabel(/số điện thoại/i).fill(shop.phone);
  await page
    .locator('input[name="logo"]')
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("image") });
  await page.getByRole("button", { name: /gửi hồ sơ đăng ký/i }).click();
  await expect(page.getByRole("status")).toContainText(/đang chờ/i);
  await expect(page.getByText("PENDING")).toBeVisible();
});
