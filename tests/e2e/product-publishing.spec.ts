import { expect, test } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000010",
  categoryId = "00000000-0000-4000-8000-000000000020",
  productId = "00000000-0000-4000-8000-000000000030";
const shop = {
  id: shopId,
  name: "E2E Shop",
  slug: "e2e-shop",
  description: "Shop",
  contactAddress: "Test",
  phone: "0901234567",
  logo: { id: "00000000-0000-4000-8000-000000000011", url: "https://assets.example.test/logo.png" },
  banner: null,
  status: "ACTIVE",
  rejectionReason: null,
  approvedAt: null,
  version: 0,
};
const seller = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "seller@example.test",
  fullName: "E2E Seller",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
};
const admin = {
  ...seller,
  id: "00000000-0000-4000-8000-000000000002",
  email: "admin@example.test",
  roles: ["ADMIN"],
};

test("admin creates a category and seller publishes two variants then handles a stock conflict", async ({
  page,
}) => {
  let productCreated = false,
    inventoryVersion = 0,
    availableQuantity = 1,
    adjustments = 0,
    productName = "Áo cotton",
    productSelling = true,
    productVersion = 0,
    productImages: Array<{ assetId: string; objectKey: string }> = [],
    categoryCreated = false;
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login")) {
      const body = req.postDataJSON() as { email: string };
      return route.fulfill({
        json: { data: { accessToken: "token", user: body.email === admin.email ? admin : seller } },
      });
    }
    if (path.endsWith("/admin/categories") && req.method() === "GET")
      return route.fulfill({
        json: {
          data: categoryCreated
            ? [{ id: categoryId, name: "Đồ gia dụng", parentId: null, visible: true, version: 0 }]
            : [],
        },
      });
    if (path.endsWith("/admin/categories") && req.method() === "POST") {
      categoryCreated = true;
      return route.fulfill({
        status: 201,
        json: {
          data: { id: categoryId, name: "Đồ gia dụng", parentId: null, visible: true, version: 0 },
        },
      });
    }
    if (path.endsWith("/users/me/shops"))
      return route.fulfill({
        json: { data: [{ shopId, shopName: shop.name, shopStatus: "ACTIVE", role: "OWNER" }] },
      });
    if (path.endsWith(`/shops/${shopId}/management`))
      return route.fulfill({ json: { data: shop } });
    if (path.endsWith("/categories"))
      return route.fulfill({
        json: {
          data: [
            { id: categoryId, name: "Đồ gia dụng", parentId: null, visible: true, version: 0 },
          ],
        },
      });
    if (path.endsWith("/users/me/assets"))
      return route.fulfill({
        status: 201,
        json: {
          data: {
            id: "00000000-0000-4000-8000-000000000021",
            url: "https://assets.example.test/product.png",
          },
        },
      });
    if (path.endsWith("/management/products"))
      return route.fulfill({
        json: {
          data: productCreated
            ? [
                {
                  id: productId,
                  name: productName,
                  description: "Áo",
                  categoryId,
                  selling: productSelling,
                  version: productVersion,
                  images: productImages,
                  variants: [
                    {
                      id: "00000000-0000-4000-8000-000000000031",
                      sku: "COTTON-S",
                      price: "150000",
                      selling: true,
                      availableQuantity,
                      inventoryVersion,
                    },
                  ],
                },
              ]
            : [],
        },
      });
    if (path.endsWith(`/shops/${shopId}/products`) && req.method() === "POST") {
      productCreated = true;
      const body = req.postDataJSON() as { variants: Array<{ sku: string }> };
      expect(body.variants).toHaveLength(2);
      return route.fulfill({ status: 201, json: { data: { id: productId } } });
    }
    if (path.endsWith(`/shops/${shopId}/products/${productId}`) && req.method() === "PATCH") {
      const body = req.postDataJSON() as {
        name?: string;
        selling?: boolean;
        imageAssetIds?: string[];
      };
      if (body.name) productName = body.name;
      if (body.selling !== undefined) productSelling = body.selling;
      if (body.imageAssetIds)
        productImages = body.imageAssetIds.map((assetId, position) => ({
          assetId,
          objectKey: `product-${position}.png`,
        }));
      productVersion++;
      return route.fulfill({
        json: {
          data: {
            id: productId,
            name: productName,
            selling: productSelling,
            version: productVersion,
          },
        },
      });
    }
    if (path.endsWith("/inventory-adjustments")) {
      adjustments++;
      if (adjustments === 1)
        return route.fulfill({
          status: 409,
          json: { error: { code: "VERSION_CONFLICT", message: "Inventory changed" } },
        });
      inventoryVersion++;
      availableQuantity++;
      return route.fulfill({ json: { data: { availableQuantity } } });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto("http://127.0.0.1:3102/login");
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Mật khẩu").fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.getByRole("link", { name: "Quản lý danh mục" }).click();
  await page.getByLabel("Tên danh mục").fill("Đồ gia dụng");
  await page.getByRole("button", { name: "Tạo danh mục" }).click();
  await expect(page.getByText("Đồ gia dụng · Hiện")).toBeVisible();
  await page.goto("http://127.0.0.1:3101/login");
  await page.getByLabel(/email/i).fill(seller.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.getByRole("link", { name: "Đến cửa hàng của tôi" }).click();
  await page.getByRole("link", { name: "Quản lý sản phẩm" }).click();
  await page.locator('form[aria-label="Tạo sản phẩm"] input[name="name"]').fill("Áo cotton");
  await expect(page.locator('input[name="name"]')).toHaveValue("Áo cotton");
  await page
    .locator('form[aria-label="Tạo sản phẩm"] textarea[name="description"]')
    .fill("Áo cotton mềm");
  await expect(page.locator('textarea[name="description"]')).toHaveValue("Áo cotton mềm");
  await page.getByLabel("Danh mục").selectOption(categoryId);
  await page.locator('input[name="image"]').setInputFiles({
    name: "product.png",
    mimeType: "image/png",
    buffer: Buffer.from("test image"),
  });
  await page.getByRole("button", { name: "Tạo và đăng bán" }).click();
  await expect(page.getByText("Áo cotton", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await page.locator('form input[name="name"]').last().fill("Áo cotton cập nhật");
  await page.locator('form input[name="images"]').setInputFiles({
    name: "gallery.png",
    mimeType: "image/png",
    buffer: Buffer.from("gallery image"),
  });
  await page.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(page.getByText("Áo cotton cập nhật", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Ảnh Áo cotton cập nhật" })).toBeVisible();
  await page.getByRole("button", { name: "Dừng bán" }).click();
  await expect(page.getByText(/Đã dừng bán/)).toBeVisible();
  await page.getByLabel("Số lượng thay đổi").fill("1");
  await page.getByRole("button", { name: "Cập nhật kho" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Tồn kho đã đổi");
  await expect(page.getByText(/tồn 1/)).toBeVisible();
  await page.getByRole("button", { name: "Cập nhật kho" }).click();
  await expect(page.getByText(/tồn 2/)).toBeVisible();
});

test("seller sees a validation error when an image upload is rejected", async ({ page }) => {
  let uploadAttempted = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/login"))
      return route.fulfill({ json: { data: { accessToken: "token", user: seller } } });
    if (path.endsWith("/users/me/shops"))
      return route.fulfill({
        json: { data: [{ shopId, shopName: shop.name, shopStatus: "ACTIVE", role: "OWNER" }] },
      });
    if (path.endsWith(`/shops/${shopId}/management`))
      return route.fulfill({ json: { data: shop } });
    if (path.endsWith("/categories"))
      return route.fulfill({ json: { data: [{ id: categoryId, name: "Nhà cửa" }] } });
    if (path.endsWith("/users/me/assets")) {
      uploadAttempted = true;
      return route.fulfill({
        status: 415,
        json: {
          error: { code: "UNSUPPORTED_IMAGE", message: "Only PNG, JPEG and WebP are supported." },
        },
      });
    }
    if (path.endsWith("/management/products")) return route.fulfill({ json: { data: [] } });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(seller.email);
  await page.getByLabel(/mật khẩu/i).fill("Correct horse battery staple 9!");
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  await page.getByRole("link", { name: "Đến cửa hàng của tôi" }).click();
  await page.getByRole("link", { name: "Quản lý sản phẩm" }).click();
  await page.locator('form[aria-label="Tạo sản phẩm"] input[name="name"]').fill("Hàng lỗi ảnh");
  await page.locator('textarea[name="description"]').fill("Mô tả");
  await page.getByLabel("Danh mục").selectOption(categoryId);
  await page
    .locator('input[name="image"]')
    .setInputFiles({ name: "bad.gif", mimeType: "image/gif", buffer: Buffer.from("bad") });
  await expect
    .poll(() =>
      page
        .locator('form[aria-label="Tạo sản phẩm"]')
        .evaluate((el) => (el as HTMLFormElement).checkValidity()),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Tạo và đăng bán" }).click();
  await expect.poll(() => uploadAttempted).toBe(true);
  await expect(page.getByText(/PNG|JPEG|WebP/i)).toBeVisible();
});
