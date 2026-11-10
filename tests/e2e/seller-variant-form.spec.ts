import { expect, test, type Page } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000010";
const categoryId = "00000000-0000-4000-8000-000000000020";
const imageId = "00000000-0000-4000-8000-000000000030";

async function setup(page: Page, failCreate = false) {
  const calls = { uploads: 0, products: [] as Record<string, unknown>[] };
  const user = {
    id: "seller",
    fullName: "Seller",
    email: "seller@example.test",
    roles: ["BUYER"],
    status: "ACTIVE",
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    const data = (value: unknown) => route.fulfill({ json: { data: value } });
    if (path === "/auth/csrf") return data({ csrfToken: "csrf" });
    if (path === "/auth/refresh") return data({ accessToken: "access", user });
    if (path === "/users/me") return data(user);
    if (path === "/users/me/shops")
      return data([
        { shopId, shopName: "Shop", shopStatus: "ACTIVE", role: "OWNER" },
      ]);
    if (path === `/shops/${shopId}/management`)
      return data({ id: shopId, name: "Shop", status: "ACTIVE", version: 0 });
    if (path === "/categories")
      return data([{ id: categoryId, name: "Quần áo" }]);
    if (path === `/shops/${shopId}/management/products`) return data([]);
    if (path === "/users/me/assets") {
      calls.uploads++;
      return data({ id: imageId, url: "/fixture.png" });
    }
    if (path === `/shops/${shopId}/products` && request.method() === "POST") {
      calls.products.push(request.postDataJSON());
      if (failCreate)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "UNAVAILABLE",
              message: "Máy chủ đang bận. Vui lòng thử lại.",
            },
          },
        });
      return data({ id: "created-product" });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND" } },
    });
  });
  await page.goto(`/shops/${shopId}/products`);
  const form = page.getByRole("form", { name: "Tạo sản phẩm", exact: true });
  await form
    .getByRole("textbox", { name: "Tên", exact: true })
    .fill("Áo cotton");
  await form.getByLabel("Mô tả").fill("Áo cotton mềm");
  await form
    .getByRole("combobox", { name: "Danh mục", exact: true })
    .selectOption(categoryId);
  await form.locator('input[name="image"]').setInputFiles({
    name: "shirt.png",
    mimeType: "image/png",
    buffer: Buffer.from("fixture"),
  });
  return { calls, form };
}

test("seller creates a basic variant through labeled fields without JSON", async ({
  page,
}) => {
  const { calls, form } = await setup(page);
  const variant = form.getByRole("group", { name: "Biến thể 1", exact: true });
  await expect(variant).toBeVisible();
  await variant.getByLabel("Mã SKU").fill("BASIC-01");
  await variant.getByLabel("Giá bán (₫)").fill("125000");
  await expect(variant.getByLabel("Tồn kho ban đầu")).toHaveValue("0");
  await expect(form.getByLabel("Biến thể (JSON)")).toHaveCount(0);
  await expect(
    variant.getByRole("button", { name: "Xóa biến thể 1" }),
  ).toBeDisabled();
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect.poll(() => calls.products.length).toBe(1);
  expect(calls.products[0]).toMatchObject({
    categoryId,
    imageAssetIds: [imageId],
    selling: true,
    variants: [
      {
        sku: "BASIC-01",
        attributes: {},
        price: "125000",
        stock: 0,
        selling: true,
      },
    ],
  });
  await expect(form.getByLabel("Mã SKU")).toHaveValue("");
});

test("seller adds multiple attributes and preserves the remaining variant when removing a row", async ({
  page,
}) => {
  const { calls, form } = await setup(page);
  const first = form.getByRole("group", { name: "Biến thể 1", exact: true });
  await first.getByLabel("Mã SKU").fill("REMOVED");
  await form
    .getByRole("button", { name: "Thêm biến thể", exact: true })
    .click();
  const second = form.getByRole("group", { name: "Biến thể 2", exact: true });
  await second.getByLabel("Mã SKU").fill("BLUE-L");
  await second.getByLabel("Giá bán (₫)").fill("160000");
  await second.getByLabel("Tồn kho ban đầu").fill("5");
  await second.getByLabel("Tên phân loại").fill("Màu sắc");
  await second.getByLabel("Giá trị").fill("Xanh");
  await second
    .getByRole("button", { name: "Thêm phân loại", exact: true })
    .click();
  await second.getByLabel("Tên phân loại").last().fill("Kích thước");
  await second.getByLabel("Giá trị").last().fill("L");
  await first.getByRole("button", { name: "Xóa biến thể 1" }).click();
  const remaining = form.getByRole("group", {
    name: "Biến thể 1",
    exact: true,
  });
  await expect(remaining.getByLabel("Mã SKU")).toHaveValue("BLUE-L");
  await form
    .getByRole("button", { name: "Thêm biến thể", exact: true })
    .click();
  const stopped = form.getByRole("group", { name: "Biến thể 2", exact: true });
  await stopped.getByLabel("Mã SKU").fill("RED-S");
  await stopped.getByLabel("Giá bán (₫)").fill("150000");
  await stopped.getByLabel("Tên phân loại").fill("Màu sắc");
  await stopped.getByLabel("Giá trị").fill("Đỏ");
  await stopped.getByLabel("Đang bán").uncheck();
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect.poll(() => calls.products.length).toBe(1);
  expect(calls.products[0]!.variants).toEqual([
    {
      sku: "BLUE-L",
      attributes: { "Màu sắc": "Xanh", "Kích thước": "L" },
      price: "160000",
      stock: 5,
      selling: true,
    },
    {
      sku: "RED-S",
      attributes: { "Màu sắc": "Đỏ" },
      price: "150000",
      stock: 0,
      selling: false,
    },
  ]);
});

