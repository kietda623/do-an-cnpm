import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

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

const tokens = { accessToken: "e2e-access-token", refreshToken: "e2e-refresh-token" };
const accountAddress = {
  id: "00000000-0000-4000-8000-000000000002",
  recipientName: "E2E Buyer",
  phone: "0901234567",
  line1: "1 Test Street",
  ward: "Ward 1",
  district: "District 1",
  province: "Ho Chi Minh City",
  country: "VN",
  isDefault: true,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
};

async function mockAccountApi(
  page: Page,
  overrides: Record<string, (route: Route) => Promise<void>> = {},
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const override = Object.entries(overrides).find(([suffix]) => path.endsWith(suffix))?.[1];
    if (override) {
      await override(route);
      return;
    }

    if (path.endsWith("/auth/csrf")) {
      await route.fulfill({ json: { data: { csrfToken: "e2e-csrf-token" } } });
      return;
    }
    if (path.endsWith("/auth/register") || path.endsWith("/auth/login")) {
      await route.fulfill({
        status: path.endsWith("/auth/register") ? 201 : 200,
        json: { data: tokens },
      });
      return;
    }
    if (path.endsWith("/auth/refresh")) {
      await route.fulfill({ json: { data: tokens } });
      return;
    }
    if (path.endsWith("/auth/logout")) {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/users/me/password")) {
      await route.fulfill({ status: 204 });
      return;
    }
    if (path.endsWith("/users/me/addresses") && request.method() === "GET") {
      await route.fulfill({ json: { data: [] } });
      return;
    }
    if (path.endsWith("/users/me/addresses") && request.method() === "POST") {
      await route.fulfill({ status: 201, json: { data: accountAddress } });
      return;
    }
    if (path.endsWith("/users/me/assets")) {
      await route.fulfill({
        status: 201,
        json: {
          data: {
            id: "00000000-0000-4000-8000-000000000003",
            url: "https://assets.example.test/avatar.png",
            mimeType: "image/png",
            byteSize: 12,
            width: 1,
            height: 1,
          },
        },
      });
      return;
    }
    if (path.endsWith("/users/me") && request.method() === "PATCH") {
      await route.fulfill({ json: { data: { ...buyer, ...request.postDataJSON() } } });
      return;
    }
    if (path.endsWith("/users/me")) {
      await route.fulfill({ json: { data: buyer } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND" } } });
  });
}

async function fillRegisterForm(page: Page) {
  await page.getByLabel(/full name|họ và tên/i).fill("E2E Buyer");
  await page.getByLabel(/email/i).fill("buyer@example.test");
  await page.getByLabel(/password/i).fill("Correct horse battery staple 9!");
}

test("L: register disables duplicate submit while the server is responding", async ({ page }) => {
  let releaseRegistration!: () => void;
  let registrationStartedResolve!: () => void;
  const registrationStarted = new Promise<void>((resolve) => {
    registrationStartedResolve = resolve;
  });
  await page.route("**/api/v1/auth/register", async (route) => {
    registrationStartedResolve();
    await new Promise<void>((resolveRoute) => {
      releaseRegistration = resolveRoute;
    });
    await route.fulfill({ status: 201, json: { data: tokens } });
  });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill({ json: { data: { csrfToken: "e2e-csrf-token" } } }),
  );
  await page.goto("/register");
  await fillRegisterForm(page);
  const submit = page.getByRole("button", { name: /register|đăng ký/i }).last();
  await submit.click();
  await registrationStarted;
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("status")).toBeVisible();
  releaseRegistration();
  await expect(page).toHaveURL(/account/);
});

test("E: duplicate email shows a recoverable form error", async ({ page }) => {
  await mockAccountApi(page, {
    "/auth/register": (route) =>
      route.fulfill({
        status: 409,
        json: { error: { code: "EMAIL_TAKEN", message: "Email is already registered." } },
      }),
  });
  await page.goto("/register");
  await fillRegisterForm(page);
  await page
    .getByRole("button", { name: /register|đăng ký/i })
    .last()
    .click();
  await expect(page.getByRole("alert")).toContainText(/email/i);
  await expect(page.getByLabel(/email/i)).toBeVisible();
});

test("X: an account with no addresses gets an actionable empty state", async ({ page }) => {
  await mockAccountApi(page);
  await page.goto("/account/addresses");
  await expect(page.getByText(/chưa có địa chỉ|no addresses/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /thêm địa chỉ|add address/i })).toBeVisible();
});

test("S: register, update profile/address/password, upload avatar, and log out", async ({
  page,
}) => {
  await mockAccountApi(page);
  await page.goto("/register");
  await fillRegisterForm(page);
  await page
    .getByRole("button", { name: /register|đăng ký/i })
    .last()
    .click();
  await expect(page).toHaveURL(/account/);
  await page.getByRole("button", { name: /log out|đăng xuất/i }).click();
  await expect(page).toHaveURL(/login/);

  await page.getByLabel(/email/i).fill("buyer@example.test");
  await page.getByLabel(/password/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /login|đăng nhập/i }).click();
  await expect(page).toHaveURL(/account/);

  await page.goto("/account");
  await page.getByLabel(/full name|họ và tên/i).fill("Updated E2E Buyer");
  await page.getByRole("button", { name: /save|lưu/i }).click();
  await expect(page.getByRole("status")).toContainText(/saved|đã lưu/i);

  await page.goto("/account/addresses");
  await page.getByRole("button", { name: /thêm địa chỉ|add address/i }).click();
  await page.getByLabel(/recipient|người nhận/i).fill("E2E Buyer");
  await page.getByLabel(/phone|điện thoại/i).fill("0901234567");
  await page.getByLabel(/address line|địa chỉ/i).fill("1 Test Street");
  await page.getByLabel(/ward|phường/i).fill("Ward 1");
  await page.getByLabel(/district|quận/i).fill("District 1");
  await page.getByLabel(/province|tỉnh/i).fill("Ho Chi Minh City");
  await page.getByRole("checkbox", { name: /default|mặc định/i }).check();
  await page.getByRole("button", { name: /save|lưu/i }).click();
  await expect(page.getByText("1 Test Street")).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: /change password|đổi mật khẩu/i }).click();
  await page
    .getByLabel(/current password|mật khẩu hiện tại/i)
    .fill("Correct horse battery staple 9!");
  await page.getByLabel(/new password|mật khẩu mới/i).fill("New correct horse battery staple 10!");
  await page.getByRole("button", { name: /update password|cập nhật mật khẩu/i }).click();
  await expect(page.getByRole("status")).toContainText(
    /password.*updated|đổi mật khẩu thành công/i,
  );

  await page.locator('input[type="file"]').setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from("valid-image"),
  });
  await expect(page.getByRole("img", { name: /avatar/i })).toBeVisible();

  await page.getByRole("button", { name: /log out|đăng xuất/i }).click();
  await expect(page).toHaveURL(/login/);
});

test("unauthorized profile access redirects to login without showing private data", async ({
  page,
}) => {
  await mockAccountApi(page, {
    "/users/me": (route) =>
      route.fulfill({ status: 401, json: { error: { code: "UNAUTHORIZED" } } }),
  });
  await page.goto("/account");
  await expect(page).toHaveURL(/login/);
  await expect(page.getByText(buyer.email)).toHaveCount(0);
});
