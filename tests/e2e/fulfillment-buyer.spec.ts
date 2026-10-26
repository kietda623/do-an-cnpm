import { expect, test } from "@playwright/test";

const orderId = "00000000-0000-4000-8000-000000000020";
const sellerOrderId = "00000000-0000-4000-8000-000000000030";
const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-26T00:00:00.000Z",
  updatedAt: "2026-10-26T00:00:00.000Z",
};

test("buyer sees delivered shipment history and confirms receipt", async ({
  page,
}) => {
  let sellerStatus = "DELIVERED";
  let sellerVersion = 4;
  let receivedPayload: { expectedVersion: number } | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({ json: { data: { accessToken: "buyer-token" } } });
    if (path.endsWith("/users/me"))
      return route.fulfill({ json: { data: buyer } });
    if (path.endsWith(`/orders/${orderId}`))
      return route.fulfill({
        json: {
          data: {
            orderNumber: "ORD-E2E-020",
            status: sellerStatus,
            paymentMethod: "COD",
            originalTotal: "12000",
            paymentDeadline: null,
            paymentStatus: "PAID",
            outstandingAmount: "0",
            version: 7,
            createdAt: "2026-10-26T00:00:00.000Z",
            sellerOrders: [
              {
                id: sellerOrderId,
                shopNameSnapshot: "Paused Shop",
                status: sellerStatus,
                originalTotal: "12000",
                outstandingAmount: "0",
                version: sellerVersion,
                cancelledAt: null,
                cancelReason: null,
                capturedAmount: "12000",
                refundedAmount: "0",
                addressSnapshot: {
                  recipientName: "Buyer",
                  phone: "0901234567",
                  line1: "1 Test Street",
                  ward: "Ward",
                  district: "District",
                  province: "HCMC",
                },
                shipment: {
                  trackingCode: "SHP-E2E-1",
                  status: "DELIVERED",
                  history: [
                    {
                      toStatus: "WAITING_PICKUP",
                      reason: null,
                      createdAt: "2026-10-25T10:00:00.000Z",
                    },
                    {
                      toStatus: "DELIVERED",
                      reason: null,
                      createdAt: "2026-10-26T10:00:00.000Z",
                    },
                  ],
                },
                items: [],
              },
            ],
          },
        },
      });
    if (
      path.endsWith(`/orders/${orderId}/seller-orders/${sellerOrderId}/receive`)
    ) {
      receivedPayload = request.postDataJSON();
      sellerStatus = "COMPLETED";
      sellerVersion++;
      return route.fulfill({
        json: {
          data: {
            id: sellerOrderId,
            status: sellerStatus,
            version: sellerVersion,
          },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText("Vận chuyển · DELIVERED")).toBeVisible();
  await expect(page.getByText(/WAITING_PICKUP/)).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận đã nhận hàng" }).click();
  await expect(page.getByText("COMPLETED", { exact: true })).toBeVisible();
  expect(receivedPayload?.expectedVersion).toBe(4);
  await expect(page.getByText("Xác nhận đã nhận hàng")).toHaveCount(0);
});

test("buyer can cancel only the pending part while its shop is suspended", async ({
  page,
}) => {
  let status = "PENDING";
  let cancellation: { reason: string; expectedVersion: number } | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({ json: { data: { accessToken: "buyer-token" } } });
    if (path.endsWith("/users/me"))
      return route.fulfill({ json: { data: buyer } });
    if (path.endsWith(`/orders/${orderId}`))
      return route.fulfill({
        json: {
          data: {
            orderNumber: "ORD-E2E-020",
            status,
            paymentMethod: "COD",
            originalTotal: "12000",
            paymentDeadline: null,
            paymentStatus: "UNPAID",
            outstandingAmount: status === "CANCELLED" ? "0" : "12000",
            version: 2,
            createdAt: "2026-10-26T00:00:00.000Z",
            sellerOrders: [
              {
                id: sellerOrderId,
                shopNameSnapshot: "Paused Shop",
                status,
                originalTotal: "12000",
                outstandingAmount: status === "CANCELLED" ? "0" : "12000",
                version: 1,
                cancelledAt:
                  status === "CANCELLED" ? "2026-10-26T00:01:00.000Z" : null,
                cancelReason: status === "CANCELLED" ? "Changed mind" : null,
                capturedAmount: "0",
                refundedAmount: "0",
                addressSnapshot: {
                  recipientName: "Buyer",
                  phone: "0901234567",
                  line1: "1 Test Street",
                  ward: "Ward",
                  district: "District",
                  province: "HCMC",
                },
                shipment: null,
                items: [],
              },
            ],
          },
        },
      });
    if (
      path.endsWith(`/orders/${orderId}/seller-orders/${sellerOrderId}/cancel`)
    ) {
      cancellation = request.postDataJSON();
      status = "CANCELLED";
      return route.fulfill({ json: { data: { id: sellerOrderId, status } } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto(`/orders/${orderId}`);
  await page.getByRole("button", { name: "Hủy riêng Paused Shop" }).click();
  await page.getByLabel("Lý do").fill("Changed mind");
  await page.getByRole("button", { name: "Xác nhận hủy" }).click();
  expect(cancellation).toEqual({ reason: "Changed mind", expectedVersion: 1 });
  await expect(page.getByText(/Đã hủy: Changed mind/)).toBeVisible();
});

test("buyer completes the simulated mock payment before Seller fulfillment", async ({
  page,
}) => {
  let paid = false;
  let expectedVersion: number | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({ json: { data: { accessToken: "buyer-token" } } });
    if (path.endsWith("/users/me"))
      return route.fulfill({ json: { data: buyer } });
    if (path.endsWith(`/orders/${orderId}`))
      return route.fulfill({
        json: {
          data: {
            orderNumber: "ORD-E2E-020",
            status: "PENDING",
            paymentMethod: "MOCK",
            originalTotal: "12000",
            paymentDeadline: "2099-10-26T01:00:00.000Z",
            paymentStatus: paid ? "PAID" : "UNPAID",
            outstandingAmount: paid ? "0" : "12000",
            version: 2,
            createdAt: "2026-10-26T00:00:00.000Z",
            sellerOrders: [
              {
                id: sellerOrderId,
                shopNameSnapshot: "Paused Shop",
                status: "PENDING",
                originalTotal: "12000",
                outstandingAmount: paid ? "0" : "12000",
                version: 1,
                cancelledAt: null,
                cancelReason: null,
                capturedAmount: paid ? "12000" : "0",
                refundedAmount: "0",
                addressSnapshot: {
                  recipientName: "Buyer",
                  phone: "0901234567",
                  line1: "1 Test Street",
                  ward: "Ward",
                  district: "District",
                  province: "HCMC",
                },
                shipment: null,
                items: [],
              },
            ],
          },
        },
      });
    if (path === "/api/v1/payments" && request.method() === "GET")
      return route.fulfill({
        json: {
          data: paid
            ? [
                {
                  id: "mock-attempt",
                  status: "SUCCEEDED",
                  settlementKind: "NORMAL",
                  amount: "12000",
                  transactionCode: "MOCK-1",
                  refunds: [],
                },
              ]
            : [],
        },
      });
    if (path.endsWith("/payments/mock-attempts"))
      return route.fulfill({
        json: {
          data: {
            id: "mock-attempt",
            status: "PENDING",
            settlementKind: "NORMAL",
            amount: "12000",
            transactionCode: "MOCK-1",
            refunds: [],
          },
        },
      });
    if (path.endsWith("/payments/mock-attempt/mock-result")) {
      expectedVersion = request.postDataJSON().expectedVersion;
      paid = true;
      return route.fulfill({
        json: { data: { id: "mock-attempt", status: "SUCCEEDED" } },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto(`/orders/${orderId}`);
  await page
    .getByRole("button", { name: "Mô phỏng thanh toán thành công" })
    .click();
  await expect(
    page.getByText("Thanh toán thử nghiệm thành công."),
  ).toBeVisible();
  expect(expectedVersion).toBe(2);
  await expect(page.getByText("PAID", { exact: true })).toBeVisible();
});