test("duplicate SKUs and attribute combinations are rejected before uploading", async ({
  page,
}) => {
  const { calls, form } = await setup(page);
  await form
    .getByRole("button", { name: "Thêm biến thể", exact: true })
    .click();
  const first = form.getByRole("group", { name: "Biến thể 1", exact: true });
  const second = form.getByRole("group", { name: "Biến thể 2", exact: true });
  for (const row of [first, second])
    await row.getByLabel("Giá bán (₫)").fill("100000");
  await first.getByLabel("Mã SKU").fill("sku-a");
  await second.getByLabel("Mã SKU").fill(" SKU-A ");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("SKU");
  expect(calls.uploads).toBe(0);
  await second.getByLabel("Mã SKU").fill("SKU-B");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("phân loại");
  expect(calls.uploads).toBe(0);
  expect(calls.products).toHaveLength(0);
});

test("invalid prices and incomplete attributes do not send a request", async ({
  page,
}) => {
  const { calls, form } = await setup(page);
  const variant = form.getByRole("group", { name: "Biến thể 1", exact: true });
  await variant.getByLabel("Mã SKU").fill("BASIC");
  await variant.getByLabel("Giá bán (₫)").fill("0");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Giá bán");
  await variant.getByLabel("Giá bán (₫)").fill("100000");
  await variant.getByLabel("Tồn kho ban đầu").fill("1.5");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(variant.locator("input:invalid")).toHaveCount(1);
  await variant.getByLabel("Tồn kho ban đầu").fill("0");
  await variant.getByLabel("Đang bán", { exact: true }).uncheck();
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("đang bán");
  await variant.getByLabel("Đang bán", { exact: true }).check();
  await variant.getByLabel("Tên phân loại").fill("Màu sắc");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(variant.locator("input:invalid")).toHaveCount(1);
  expect(calls.uploads).toBe(0);
  expect(calls.products).toHaveLength(0);
});

test("a rejected submission retains all variant values for manual retry", async ({
  page,
}) => {
  const { calls, form } = await setup(page, true);
  const variant = form.getByRole("group", { name: "Biến thể 1", exact: true });
  await variant.getByLabel("Mã SKU").fill("KEEP");
  await variant.getByLabel("Giá bán (₫)").fill("99000");
  await variant.getByLabel("Tồn kho ban đầu").fill("7");
  await variant.getByLabel("Tên phân loại").fill("Màu sắc");
  await variant.getByLabel("Giá trị").fill("Đen");
  await form
    .getByRole("button", { name: "Tạo và đăng bán", exact: true })
    .click();
  await expect(form.getByRole("alert")).toContainText("Máy chủ đang bận");
  await expect(variant.getByLabel("Mã SKU")).toHaveValue("KEEP");
  await expect(variant.getByLabel("Giá trị")).toHaveValue("Đen");
  await expect(variant.getByLabel("Tồn kho ban đầu")).toHaveValue("7");
  expect(calls.products).toHaveLength(1);
});

test("variant fields fit desktop, tablet and phone in both themes", async ({
  page,
}, testInfo) => {
  const { form } = await setup(page);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => document.fonts.ready);
      await expect(form.getByLabel("Mã SKU")).toBeVisible();
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        clipped: [
          ...document.querySelectorAll<HTMLInputElement>(
            ".mp-variant-editor input[placeholder]",
          ),
        ]
          .filter((input) => {
            const style = getComputedStyle(input);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            context.font = style.font;
            return (
              context.measureText(input.placeholder).width >
              input.clientWidth -
                parseFloat(style.paddingLeft) -
                parseFloat(style.paddingRight)
            );
          })
          .map((input) => input.placeholder),
      }));
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
      expect(layout.clipped).toEqual([]);
      await form
        .locator(".mp-variant-editor")
        .screenshot({
          path: testInfo.outputPath(`variant-form-${theme}-${width}.png`),
        });
    }
  }
});
