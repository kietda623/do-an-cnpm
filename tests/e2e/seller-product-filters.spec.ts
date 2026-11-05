import { expect, test, type Page } from "@playwright/test";

const shopId = "00000000-0000-4000-8000-000000000010";
const categoryId = "00000000-0000-4000-8000-000000000020";

const seller = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "seller@example.test",
  fullName: "E2E Seller",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
};

const shop = {
  id: shopId,
  name: "E2E Shop",
  slug: "e2e-shop",
  description: "Shop",
  contactAddress: "Test",
  phone: "0901234567",
  logo: null,
  banner: null,
  status: "ACTIVE",
  rejectionReason: null,
  approvedAt: null,
  version: 0,
};

function product(index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-0000000007${suffix}`,
    shopId,
    categoryId,
    name: `Sản phẩm ${suffix}`,
    description: `Fixture product ${suffix}`,
    selling: index % 2 === 1,
    adminHidden: index === 23,
    hiddenReason: index === 23 ? "Policy check" : null,
    version: 0,
    images: [],
    variants: [
      {
        id: `00000000-0000-4000-8000-0000000008${suffix}`,
        sku: `SKU-${suffix}`,
        attributes: { size: "S" },
        price: "150000",
        selling: index % 2 === 1,
        version: 0,
        availableQuantity: 3,
        inventoryVersion: 0,
      },
    ],
  };
}

const catalog = Array.from({ length: 23 }, (_, index) => product(index + 1));

async function mockSeller(page: Page) {
  const listParams: URLSearchParams[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: seller } } });
    if (path === "/users/me") return route.fulfill({ json: { data: seller } });
    if (path === "/users/me/shops")
      return route.fulfill({
        json: { data: [{ shopId, shopName: shop.name, shopStatus: "ACTIVE", role: "OWNER" }] },
      });
    if (path === `/shops/${shopId}/management`)
      return route.fulfill({ json: { data: shop } });
    if (path === "/categories") return route.fulfill({ json: { data: [] } });
    if (path === `/shops/${shopId}/management/products`) {
      listParams.push(url.searchParams);
      const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
      const selling = url.searchParams.get("selling");
      const adminHidden = url.searchParams.get("adminHidden");
      const currentPage = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const filtered = catalog.filter(
        (row) =>
          (!q || row.name.toLowerCase().includes(q)) &&
          (selling === null || String(row.selling) === selling) &&
          (adminHidden === null || String(row.adminHidden) === adminHidden),
      );
      const start = (currentPage - 1) * pageSize;
      return route.fulfill({
        json: {
          data: filtered.slice(start, start + pageSize),
          meta: { page: currentPage, pageSize, total: filtered.length },
        },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  return { listParams };
}

test("seller product list filters and paginates on the server", async ({ page }) => {
  const calls = await mockSeller(page);
  await page.goto(`/shops/${shopId}/products`);

  await expect(page.getByText("Sản phẩm 01", { exact: true })).toBeVisible();
  await expect(page.getByText("Sản phẩm 20", { exact: true })).toBeVisible();
  await expect(page.getByText("Sản phẩm 21", { exact: true })).toBeHidden();
  await expect(page.getByText("23 sản phẩm trong bộ lọc hiện tại")).toBeVisible();
  expect(calls.listParams[0]?.get("page")).toBe("1");
  expect(calls.listParams[0]?.get("pageSize")).toBe("20");

  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => calls.listParams.at(-1)?.get("page")).toBe("2");
  await expect(page.getByText("Sản phẩm 21", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sau" })).toBeDisabled();

  await page.getByLabel("Tìm kiếm sản phẩm").fill("Sản phẩm 22");
  await page.getByLabel("Lọc trạng thái bán").selectOption("false");
  await page.getByRole("button", { name: "Lọc", exact: true }).click();

  await expect
    .poll(() => {
      const params = calls.listParams.at(-1);
      return `${params?.get("q")}|${params?.get("selling")}|${params?.get("page")}`;
    })
    .toBe("Sản phẩm 22|false|1");
  await expect(page.getByText("Sản phẩm 22", { exact: true })).toBeVisible();
  await expect(page.getByText("1 sản phẩm trong bộ lọc hiện tại")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Phân trang" })).toBeHidden();

  await page.getByLabel("Lọc sản phẩm bị ẩn").selectOption("true");
  await page.getByRole("button", { name: "Lọc", exact: true }).click();
  await expect.poll(() => calls.listParams.at(-1)?.get("adminHidden")).toBe("true");
});
