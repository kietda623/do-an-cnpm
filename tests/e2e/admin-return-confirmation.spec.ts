import { expect, test } from "@playwright/test";

const admin = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "admin@example.test",
  fullName: "Admin",
  phone: null,
  avatar: null,
  roles: ["ADMIN"],
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-26T00:00:00.000Z",
  updatedAt: "2026-10-26T00:00:00.000Z",
};

test("Admin confirms one failed shipment return with a reason and version", async ({
  page,
}) => {
  let submitted: { reason: string; expectedVersion: number } | undefined;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login"))
      return route.fulfill({
        json: { data: { accessToken: "admin-token", user: admin } },
      });
    if (
      path.endsWith(
        "/admin/shipments/00000000-0000-4000-8000-000000000202/return-confirmation",
      )
    ) {
      submitted = request.postDataJSON();
      return route.fulfill({
        json: {
          data: {
            affectedResourceIds: ["00000000-0000-4000-8000-000000000203"],
            shipment: {
              id: "00000000-0000-4000-8000-000000000202",
              status: "FAILED",
              version: 5,
            },
          },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(admin.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.getByRole("link", { name: /xác nhận hàng hoàn về/i }).click();
  await page
    .getByLabel(/mã shipment/i)
    .fill("00000000-0000-4000-8000-000000000202");
  await page.getByLabel(/phiên bản shipment/i).fill("4");
  await page.getByLabel(/lý do/i).fill("Returned parcel inspected");
  await page.getByRole("button", { name: /xác nhận trả về/i }).click();
  await expect(page.getByRole("status")).toContainText(
    "Đã xác nhận kiện hàng trả về",
  );
  expect(submitted).toEqual({
    reason: "Returned parcel inspected",
    expectedVersion: 4,
  });
});
