import { expect, test, type Page } from "@playwright/test";

async function catalog(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/csrf"))
      return route.fulfill({ json: { data: { csrfToken: "csrf" } } });
    if (path.endsWith("/auth/refresh"))
      return route.fulfill({
        status: 401,
        json: { error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
      });
    if (path.endsWith("/categories"))
      return route.fulfill({
        json: { data: [{ id: "clothing", name: "Thời trang", children: [] }] },
      });
    if (path.endsWith("/products"))
      return route.fulfill({
        json: {
          data: Array.from({ length: 12 }, (_, i) => ({
            id: `product-${i}`,
            shopId: "shop-one",
            shopName: "Cửa hàng thử nghiệm",
            name: `Áo linen màu tự nhiên phiên bản ${i + 1}`,
            image: null,
            minimumPrice: "250000",
            available: true,
            ratingCount: 0,
            ratingAverage: null,
          })),
          meta: { page: 1, pageSize: 24, total: 12 },
        },
      });
    return route.fulfill({
      status: 404,
      json: { error: { code: "NOT_FOUND", message: "Not found" } },
    });
  });
}

test("shopping home brings merchandise into the first desktop viewport", async ({
  page,
}) => {
  await catalog(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator(".mp-product-card").first();
  await expect(card).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(async () => {
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThan(750);
    expect(box!.width).toBeLessThanOrEqual(230);
  }).toPass({ timeout: 15000 });
});

test("phone catalog keeps two readable product columns without page overflow", async ({
  page,
}) => {
  await catalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products");
  const cards = page.locator(".mp-product-card");
  await expect(cards).toHaveCount(12);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
  expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  expect(first!.width).toBeGreaterThanOrEqual(150);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("primary and destructive action labels keep AA contrast in both themes", async ({
  page,
}) => {
  await catalog(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".mp-product-card").first()).toBeVisible();
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "contrast-controls";
    host.style.cssText =
      "position:fixed;inset:150px auto auto 24px;z-index:9999;display:flex;gap:16px";
    for (const variant of ["primary", "danger"]) {
      const button = document.createElement("button");
      button.className = `mp-button mp-button--md mp-button--${variant}`;
      button.textContent = variant;
      host.append(button);
    }
    document.body.append(host);
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const variant of ["primary", "danger"]) {
      const button = page.locator(`#contrast-controls .mp-button--${variant}`);
      for (const hover of [false, true]) {
        if (hover) await button.hover();
        else await page.mouse.move(0, 0);
        await expect
          .poll(
            () =>
              button.evaluate((element) => {
                const style = getComputedStyle(element);
                const luminance = (color: string) => {
                  // Computed colors may be OKLCH; parse through the browser,
                  // rather than treating their channels as 8-bit RGB.
                  const canvas = document.createElement("canvas");
                  const context = canvas.getContext("2d")!;
                  context.fillStyle = color;
                  context.fillRect(0, 0, 1, 1);
                  const rgb = Array.from(context.getImageData(0, 0, 1, 1).data)
                    .slice(0, 3)
                    .map((value) => {
                      const channel = value / 255;
                      return channel <= 0.04045
                        ? channel / 12.92
                        : ((channel + 0.055) / 1.055) ** 2.4;
                    });
                  return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
                };
                const ink = luminance(style.color),
                  fill = luminance(style.backgroundColor);
                return (
                  (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05)
                );
              }),
            {
              message: `${theme} ${variant} ${hover ? "hover" : "normal"} label contrast`,
            },
          )
          .toBeGreaterThanOrEqual(4.5);
      }
    }
  }
});

test("catalog filter controls fit their full placeholder and selected label", async ({
  page,
}) => {
  await catalog(page);
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/products");
    const search = page.getByPlaceholder("Tên hoặc mô tả sản phẩm");
    await expect(search).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const clipped = await page
      .locator(".mp-filter input, .mp-filter select")
      .evaluateAll((elements) =>
        elements.flatMap((element) => {
          const input = element as HTMLInputElement | HTMLSelectElement;
          const style = getComputedStyle(input);
          const text =
            input instanceof HTMLSelectElement
              ? (input.selectedOptions[0]?.textContent ?? "")
              : input.placeholder;
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d")!;
          ctx.font = style.font;
          const available =
            input.clientWidth -
            parseFloat(style.paddingLeft) -
            parseFloat(style.paddingRight);
          return ctx.measureText(text).width > available + 1 ? [text] : [];
        }),
      );
    expect(clipped, `clipped filter text at ${width}px`).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }
});

test("catalog entrance motion respects reduced motion", async ({ page }) => {
  await catalog(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/products");
  const card = page.locator(".mp-product-card").first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS("animation-name", "none");
  await card.hover();
  await expect(card).toHaveCSS("transform", "none");
  await expect(page.locator(".mp-filter")).toHaveCSS("animation-name", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(card).toHaveCSS("animation-name", "mp-product-arrive");
});

test("mobile navigation motion stays usable and honors reduced motion", async ({
  page,
}) => {
  await catalog(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/products");
  const trigger = page.locator(".mp-mobile-menu > summary");
  await trigger.click();
  const menu = page.locator(".mp-mobile-menu__panel");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("animation-name", "mp-popover-enter");
  await expect(
    menu.getByRole("link", { name: "Sản phẩm", exact: true }),
  ).toHaveAttribute("href", "/products");
  await trigger.click();
  await expect(menu).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await trigger.click();
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("animation-name", "none");
});
