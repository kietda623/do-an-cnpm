import { expect, test } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000010";
const orderId = "00000000-0000-4000-8000-000000000020";
const sellerOrderId = "00000000-0000-4000-8000-000000000030";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "seller@example.test",
  fullName: "Seller",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
};

test("active member processes an existing suspended shop order and sees shipment progress", async ({
  page,
}) => {
  let status = "PENDING";
  let version = 0;
  let collected = false;
  let collectedVersion = -1;
  let shipment: null | {
    id: string;
    status: string;
    version: number;
    history: Array<{ toStatus: string; createdAt: string }>;
  } = null;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login"))
      return route.fulfill({ json: { data: { accessToken: "token", user } } });
    if (path.endsWith("/users/me/shops"))
      return route.fulfill({
        json: {
          data: [
            {
              shopId,
              shopName: "Paused Shop",
              shopStatus: "SUSPENDED",
              role: "OWNER",
            },
          ],
        },
      });
    if (path.endsWith(`/shops/${shopId}/management`))
      return route.fulfill({
        json: {
          data: { id: shopId, name: "Paused Shop", status: "SUSPENDED" },
        },
      });
    if (path.endsWith(`/shops/${shopId}/orders`) && request.method() === "GET")
      return route.fulfill({
        json: {
          data: {
            data: [
              {
                id: sellerOrderId,
                orderId,
                status,
                version,
                shopNameSnapshot: "Paused Shop",
                originalTotal: "12000",
                outstandingAmount: "12000",
                shipment,
                items: [
                  { productName: "Cup", quantity: 1, lineTotal: "12000" },
                ],
              },
            ],
            meta: { page: 1, pageSize: 20, total: 1 },
          },
        },
      });
    if (path.endsWith(`/shops/${shopId}/orders/${sellerOrderId}/confirm`)) {
      status = "CONFIRMED";
      version++;
      return route.fulfill({ json: { data: {} } });
    }
    if (path.endsWith(`/shops/${shopId}/orders/${sellerOrderId}/pack`)) {
      status = "PACKING";
      version++;
      shipment = {
        id: "00000000-0000-4000-8000-000000000040",
        status: "WAITING_PICKUP",
        version: 0,
        history: [
          { toStatus: "WAITING_PICKUP", createdAt: new Date().toISOString() },
        ],
      };
      return route.fulfill({ json: { data: {} } });
    }
    if (path.endsWith(`/shipments/${shipment?.id}/events`)) {
      const body = request.postDataJSON();
      shipment = {
        ...shipment!,
        status: body.event,
        version: shipment!.version + 1,
        history: [
          ...shipment!.history,
          { toStatus: body.event, createdAt: new Date().toISOString() },
        ],
      };
      status =
        body.event === "PICKED_UP"
          ? "SHIPPING"
          : body.event === "DELIVERED"
            ? "DELIVERED"
            : status;
      if (body.event === "PICKED_UP" || body.event === "DELIVERED") version++;
      return route.fulfill({ json: { data: shipment } });
    }
    if (path.endsWith(`/shipments/${shipment?.id}/retry`)) {
      shipment = {
        ...shipment!,
        status: "WAITING_PICKUP",
        version: shipment!.version + 1,
        history: [
          ...shipment!.history,
          { toStatus: "WAITING_PICKUP", createdAt: new Date().toISOString() },
        ],
      };
      return route.fulfill({ json: { data: shipment } });
    }
    if (
      path.endsWith(`/payments/seller-orders/${sellerOrderId}/cod-collection`)
    ) {
      collected = true;
      collectedVersion = request.postDataJSON().expectedVersion;
      return route.fulfill({ json: { data: { id: "cod-attempt" } } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.getByRole("link", { name: /cửa hàng của tôi/i }).click();
  await expect(
    page.getByRole("link", { name: "Quản lý sản phẩm" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /đơn của cửa hàng/i }).click();
  await expect(page.getByText("Paused Shop · PENDING")).toBeVisible();
  await page.getByRole("button", { name: "confirm" }).click();
  await expect(page.getByText("Paused Shop · CONFIRMED")).toBeVisible();
  await page.getByRole("button", { name: "pack" }).click();
  await expect(page.getByText("Vận chuyển: WAITING_PICKUP")).toBeVisible();
  await page.getByRole("button", { name: "PICKED_UP" }).click();
  await page.getByRole("button", { name: "IN_TRANSIT" }).click();
  page.once("dialog", (dialog) => void dialog.accept("Delivery failed"));
  await page.getByRole("button", { name: "FAILED" }).click();
  await expect(page.getByText("Vận chuyển: FAILED")).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept("Retry delivery"));
  await page.getByRole("button", { name: "retry" }).click();
  await expect(page.getByText("Vận chuyển: WAITING_PICKUP")).toBeVisible();
  await page.getByRole("button", { name: "PICKED_UP" }).click();
  await page.getByRole("button", { name: "IN_TRANSIT" }).click();
  await page.getByRole("button", { name: "DELIVERED" }).click();
  await expect(page.getByText("Paused Shop · DELIVERED")).toBeVisible();
  await page.getByRole("button", { name: "Thu COD" }).click();
  expect(collected).toBe(true);
  expect(collectedVersion).toBe(version);
});
