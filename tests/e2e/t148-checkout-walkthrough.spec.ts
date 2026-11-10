import { expect, test, type Page } from "@playwright/test";

const shopOneId = "00000000-0000-4000-8000-000000000010";
const shopTwoId = "00000000-0000-4000-8000-000000000011";
const orderId = "00000000-0000-4000-8000-000000000070";
const addressId = "00000000-0000-4000-8000-000000000060";

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
  id: addressId,
  recipientName: "E2E Buyer",
  phone: "0901234567",
  line1: "1 Test Street",
  ward: "Ward 1",
  district: "District 1",
  province: "HCMC",
  country: "VN",
  isDefault: true,
};

const cartItems = [
  {
    id: "00000000-0000-4000-8000-000000000050",
    variantId: "00000000-0000-4000-8000-000000000040",
    productId: "00000000-0000-4000-8000-000000000030",
    productName: "Demo Product 01-001",
    sku: "DEMO-01-001",
    attributes: {},
    currentUnitPrice: "250000",
    quantity: 1,
    selected: true,
    availableQuantity: 25,
    purchasable: true,
    unavailableReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000051",
    variantId: "00000000-0000-4000-8000-000000000041",
    productId: "00000000-0000-4000-8000-000000000031",
    productName: "Demo Product 01-002",
    sku: "DEMO-01-002",
    attributes: {},
    currentUnitPrice: "250000",
    quantity: 1,
    selected: true,
    availableQuantity: 25,
    purchasable: true,
    unavailableReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000052",
    variantId: "00000000-0000-4000-8000-000000000042",
    productId: "00000000-0000-4000-8000-000000000032",
    productName: "Demo Product 01-003",
    sku: "DEMO-01-003",
    attributes: {},
    currentUnitPrice: "250000",
    quantity: 1,
    selected: true,
    availableQuantity: 25,
    purchasable: true,
    unavailableReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000053",
    variantId: "00000000-0000-4000-8000-000000000043",
    productId: "00000000-0000-4000-8000-000000000033",
    productName: "Demo Product 01-004",
    sku: "DEMO-01-004",
    attributes: {},
    currentUnitPrice: "250000",
    quantity: 1,
    selected: true,
    availableQuantity: 25,
    purchasable: true,
    unavailableReason: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000054",
    variantId: "00000000-0000-4000-8000-000000000044",
    productId: "00000000-0000-4000-8000-000000000034",
    productName: "Demo Product 02-001",
    sku: "DEMO-02-001",
    attributes: {},
    currentUnitPrice: "250000",
    quantity: 1,
    selected: true,
    availableQuantity: 25,
    purchasable: true,
    unavailableReason: null,
  },
];

const cart = {
  groups: [
    {
      shopId: shopOneId,
      shopName: "Demo Shop 01",
      items: cartItems.slice(0, 4),
      selectedSubtotal: "1000000",
    },
    {
      shopId: shopTwoId,
      shopName: "Demo Shop 02",
      items: cartItems.slice(4),
      selectedSubtotal: "250000",
    },
  ],
  selectedTotal: "1250000",
  currency: "VND",
};

const addressSnapshot = {
  recipientName: address.recipientName,
  phone: address.phone,
  line1: address.line1,
  ward: address.ward,
  district: address.district,
  province: address.province,
  country: "VN",
  postalCode: null,
};

const order = {
  id: orderId,
  orderNumber: "ORD-T148-070",
  status: "PENDING",
  paymentStatus: "UNPAID",
  paymentMethod: "COD",
  originalTotal: "1250000",
  outstandingAmount: "1250000",
  version: 0,
  createdAt: "2026-10-23T00:00:00.000Z",
  paymentDeadline: null,
  sellerOrders: [
    {
      id: "00000000-0000-4000-8000-000000000071",
      shopId: shopOneId,
      shopNameSnapshot: "Demo Shop 01",
      status: "PENDING",
      originalTotal: "1000000",
      version: 0,
      cancelledAt: null,
      cancelReason: null,
      capturedAmount: "0",
      refundedAmount: "0",
      outstandingAmount: "1000000",
      shipment: null,
      addressSnapshot,
      items: cartItems.slice(0, 4).map((item, index) => ({
        id: `00000000-0000-4000-8000-00000000008${index}`,
        reviewId: null,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        attributes: item.attributes,
        quantity: 1,
        unitPrice: "250000",
        lineTotal: "250000",
      })),
    },
    {
      id: "00000000-0000-4000-8000-000000000072",
      shopId: shopTwoId,
      shopNameSnapshot: "Demo Shop 02",
      status: "PENDING",
      originalTotal: "250000",
      version: 0,
      cancelledAt: null,
      cancelReason: null,
      capturedAmount: "0",
      refundedAmount: "0",
      outstandingAmount: "250000",
      shipment: null,
      addressSnapshot,
      items: cartItems.slice(4).map((item) => ({
        id: "00000000-0000-4000-8000-000000000084",
        reviewId: null,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        attributes: item.attributes,
        quantity: 1,
        unitPrice: "250000",
        lineTotal: "250000",
      })),
    },
  ],
};

