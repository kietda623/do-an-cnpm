import { expect, test } from "@playwright/test";

const admin = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "admin@example.test",
  fullName: "Admin Operator",
  phone: null,
  avatar: null,
  roles: ["ADMIN"],
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-26T00:00:00.000Z",
  updatedAt: "2026-10-26T00:00:00.000Z",
};

test("Admin browser can lock, hide, search, inspect and audit with a mocked API", async ({
  page,
}) => {
  const userId = "00000000-0000-4000-8000-000000000201";
  const productId = "00000000-0000-4000-8000-000000000202";
  const orderId = "00000000-0000-4000-8000-000000000203";
  const sellerOrderId = "00000000-0000-4000-8000-000000000204";
  let userState = {
    id: userId,
    email: "member@example.test",
    fullName: "Marketplace Member",
    phone: null,
    avatar: null,
    roles: ["BUYER"],
    status: "ACTIVE",
    version: 0,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
  let productState = {
    id: productId,
    shopId: "00000000-0000-4000-8000-000000000205",
    categoryId: "00000000-0000-4000-8000-000000000206",
    name: "Flagged listing",
    description: "Moderation fixture",
    selling: true,
    adminHidden: false,
    hiddenReason: null as string | null,
    minimumPrice: "500",
    version: 0,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
  let userAction:
    | { path: string; key: string | undefined; body: Record<string, unknown> }
    | undefined;
  let productAction:
    { key: string | undefined; body: Record<string, unknown> } | undefined;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/login")
      return route.fulfill({
        json: { data: { accessToken: "admin-token", user: admin } },
      });
    if (path === "/admin/stats")
      return route.fulfill({
        json: {
          data: {
            userCount: 12,
            shopCount: 4,
            productCount: 21,
            orderCount: 8,
            completedSellerOrderValue: "125000",
            currency: "VND",
            simulated: true,
            from: admin.createdAt,
            to: admin.updatedAt,
            timezone: "Asia/Saigon",
            countsByStatus: {},
          },
        },
      });
    if (path === "/admin/users" && request.method() === "GET")
      return route.fulfill({
        json: { data: [userState], meta: { page: 1, pageSize: 50, total: 1 } },
      });
    if (path === `/admin/users/${userId}/lock` && request.method() === "POST") {
      userAction = {
        path,
        key: request.headers()["idempotency-key"],
        body: request.postDataJSON(),
      };
      userState = { ...userState, status: "LOCKED", version: 1 };
      return route.fulfill({ json: { data: userState } });
    }
    if (path === "/admin/products" && request.method() === "GET")
      return route.fulfill({
        json: {
          data: [productState],
          meta: { page: 1, pageSize: 50, total: 1 },
        },
      });
    if (
      path === `/admin/products/${productId}/hide` &&
      request.method() === "POST"
    ) {
      productAction = {
        key: request.headers()["idempotency-key"],
        body: request.postDataJSON(),
      };
      productState = {
        ...productState,
        adminHidden: true,
        hiddenReason: String(productAction.body.reason),
        version: 1,
      };
      return route.fulfill({ json: { data: productState } });
    }
    if (path === "/admin/orders" && request.method() === "GET")
      return route.fulfill({
        json: {
          data: [
            {
              id: orderId,
              orderNumber: "ORD-US9-0001",
              status: "COMPLETED",
              partiallyCancelled: false,
              originalTotal: "750",
              outstandingAmount: "0",
              paymentStatus: "PAID",
              createdAt: admin.createdAt,
            },
          ],
          meta: { page: 1, pageSize: 50, total: 1 },
        },
      });
    if (path === `/admin/orders/${orderId}`)
      return route.fulfill({
        json: {
          data: {
            order: {
              id: orderId,
              orderNumber: "ORD-US9-0001",
              buyerId: userId,
              status: "COMPLETED",
              originalTotal: "750",
              cancelledAmount: "0",
              capturedAmount: "750",
              refundedAmount: "0",
              outstandingAmount: "0",
              paymentMethod: "MOCK",
              paymentStatus: "PAID",
              sellerOrders: [
                {
                  id: sellerOrderId,
                  shopId: productState.shopId,
                  shopNameSnapshot: "Example shop",
                  status: "COMPLETED",
                  originalTotal: "750",
                  items: [
                    {
                      id: "00000000-0000-4000-8000-000000000207",
                      productName: "Flagged listing",
                      sku: "SKU-1",
                      quantity: 1,
                      unitPrice: "750",
                      lineTotal: "750",
                    },
                  ],
                  shipment: null,
                },
              ],
              payments: [
                {
                  id: "00000000-0000-4000-8000-000000000208",
                  status: "SUCCEEDED",
                  amount: "750",
                  transactionCode: "TX-1",
                  refunds: [],
                },
              ],
            },
            auditReferenceIds: ["00000000-0000-4000-8000-000000000209"],
          },
        },
      });
    if (path === "/admin/audit" && request.method() === "GET")
      return route.fulfill({
        json: {
          data: [
            {
              id: "00000000-0000-4000-8000-000000000210",
              actorId: admin.id,
              action: "product.hidden",
              resourceType: "Product",
              resourceId: productId,
              reason: "Policy review",
              requestId: "00000000-0000-4000-8000-000000000211",
              createdAt: admin.createdAt,
              metadata: { version: 1 },
            },
          ],
          meta: { page: 1, pageSize: 50, total: 1 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: `No mock for ${path}` } },
    });
  });

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(admin.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await expect(page.getByText("Giá trị seller order hoàn tất")).toBeVisible();

  await page.getByRole("link", { name: "Người dùng" }).click();
  await page.getByRole("button", { name: "Khóa" }).click();
  await page
    .getByLabel(`Lý do ${userState.email}`)
    .fill("Account review required");
  await page.getByRole("button", { name: "Xác nhận khóa" }).click();
  await expect(page.getByText(/LOCKED · version 1/)).toBeVisible();
  expect(userAction).toMatchObject({
    path: `/admin/users/${userId}/lock`,
    body: { reason: "Account review required", expectedVersion: 0 },
  });
  expect(userAction?.key).toMatch(/^[0-9a-f-]{36}$/i);

  await page.getByRole("link", { name: "Kiểm duyệt sản phẩm" }).click();
  await page.getByRole("button", { name: "Ẩn sản phẩm" }).click();
  await page.getByLabel("Lý do Flagged listing").fill("Policy review");
  await page.getByRole("button", { name: "Xác nhận ẩn" }).click();
  await expect(page.getByText("Lý do ẩn: Policy review")).toBeVisible();
  expect(productAction?.body).toEqual({
    reason: "Policy review",
    expectedVersion: 0,
  });
  expect(productAction?.key).toMatch(/^[0-9a-f-]{36}$/i);

  await page.getByRole("link", { name: "Tra cứu đơn hàng" }).click();
  await expect(page.getByRole("link", { name: "ORD-US9-0001" })).toBeVisible();
  await page.getByRole("link", { name: "ORD-US9-0001" }).click();
  await expect(
    page.getByText("Đơn chỉ đọc, bao gồm dữ liệu giao dịch đã hoàn tất."),
  ).toBeVisible();
  await expect(page.getByText(/SUCCEEDED · 750 VND/)).toBeVisible();
  await expect(page.getByText(sellerOrderId)).toBeVisible();

  await page.getByRole("link", { name: "Nhật ký quản trị" }).click();
  await expect(page.getByText("product.hidden")).toBeVisible();
  await expect(page.getByText("Policy review ·")).toBeVisible();
});
