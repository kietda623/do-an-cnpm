import { expect, test } from "@playwright/test";

const productId = "00000000-0000-4000-8000-000000000030";
const variantId = "00000000-0000-4000-8000-000000000040";
const shopId = "00000000-0000-4000-8000-000000000010";
const itemId = "00000000-0000-4000-8000-000000000050";
const addressId = "00000000-0000-4000-8000-000000000060";
const orderId = "00000000-0000-4000-8000-000000000070";
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
const product = {
  id: productId,
  name: "Linen Shirt",
  description: "Soft linen shirt",
  minimumPrice: "250000",
  shop: { id: shopId, name: "Linen Shop", slug: "linen-shop" },
  images: [],
  variants: [
    {
      id: variantId,
      sku: "LINEN-M",
      attributes: { size: "M" },
      price: "250000",
      availableQuantity: 3,
    },
  ],
};
const order = {
  id: orderId,
  orderNumber: "ORD-E2E-070",
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "COD",
  originalTotal: "250000",
  createdAt: "2026-10-23T00:00:00.000Z",
  paymentDeadline: null,
  sellerOrders: [
    {
      id: "00000000-0000-4000-8000-000000000071",
      shopId,
      shopNameSnapshot: "Linen Shop",
      status: "PENDING",
      originalTotal: "250000",
      addressSnapshot: {
        recipientName: "E2E Buyer",
        phone: "0901234567",
        line1: "1 Test Street",
        ward: "Ward 1",
        district: "District 1",
        province: "HCMC",
        country: "VN",
        postalCode: null,
      },
      items: [
        {
          productId,
          productName: "Linen Shirt",
          sku: "LINEN-M",
          attributes: { size: "M" },
          quantity: 1,
          unitPrice: "250000",
          lineTotal: "250000",
        },
      ],
    },
  ],
};

test("buyer adds a product, confirms a quote, places an order and sees its snapshot", async ({
  page,
}) => {
  let cartHasItem = false;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login"))
      return route.fulfill({
        json: { data: { accessToken: "access", refreshToken: "refresh", user: buyer } },
      });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({ json: { data: { accessToken: "access", user: buyer } } });
    if (path.endsWith("/users/me")) return route.fulfill({ json: { data: buyer } });
    if (path.endsWith(`/products/${productId}`)) return route.fulfill({ json: { data: product } });
    if (path.endsWith("/cart/items") && request.method() === "POST") {
      cartHasItem = true;
      return route.fulfill({ status: 201, json: { data: {} } });
    }
    if (path.endsWith("/cart") || path.endsWith("/cart/items")) {
      const items = cartHasItem
        ? [
            {
              id: itemId,
              variantId,
              productId,
              shopId,
              productName: product.name,
              sku: "LINEN-M",
              attributes: { size: "M" },
              currentUnitPrice: "250000",
              quantity: 1,
              selected: true,
              availableQuantity: 3,
              purchasable: true,
              unavailableReason: null,
            },
          ]
        : [];
      return route.fulfill({
        json: {
          data: {
            id: "cart",
            version: 1,
            groups: items.length
              ? [{ shopId, shopName: "Linen Shop", items, selectedSubtotal: "250000" }]
              : [],
            selectedTotal: items.length ? "250000" : "0",
            currency: "VND",
          },
        },
      });
    }
    if (path.endsWith("/users/me/addresses"))
      return route.fulfill({
        json: {
          data: [
            {
              id: addressId,
              recipientName: "E2E Buyer",
              phone: "0901234567",
              line1: "1 Test Street",
              ward: "Ward 1",
              district: "District 1",
              province: "HCMC",
              country: "VN",
              isDefault: true,
            },
          ],
        },
      });
    if (path.endsWith("/checkout/quotes"))
      return route.fulfill({
        status: 201,
        json: {
          data: {
            quoteId: "00000000-0000-4000-8000-000000000080",
            expiresAt: "2099-10-23T01:00:00.000Z",
            lines: [],
            groups: [],
            addressSnapshot: {
              recipientName: "E2E Buyer",
              phone: "0901234567",
              line1: "1 Test Street",
              ward: "Ward 1",
              district: "District 1",
              province: "HCMC",
              country: "VN",
              postalCode: null,
            },
            total: "250000",
            currency: "VND",
            valid: true,
            issues: [],
            lines: [],
          },
        },
      });
    if (path.endsWith("/checkout")) {
      expect(request.headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
      return route.fulfill({ status: 201, json: { data: { id: orderId } } });
    }
    if (path.endsWith(`/orders/${orderId}`)) return route.fulfill({ json: { data: order } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });

  await page.goto(`/login?returnTo=${encodeURIComponent(`/products/${productId}`)}`);
  await page.getByLabel("Email").fill("buyer@example.test");
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByRole("heading", { name: product.name })).toBeVisible();
  await page.getByRole("button", { name: "Thêm vào giỏ hàng" }).click();
  await expect(page.getByText("Đã thêm vào giỏ")).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("link", { name: product.name })).toBeVisible();
  await page.getByRole("link", { name: "Tiến hành đặt hàng" }).click();
  await expect(page.getByRole("heading", { name: "Thanh toán", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Kiểm tra giá và tồn kho" }).click();
  await expect(page.getByText("250.000₫").first()).toBeVisible();
  await page.getByRole("button", { name: "Đặt hàng" }).click();
  await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();
  await expect(page.getByText("1 Test Street, Ward 1, District 1, HCMC")).toBeVisible();
  await expect(page.getByText("Linen Shop", { exact: true })).toBeVisible();
});
