/* global document, window, HTMLElement -- Playwright page callbacks run in the browser. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

// Read-only UI evidence against the running API. Credentials never enter reports.
const app = process.argv[2] || "buyer";
const ports = { buyer: 3000, seller: 3001, admin: 3002 };
if (!(app in ports)) throw new Error("Expected buyer, seller or admin");
const require = createRequire(path.resolve("apps/api/package.json"));
const env = require("dotenv").parse(fs.readFileSync(".env", "utf8"));
const out = path.join(os.tmpdir(), "cnpm-cyan-after");
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultNavigationTimeout(60000);
const base = `http://localhost:${ports[app]}`;
const records = [];
const errors = [];
const apiResponses = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => {
  if (response.url().includes("/api/v1/")) apiResponses.push({ path: new URL(response.url()).pathname, status: response.status() });
});

async function capture(name) {
  await page.waitForTimeout(700);
  await page.locator("h1").first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".mp-skeleton") && !/Đang tải|Đang khôi phục/.test(document.body.innerText), undefined, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(350);
    const file = `${app}-${name}-${width}.png`;
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    records.push({ app, name, route: new URL(page.url()).pathname, ...dimensions, file });
  }
  console.log(JSON.stringify({ app, captured: name }));
}

async function go(route, name) {
  // Prefer actual navigation controls, keeping the shared session mounted.
  let link = page.locator(`a[href="${route}"]:not(.mp-console__brand)`).filter({ visible: true }).first();
  if (!(await link.count()) && app !== "buyer") {
    const menu = page.getByRole("button", { name: "Mở điều hướng", exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      link = page.locator(`a[href="${route}"]:not(.mp-console__brand)`).filter({ visible: true }).first();
    }
  }
  if (await link.count()) await link.click();
  else await page.goto(`${base}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(url => url.pathname === route, { waitUntil: "domcontentloaded" });
  await capture(name);
}

try {
  await page.goto(`${base}/login`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture("login");
  if (app !== "admin") await go("/register", "register");
  await page.goto(`${base}/login`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const role = app === "buyer" ? "BUYER" : "ADMIN";
  await page.locator('input[type="email"]').fill(env[`IDENTITY_${role}_EMAIL`]);
  await page.locator('input[type="password"]').fill(env[`IDENTITY_${role}_PASSWORD`]);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(url => url.pathname !== "/login", { waitUntil: "domcontentloaded" });
  if (app === "seller") await page.waitForURL(url => /^\/shops(?:\/[^/]+\/dashboard)?$/.test(url.pathname), { waitUntil: "domcontentloaded" });
  if (app === "buyer") {
    for (const [route, name] of [["/", "home"], ["/products", "catalog"], ["/account", "profile"], ["/account/addresses", "addresses"], ["/cart", "cart"], ["/checkout", "checkout"], ["/orders", "orders"]]) await go(route, name);
  } else if (app === "seller") {
    await go("/shops", "shops");
    const dashboard = page.locator('a[href$="/dashboard"]').first();
    const href = await dashboard.getAttribute("href");
    if (!href) throw new Error("Existing shop dashboard link missing");
    const prefix = href.replace(/\/dashboard$/, "");
    for (const [suffix, name] of [["dashboard", "dashboard"], ["products", "products"], ["orders", "orders"], ["analytics", "analytics"], ["reviews", "reviews"], ["settings", "settings"]]) await go(`${prefix}/${suffix}`, name);
  } else {
    for (const [route, name] of [["/", "dashboard"], ["/shops", "shops"], ["/products", "products"], ["/users", "users"], ["/orders", "orders"], ["/orders/returns", "returns"], ["/audit", "audit"], ["/categories", "categories"]]) await go(route, name);
  }
} finally {
  fs.writeFileSync(path.join(out, `${app}.json`), JSON.stringify({ mode: "real API; current data; no seed/reset/mock", records, errors, apiResponses }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ app, screenshots: records.length, overflow: records.filter(row => row.scrollWidth > row.width), errors, out }));
