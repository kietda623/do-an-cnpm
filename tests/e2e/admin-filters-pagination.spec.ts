import { expect, test, type Page } from "@playwright/test";

const admin = {
  id: "00000000-0000-4000-8000-000000000101",
  email: "admin@example.test",
  fullName: "Admin Operator",
  phone: null,
  avatar: null,
  roles: ["ADMIN"],
  status: "ACTIVE",
  version: 0,
};

function userRow(index: number, status: "ACTIVE" | "LOCKED" = "ACTIVE") {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-0000000004${suffix}`,
    email: `member${suffix}@example.test`,
    fullName: `Member ${suffix}`,
    phone: null,
    status,
    version: 0,
    roles: ["BUYER"],
    createdAt: "2026-10-27T09:00:00.000Z",
  };
}

function auditRow(index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `audit-${suffix}`,
    actorId: admin.id,
    action: `fixture.action.${suffix}`,
    resourceType: index <= 20 ? "Product" : "Shop",
    resourceId: `00000000-0000-4000-8000-0000000005${suffix}`,
    reason: `Fixture reason ${suffix}`,
    requestId: `abcdef12-3456-7890-abcd-ef12345678${suffix}`,
    createdAt: "2026-10-27T10:00:00.000Z",
    metadata: { index },
  };
}

function shopRow(index: number) {
  const suffix = String(index).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-0000000006${suffix}`,
    name: `Shop ${suffix}`,
    slug: `shop-${suffix}`,
    status: "PENDING",
    description: `Fixture shop ${suffix}`,
    rejectionReason: null,
    version: 0,
    logo: null,
    createdAt: "2026-10-27T09:00:00.000Z",
  };
}

async function mockAdmin(page: Page) {
  const usersParams: URLSearchParams[] = [];
  const auditParams: URLSearchParams[] = [];
  const shopsParams: URLSearchParams[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    if (path === "/auth/csrf")
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path === "/auth/refresh")
      return route.fulfill({ json: { data: { accessToken: "access", user: admin } } });
    if (path === "/users/me") return route.fulfill({ json: { data: admin } });
    if (path === "/admin/shops") {
      shopsParams.push(url.searchParams);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const rows =
        pageNumber === 1
          ? Array.from({ length: 20 }, (_, index) => shopRow(index + 1))
          : Array.from({ length: 3 }, (_, index) => shopRow(index + 21));
      return route.fulfill({
        json: { data: rows, meta: { page: pageNumber, pageSize: 20, total: 23 } },
      });
    }
    if (path === "/admin/users") {
      usersParams.push(url.searchParams);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const q = url.searchParams.get("q");
      const status = url.searchParams.get("status");
      let rows =
        pageNumber === 1
          ? Array.from({ length: 20 }, (_, index) => userRow(index + 1))
          : Array.from({ length: 3 }, (_, index) => userRow(index + 21));
      if (q || status) {
        rows = [
          {
            ...userRow(1, "LOCKED"),
            fullName: "Locked Member",
            email: "locked@example.test",
          },
        ];
      }
      return route.fulfill({
        json: { data: rows, meta: { page: pageNumber, pageSize: 20, total: rows.length } },
      });
    }
    if (path === "/admin/audit") {
      auditParams.push(url.searchParams);
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const resourceType = url.searchParams.get("resourceType");
      const rows =
        resourceType === "Product"
          ? [auditRow(1), auditRow(2)]
          : pageNumber === 1
            ? Array.from({ length: 20 }, (_, index) => auditRow(index + 1))
            : [auditRow(21), auditRow(22)];
      return route.fulfill({
        json: { data: rows, meta: { page: pageNumber, pageSize: 20, total: rows.length } },
      });
    }
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
  return { usersParams, auditParams, shopsParams };
}

test("admin shop queue uses the server total and paginates", async ({ page }) => {
  const calls = await mockAdmin(page);
  await page.goto("/shops");

  const table = page.getByRole("table", { name: "Hồ sơ cửa hàng" });
  await expect(table).toContainText("Shop 01");
  await expect(table).toContainText("Shop 20");
  await expect(page.getByText("23 hồ sơ trong bộ lọc hiện tại")).toBeVisible();

  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => calls.shopsParams.at(-1)?.get("page")).toBe("2");
  await expect(table).toContainText("Shop 21");
  await expect(page.getByRole("button", { name: "Sau" })).toBeDisabled();
});

test("admin user list applies filters and paginates on the server", async ({ page }) => {
  const calls = await mockAdmin(page);
  await page.goto("/users");

  const table = page.getByRole("table", { name: "Danh sách người dùng" });
  await expect(table).toContainText("Member 01");
  await expect(table).toContainText("Member 20");

  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => calls.usersParams.at(-1)?.get("page")).toBe("2");
  await expect(table).toContainText("Member 21");
  await expect(page.getByRole("button", { name: "Sau" })).toBeDisabled();

  await page.getByLabel("Tìm kiếm người dùng").fill("locked");
  await page.getByLabel("Lọc trạng thái người dùng").selectOption("LOCKED");
  await page.getByRole("button", { name: "Tìm", exact: true }).click();

  await expect
    .poll(() => {
      const params = calls.usersParams.at(-1);
      return `${params?.get("q")}|${params?.get("status")}|${params?.get("page")}`;
    })
    .toBe("locked|LOCKED|1");
  await expect(table).toContainText("Locked Member");
  await expect(table).toContainText("Đã khóa");
});

test("admin audit log applies resource filters and paginates on the server", async ({ page }) => {
  const calls = await mockAdmin(page);
  await page.goto("/audit");

  const table = page.getByRole("table", { name: "Nhật ký quản trị" });
  await expect(table).toContainText("fixture.action.01");

  await page.getByRole("button", { name: "Sau" }).click();
  await expect.poll(() => calls.auditParams.at(-1)?.get("page")).toBe("2");
  await expect(table).toContainText("fixture.action.21");
  await expect(page.getByRole("button", { name: "Sau" })).toBeDisabled();

  await page.getByLabel("Lọc loại tài nguyên").fill("Product");
  await page.getByRole("button", { name: "Lọc", exact: true }).click();

  await expect
    .poll(() => {
      const params = calls.auditParams.at(-1);
      return `${params?.get("resourceType")}|${params?.get("page")}`;
    })
    .toBe("Product|1");
  await expect(table).toContainText("fixture.action.01");
  await expect(table).not.toContainText("fixture.action.21");
});
