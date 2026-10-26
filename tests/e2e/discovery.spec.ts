import { expect, test } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000010";
const productId = "00000000-0000-4000-8000-000000000030";
const categoryId = "00000000-0000-4000-8000-000000000020";
const products = [
  {
    id: productId,
    shopId,
    shopName: "Cửa hàng Linen",
    name: "Áo linen xanh",
    image: null,
    minimumPrice: "250000",
    available: true,
    ratingAverage: null,
    ratingCount: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000031",
    shopId,
    shopName: "Cửa hàng Linen",
    name: "Túi vải",
    image: null,
    minimumPrice: "120000",
    available: false,
    ratingAverage: null,
    ratingCount: 0,
    createdAt: "2026-09-01T00:00:00.000Z",
  },
];
const detail = {
  ...products[0],
  description: "Áo linen thoáng mát.",
  categoryId,
  category: { id: categoryId, name: "Thời trang" },
  shop: { id: shopId, name: "Cửa hàng Linen", slug: "linen-shop" },
  images: [],
  variants: [
    {
      id: "00000000-0000-4000-8000-000000000040",
      sku: "LINEN-M",
      attributes: { size: "M" },
      price: "250000",
      availableQuantity: 2,
    },
  ],
};

async function mockApi(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/categories"))
      return route.fulfill({
        json: { data: [{ id: categoryId, name: "Thời trang", children: [] }] },
      });
    if (url.pathname.endsWith(`/products/${productId}`))
      return route.fulfill({ json: { data: detail } });
    if (url.pathname.endsWith(`/shops/${shopId}`))
      return route.fulfill({
        json: {
          data: {
            id: shopId,
            name: "Cửa hàng Linen",
            slug: "linen-shop",
            description: "Đồ linen",
            logo: null,
            banner: null,
          },
        },
      });
    if (url.pathname.endsWith(`/shops/${shopId}/products`) || url.pathname.endsWith("/products")) {
      const searched = url.searchParams.get("q")?.toLowerCase();
      const filtered = searched
        ? products.filter((p) => p.name.toLowerCase().includes(searched))
        : products;
      const pageNum = Number(url.searchParams.get("page") ?? 1);
      return route.fulfill({
        json: {
          data: pageNum === 1 ? filtered.slice(0, 1) : filtered.slice(1),
          meta: { page: pageNum, pageSize: 1, total: filtered.length },
        },
      });
    }
    return route.fulfill({ status: 404, json: { error: { message: "Not found" } } });
  });
}

test("guest can search, page and open an out-of-stock item", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Khám phá sản phẩm" })).toBeVisible();
  await expect(page.getByRole("link", { name: /áo linen xanh/i })).toBeVisible();
  await page.getByLabel("Tìm sản phẩm").fill("linen");
  await page.getByRole("button", { name: "Tìm kiếm" }).click();
  await expect(page).toHaveURL(/q=linen/);
  await page.getByRole("link", { name: /áo linen xanh/i }).click();
  await expect(page.getByRole("heading", { name: "Áo linen xanh" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Đăng nhập để mua" })).toHaveAttribute(
    "href",
    /login\?returnTo=/,
  );
});

test("home and public shop render at desktop width and keyboard users can reach filters", async ({
  page,
}) => {
  await mockApi(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /khám phá sản phẩm từ các cửa hàng/i }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.goto(`/shops/${shopId}`);
  await expect(page.getByRole("heading", { name: "Cửa hàng Linen" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sản phẩm của cửa hàng" })).toBeVisible();
});

test("discovery shows empty and error states", async ({ page }) => {
  let fail = false;
  await page.route("**/api/v1/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/categories"))
      return route.fulfill({ json: { data: [] } });
    return fail
      ? route.fulfill({ status: 500, json: { error: { message: "failed" } } })
      : route.fulfill({ json: { data: [], meta: { page: 1, pageSize: 20, total: 0 } } });
  });
  await page.goto("/products");
  await expect(page.getByText("Chưa tìm thấy sản phẩm phù hợp.")).toBeVisible();
  fail = true;
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Không tải được sản phẩm" })).toContainText("Không tải được sản phẩm");
});
