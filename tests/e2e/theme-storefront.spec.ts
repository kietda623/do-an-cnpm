import { expect, test, type Page } from "@playwright/test";

const buyer = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.test",
  fullName: "E2E Buyer",
  phone: null,
  avatar: null,
  roles: ["BUYER"],
  status: "ACTIVE",
  version: 0,
};

async function mockShell(page: Page, { authenticated }: { authenticated: boolean }) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return authenticated
        ? route.fulfill({ json: { data: { accessToken: "access", user: buyer } } })
        : route.fulfill({
            status: 401,
            json: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
          });
    if (path.endsWith("/users/me")) return route.fulfill({ json: { data: buyer } });
    if (path.endsWith("/cart"))
      return route.fulfill({
        json: {
          data: {
            id: "cart",
            version: 1,
            groups: [],
            selectedTotal: "0",
            currency: "VND",
          },
        },
      });
    if (path.endsWith("/categories")) return route.fulfill({ json: { data: [] } });
    if (path.endsWith("/products"))
      return route.fulfill({
        json: { data: [], meta: { page: 1, pageSize: 20, total: 0 } },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("theme follows the system preference and persists manual choices", async ({ page }) => {
  await mockShell(page, { authenticated: true });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-theme-mode", "system");

  const toLight = page.getByRole("button", { name: "Chuyển sang giao diện sáng" });
  await expect(toLight).toBeVisible();
  await toLight.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-theme-mode", "light");
  expect(await page.evaluate(() => window.localStorage.getItem("marketplace-theme"))).toBe(
    "light",
  );

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-theme-mode", "light");

  await page.getByRole("button", { name: "Chuyển sang giao diện tối" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => window.localStorage.getItem("marketplace-theme"))).toBe(
    "dark",
  );

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-theme-mode", "dark");

  await page.getByRole("button", { name: "Chuyển sang giao diện theo hệ thống" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(html).toHaveAttribute("data-theme-mode", "system");
  expect(await page.evaluate(() => window.localStorage.getItem("marketplace-theme"))).toBe(
    "system",
  );
});

test("theme toggle works with reduced motion and does not overflow at 360px", async ({
  page,
}) => {
  await mockShell(page, { authenticated: false });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);

  const toggle = page.getByRole("button", { name: "Chuyển sang giao diện sáng" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme-mode", "light");
  await page.getByRole("button", { name: "Chuyển sang giao diện tối" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
});

test("restoring a theme is immediate and skipped click animations do not throw", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockShell(page, { authenticated: true });
  await page.addInitScript(() => {
    localStorage.setItem("marketplace-theme", "light");
    const state = window as Window & { themeTransitions: number };
    state.themeTransitions = 0;
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (update: () => void) => {
        state.themeTransitions++;
        update();
        return {
          ready: Promise.reject(
            new DOMException("Transition was skipped", "AbortError"),
          ),
        };
      },
    });
  });
  await page.goto("/");
  const toggle = page.locator(".mp-theme-toggle");
  await expect(toggle).toHaveAttribute("data-theme-mode", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => (window as Window & { themeTransitions: number }).themeTransitions,
    ),
  ).toBe(0);
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(
      () => (window as Window & { themeTransitions: number }).themeTransitions,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