type CheckoutApiOptions = {
  cartResponse?: typeof cart;
  addresses?: Array<typeof address>;
  quoteValid?: boolean;
  quoteExpiresAt?: string;
  quoteIssues?: Array<{ code: string; message: string }>;
  cartGate?: Promise<void>;
  quoteGate?: Promise<void>;
  checkoutGate?: Promise<void>;
  cartMutationStatus?: number;
};

async function mockCheckoutApi(page: Page, options: CheckoutApiOptions = {}) {
  const cartResponse = options.cartResponse ?? cart;
  const addresses = options.addresses ?? [address];
  let checkoutCount = 0;
  let quoteCount = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({ json: { data: { accessToken: "access", user: buyer } } });
    if (path.endsWith("/users/me"))
      return route.fulfill({ json: { data: buyer } });
    if (path.endsWith("/users/me/addresses"))
      return route.fulfill({ json: { data: addresses } });
    if (path.includes("/cart/items/") && request.method() === "PATCH") {
      if (options.cartMutationStatus) {
        return route.fulfill({
          status: options.cartMutationStatus,
          json: { error: { code: "INTERNAL_ERROR", message: "Internal" } },
        });
      }
      return route.fulfill({ json: { data: cartResponse } });
    }
    if (path.endsWith("/cart")) {
      if (options.cartGate) await options.cartGate;
      return route.fulfill({ json: { data: cartResponse } });
    }
    if (path.endsWith("/checkout/quotes")) {
      quoteCount += 1;
      expect(request.postDataJSON()).toMatchObject({
        cartItemIds: cartItems.map((item) => item.id),
        addressId,
        paymentMethod: "COD",
      });
      if (options.quoteGate) await options.quoteGate;
      return route.fulfill({
        status: 201,
        json: {
          data: {
            quoteId: "00000000-0000-4000-8000-000000000080",
            expiresAt: options.quoteExpiresAt ?? "2099-10-23T01:00:00.000Z",
            lines: cartItems.map((item) => ({
              cartItemId: item.id,
              lineTotal: item.currentUnitPrice,
            })),
            groups: [],
            addressSnapshot,
            total: "1250000",
            currency: "VND",
            valid: options.quoteValid ?? true,
            issues: options.quoteIssues ?? [],
          },
        },
      });
    }
    if (path === "/api/v1/payments")
      return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/checkout")) {
      checkoutCount += 1;
      expect(request.headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/i);
      if (options.checkoutGate) await options.checkoutGate;
      return route.fulfill({ status: 201, json: { data: { id: orderId } } });
    }
    if (path.endsWith(`/orders/${orderId}`))
      return route.fulfill({ json: { data: order } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  return {
    getCheckoutCount: () => checkoutCount,
    getQuoteCount: () => quoteCount,
  };
}

test("T148 completes a five-line checkout across two shops within three minutes", async ({
  page,
}) => {
  let releaseQuote!: () => void;
  let releaseCheckout!: () => void;
  const api = await mockCheckoutApi(page, {
    quoteGate: new Promise<void>((resolve) => (releaseQuote = resolve)),
    checkoutGate: new Promise<void>((resolve) => (releaseCheckout = resolve)),
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Giỏ hàng" })).toBeVisible();
  await expect(page.locator(".mp-cart-item")).toHaveCount(5);
  await expect(page.locator(".mp-cart-group")).toHaveCount(2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  const startedAt = Date.now();
  await page.getByRole("link", { name: "Tiến hành đặt hàng" }).click();
  await expect(page.getByRole("heading", { name: "Thanh toán", exact: true })).toBeVisible();
  await expect(page.getByText("5 sản phẩm đã chọn")).toBeVisible();
  const quoteButton = page.getByRole("button", { name: "Kiểm tra giá và tồn kho" });
  const quoteClick = quoteButton.click();
  await expect(quoteButton).toBeDisabled();
  releaseQuote();
  await quoteClick;
  const orderButton = page.getByRole("button", { name: "Đặt hàng" });
  await expect(orderButton).toBeEnabled();
  const orderClick = orderButton.click();
  await expect(orderButton).toBeDisabled();
  releaseCheckout();
  await orderClick;
  await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();
  const elapsedMs = Date.now() - startedAt;

  await expect(page.getByText("Demo Shop 01", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo Shop 02", { exact: true })).toBeVisible();
  for (const item of cartItems) {
    await expect(page.getByRole("link", { name: item.productName })).toBeVisible();
  }
  expect(api.getQuoteCount()).toBe(1);
  expect(api.getCheckoutCount()).toBe(1);
  expect(elapsedMs).toBeLessThanOrEqual(180_000);
  console.info(`T148 Playwright walkthrough reached order detail in ${elapsedMs}ms.`);
});

test("T148 cart and checkout controls are named and fit 360px and 1280px", async ({
  page,
}) => {
  await mockCheckoutApi(page);
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Giỏ hàng" })).toBeVisible();
  await expect(page.locator(".mp-cart-item")).toHaveCount(5);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  for (const item of cartItems) {
    await expect(page.getByRole("checkbox", { name: `Chọn ${item.productName}` })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: `Số lượng ${item.productName}` })).toBeVisible();
    await expect(page.getByRole("button", { name: `Xóa ${item.productName}` })).toBeVisible();
  }

  const checkoutLink = page.getByRole("link", { name: "Tiến hành đặt hàng" });
  await expect(checkoutLink).toBeVisible();
  await checkoutLink.focus();
  await expect(checkoutLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Thanh toán", exact: true })).toBeVisible();
  await expect(page.getByText("5 sản phẩm đã chọn")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Chọn địa chỉ" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Thanh toán khi nhận hàng/ })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);

  await page.setViewportSize({ width: 1280, height: 900 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Kiểm tra giá và tồn kho" })).toBeVisible();
});

test("T148 exposes loading and empty cart states", async ({ page }) => {
  const emptyCart = { groups: [], selectedTotal: "0", currency: "VND" };
  let releaseCart!: () => void;
  await mockCheckoutApi(page, {
    cartResponse: emptyCart,
    cartGate: new Promise<void>((resolve) => (releaseCart = resolve)),
  });
  await page.goto("/cart");
  await expect(page.locator('.mp-cart[aria-busy="true"]')).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Đang tải giỏ hàng" })).toBeVisible();
  releaseCart();
  await expect(page.getByText("Giỏ hàng đang trống.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Khám phá sản phẩm" })).toBeVisible();
});

test("T148 explains checkout when the buyer has no saved address", async ({ page }) => {
  await mockCheckoutApi(page, { addresses: [] });
  await page.goto("/checkout");
  await expect(page.getByText("Anh chưa có địa chỉ nhận hàng.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Thêm địa chỉ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kiểm tra giá và tồn kho" })).toHaveCount(0);
});

test("T148 shows an invalid quote and keeps order confirmation disabled", async ({ page }) => {
  await mockCheckoutApi(page, {
    quoteValid: false,
    quoteIssues: [{ code: "INSUFFICIENT_STOCK", message: "Tồn kho không đủ" }],
  });
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Kiểm tra giá và tồn kho" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Tồn kho không đủ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đặt hàng" })).toBeDisabled();
});

test("T148 disables order confirmation after a quote expires", async ({ page }) => {
  await mockCheckoutApi(page, { quoteExpiresAt: "2000-01-01T00:00:00.000Z" });
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Kiểm tra giá và tồn kho" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Báo giá đã hết hiệu lực" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đặt hàng" })).toBeDisabled();
});

test("T148 keeps the cart unchanged and announces an update error", async ({ page }) => {
  await mockCheckoutApi(page, { cartMutationStatus: 500 });
  await page.goto("/cart");
  const quantity = page.getByRole("spinbutton", { name: "Số lượng Demo Product 01-001" });
  await page.getByRole("button", { name: "Tăng số lượng Demo Product 01-001" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không cập nhật được giỏ hàng" })).toBeVisible();
  await expect(quantity).toHaveValue("1");
});

test("T148 keeps checkout unavailable when no cart lines are selected", async ({ page }) => {
  const noSelectionCart = {
    ...cart,
    groups: cart.groups.map((group) => ({
      ...group,
      selectedSubtotal: "0",
      items: group.items.map((item) => ({ ...item, selected: false })),
    })),
    selectedTotal: "0",
  };
  await mockCheckoutApi(page, { cartResponse: noSelectionCart });
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: "Giỏ hàng" })).toBeVisible();
  await expect(page.locator(".mp-cart-item")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: "Tiến hành đặt hàng" }),
  ).toBeDisabled();
  await expect(page.getByRole("link", { name: "Tiến hành đặt hàng" })).toHaveCount(0);
});
