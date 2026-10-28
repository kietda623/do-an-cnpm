import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireApi = createRequire(resolve("apps/api/package.json"));
const { Pool } = requireApi("pg") as {
  Pool: new (options: { connectionString: string }) => {
    query: (
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  };
};
const testUrl = process.env.TEST_DATABASE_URL;
const password = "Disposable US8 fixture only 2026!";
let pool: InstanceType<typeof Pool>;
let api: APIRequestContext;
let child: ChildProcess | undefined;
let shopId: string, orderId: string, itemId: string;
const productId = "88888888-8888-4888-8888-000000000001";
const variantId = "88888888-8888-4888-8888-000000000002";

test.beforeAll(async ({ playwright }) => {
  if (!testUrl)
    throw new Error(
      "TEST_DATABASE_URL is required; no shared database fallback.",
    );
  const url = new URL(testUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    !/(?:_test|_disposable)$/i.test(name) ||
    process.env.TEST_DATABASE_NAME_CONFIRMATION !== name
  )
    throw new Error("A confirmed disposable test database is required.");
  const seed = spawnSync(
    process.execPath,
    [
      "--experimental-loader",
      "./scripts/resolve-prisma-generated-ts.mjs",
      "--experimental-strip-types",
      "prisma/seed/reviews-statistics.seed.ts",
    ],
    { cwd: resolve("apps/api"), env: process.env, encoding: "utf8" },
  );
  if (seed.status !== 0) throw new Error(`US8 seed failed: ${seed.stderr}`);
  pool = new Pool({ connectionString: testUrl });
  const fixture = await pool.query(
    "SELECT u.id AS buyer_id, s.id AS shop_id FROM users u CROSS JOIN shops s WHERE u.email_normalized = $1 AND s.slug_normalized = $2",
    ["us8-seed-buyer@example.test", "us8-statistics-seed"],
  );
  if (!fixture.rows[0]) throw new Error("US8 seed identities were not found.");
  const buyerId = String(fixture.rows[0].buyer_id);
  shopId = String(fixture.rows[0].shop_id);
  orderId = randomUUID();
  const partId = randomUUID();
  itemId = randomUUID();
  await pool.query(
    "INSERT INTO marketplace_orders (id,buyer_user_id,public_number,recipient_snapshot,payment_method,original_total,status) VALUES ($1,$2,$3,$4::jsonb,'COD',500,'COMPLETED')",
    [
      orderId,
      buyerId,
      `US8-LIVE-${randomUUID().slice(0, 16)}`,
      JSON.stringify({
        recipientName: "US8 Buyer",
        phone: "0901234567",
        line1: "1 Fixture Road",
        ward: "Ward",
        district: "District",
        province: "HCMC",
        country: "VN",
      }),
    ],
  );
  await pool.query(
    "INSERT INTO seller_orders (id,order_id,shop_id,shop_name_snapshot,status,original_total,completed_at) VALUES ($1,$2,$3,'US8 statistics fixture','COMPLETED',500,now())",
    [partId, orderId, shopId],
  );
  await pool.query(
    "INSERT INTO order_items (id,seller_order_id,shop_id,product_id,variant_id,product_name_snapshot,sku_snapshot,attributes_snapshot,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,$5,'US8 fixture product','US8-STATISTICS-SEED','{}'::jsonb,500,1,500)",
    [itemId, partId, shopId, productId, variantId],
  );
  api = await playwright.request.newContext();
  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("apps/api"),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      JWT_SIGNING_SECRET: randomBytes(48).toString("hex"),
      API_PORT: "4101",
      CORS_ORIGINS: "http://127.0.0.1:3100,http://127.0.0.1:3101",
    },
  });
  await expect
    .poll(
      async () => {
        if (child?.exitCode !== null)
          throw new Error("US8 API process exited before readiness.");
        try {
          return (await api.get("http://127.0.0.1:4101/health/ready")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);
});

test.afterAll(async () => {
  if (child && child.exitCode === null) {
    const ended = new Promise<void>((done) =>
      child!.once("exit", () => done()),
    );
    child.kill();
    await ended;
  }
  try {
    await pool?.query("DELETE FROM reviews WHERE order_item_id=$1", [itemId]);
    await pool?.query("DELETE FROM order_items WHERE id=$1", [itemId]);
    await pool?.query("DELETE FROM seller_orders WHERE order_id=$1", [orderId]);
    await pool?.query("DELETE FROM marketplace_orders WHERE id=$1", [orderId]);
  } finally {
    await pool?.end();
    await api?.dispose();
  }
});

async function login(page: Page, port: number, email: string) {
  await page.goto(`http://127.0.0.1:${port}/login`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test("buyer review and seller dashboard persist through the real API and PostgreSQL", async ({
  browser,
}) => {
  const buyerContext = await browser.newContext();
  const sellerContext = await browser.newContext();
  try {
    const buyer = await buyerContext.newPage();
    const seller = await sellerContext.newPage();
    await login(buyer, 3100, "us8-seed-buyer@example.test");
    await buyer.goto(`http://127.0.0.1:3100/orders/${orderId}`);
    await buyer.getByLabel("Số sao").selectOption("4");
    await buyer.getByLabel("Nhận xét").fill("Kiểm thử US8 với database thật");
    await buyer.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(buyer.getByText("Đã đánh giá", { exact: true })).toBeVisible();
    await buyer.goto(`http://127.0.0.1:3100/products/${productId}`);
    await expect(
      buyer.getByText("Kiểm thử US8 với database thật"),
    ).toBeVisible();
    const persisted = await pool.query(
      "SELECT rating,comment FROM reviews WHERE order_item_id=$1",
      [itemId],
    );
    expect(persisted.rows).toHaveLength(1);
    expect(persisted.rows[0]).toMatchObject({
      rating: 4,
      comment: "Kiểm thử US8 với database thật",
    });
    await login(seller, 3101, "us8-seed-seller@example.test");
    await seller.goto(`http://127.0.0.1:3101/shops/${shopId}/dashboard`);
    await expect(seller.getByText(/mô phỏng/i).first()).toBeVisible();
    await expect(
      seller.getByText("Kiểm thử US8 với database thật"),
    ).toBeVisible();
    await expect(seller.getByText("Sản phẩm: 1")).toBeVisible();
  } finally {
    await buyerContext.close();
    await sellerContext.close();
  }
});
