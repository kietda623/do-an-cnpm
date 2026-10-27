import { expect, test } from "@playwright/test";

const id = "00000000-0000-4000-8000-000000000101";
const orderId = "00000000-0000-4000-8000-000000000102";
const itemId = "00000000-0000-4000-8000-000000000103";
const reviewId = "00000000-0000-4000-8000-000000000104";
const buyer = {
  id,
  email: "buyer@example.test",
  fullName: "Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
};

test("buyer reviews a completed item and sees the public review (mock API)", async ({
  page,
}) => {
  let reviewed = false;
  let submission:
    { orderItemId: string; rating: number; comment: string } | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "buyer-token" } } });
    if (path === "/users/me") return route.fulfill({ json: { data: buyer } });
    if (path === `/orders/${orderId}`)
      return route.fulfill({
        json: {
          data: {
            orderNumber: "ORD-US8",
            status: "COMPLETED",
            paymentMethod: "COD",
            originalTotal: "101",
            paymentDeadline: null,
            paymentStatus: "PAID",
            outstandingAmount: "0",
            version: 1,
            createdAt: "2026-10-26T17:00:00Z",
            sellerOrders: [
              {
                id,
                shopNameSnapshot: "US8 shop",
                status: "COMPLETED",
                originalTotal: "101",
                version: 1,
                cancelledAt: null,
                cancelReason: null,
                capturedAmount: "101",
                refundedAmount: "0",
                outstandingAmount: "0",
                shipment: null,
                addressSnapshot: {
                  recipientName: "Buyer",
                  phone: "0901234567",
                  line1: "1 Test",
                  ward: "W",
                  district: "D",
                  province: "HCMC",
                },
                items: [
                  {
                    id: itemId,
                    productId: id,
                    productName: "US8 product",
                    sku: "SKU",
                    attributes: {},
                    quantity: 1,
                    unitPrice: "101",
                    lineTotal: "101",
                    reviewId: reviewed ? reviewId : null,
                    review: reviewed
                      ? {
                          rating: 5,
                          comment: "Rất tốt",
                          createdAt: "2026-10-26T17:00:00Z",
                        }
                      : null,
                  },
                ],
              },
            ],
          },
        },
      });
    if (path === "/reviews" && req.method() === "POST") {
      submission = req.postDataJSON();
      reviewed = true;
      return route.fulfill({ status: 201, json: { data: { id: reviewId } } });
    }
    if (path === `/products/${id}`)
      return route.fulfill({
        json: {
          data: {
            id,
            name: "US8 product",
            description: "Review fixture",
            minimumPrice: "101",
            ratingAverage: "5",
            ratingCount: 1,
            shop: { id, name: "US8 shop", slug: "us8" },
            images: [],
            variants: [
              {
                id,
                sku: "SKU",
                attributes: {},
                price: "101",
                availableQuantity: 1,
              },
            ],
          },
        },
      });
    if (path === `/products/${id}/reviews`)
      return route.fulfill({
        json: {
          data: [
            {
              id: reviewId,
              productId: id,
              shopId: id,
              orderItemId: itemId,
              buyerDisplayName: "Buyer",
              rating: 5,
              comment: "Rất tốt",
              createdAt: "2026-10-26T17:00:00Z",
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto(`/orders/${orderId}`);
  await page.getByLabel("Số sao").selectOption("5");
  await page.getByLabel("Nhận xét").fill("Rất tốt");
  await page.getByRole("button", { name: "Gửi đánh giá" }).click();
  await expect(page.getByText("Đã đánh giá", { exact: true })).toBeVisible();
  await expect(page.getByText("Rất tốt", { exact: true })).toBeVisible();
  expect(submission).toEqual({
    orderItemId: itemId,
    rating: 5,
    comment: "Rất tốt",
  });
  await page.goto(`/products/${id}`);
  await expect(page.getByText("Rất tốt")).toBeVisible();
  await expect(page.getByText(/5.*1 đánh giá/)).toBeVisible();
});
