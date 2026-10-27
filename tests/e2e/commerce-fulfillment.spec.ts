import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
const requireApi = createRequire(resolve("apps/api/package.json"));
const { config } = requireApi("dotenv") as {
  config: (options: { path: string; quiet: boolean }) => void;
};
const { Pool } = requireApi("pg") as {
  Pool: new (options: { connectionString: string }) => {
    query: (
      sql: string,
      values?: unknown[],
    ) => Promise<{ rows: Array<Record<string, unknown>> }>;
    end: () => Promise<void>;
  };
};
config({ path: resolve(".env.test"), quiet: true });
const password = "Fulfillment browser fixture 9!";
const base = "http://127.0.0.1:4100/api/v1";
let child: ChildProcess | undefined;
let api: APIRequestContext;
let pool: InstanceType<typeof Pool>;
const testUrl = process.env.TEST_DATABASE_URL;
const signingSecret = randomBytes(48).toString("hex");
let actorNumber = 0;
type Actor = { id: string; email: string; token: string };
type Part = {
  id: string;
  shopId: string;
  status: string;
  version: number;
  shipment: {
    id: string;
    status: string;
    version: number;
    attemptNumber: number;
  } | null;
};
async function startApi() {
  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: resolve("apps/api"),
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      JWT_SIGNING_SECRET: signingSecret,
      API_PORT: "4100",
      CORS_ORIGINS:
        "http://127.0.0.1:3100,http://127.0.0.1:3101,http://127.0.0.1:3102",
    },
  });
  await expect
    .poll(
      async () => {
        try {
          return (await api.get("http://127.0.0.1:4100/health/ready")).status();
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);
}
async function stopApi() {
  const active = child;
  child = undefined;
  if (active && active.exitCode === null) {
    const exited = new Promise<void>((done) =>
      active.once("exit", () => done()),
    );
    active.kill();
    await exited;
  }
}
async function post(path: string, token: string | undefined, data: unknown) {
  const response = await api.post(`${base}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Idempotency-Key": randomUUID(),
    },
    data,
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
  return (await response.json()).data;
}
async function actor(role: "BUYER" | "ADMIN" = "BUYER"): Promise<Actor> {
  const email = `live-${randomUUID()}-${actorNumber++}@example.test`;
  const created = await post("/auth/register", undefined, {
    email,
    password,
    fullName: "Live fixture",
    clientPlatform: "ANDROID",
  });
  if (role === "ADMIN")
    await pool.query("UPDATE users SET system_role='ADMIN' WHERE id=$1", [
      created.user.id,
    ]);
  return { id: created.user.id, email, token: created.accessToken };
}
async function asset(owner: Actor, shopId?: string) {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO assets (id,uploader_user_id,shop_id,purpose,object_key,mime_type,byte_size,width,height,status) VALUES ($1,$2,$3,$4,$5,'image/png',64,1,1,'VERIFIED')",
    [
      id,
      owner.id,
      shopId ?? null,
      shopId ? "PRODUCT_IMAGE" : "SHOP_LOGO",
      `live/${id}.png`,
    ],
  );
  return id;
}
async function shop(
  owner: Actor,
  admin: Actor,
  categoryId: string,
  label: string,
) {
  const logoAssetId = await asset(owner);
  const created = await post("/shops", owner.token, {
    name: label,
    slug: `live-${randomUUID().slice(0, 12)}`,
    description: "Live browser fixture",
    logoAssetId,
    contactAddress: "Test address",
    phone: "0901234567",
  });
  await post(`/admin/shops/${created.id}/approve`, admin.token, {
    expectedVersion: 0,
  });
  const product = await post(`/shops/${created.id}/products`, owner.token, {
    name: label,
    description: "Live test product",
    categoryId,
    imageAssetIds: [await asset(owner, created.id)],
    selling: true,
    variants: [
      {
        sku: `LIVE-${randomUUID()}`,
        attributes: { size: "M" },
        price: "1250",
        stock: 10,
        selling: true,
      },
    ],
  });
  return {
    id: created.id as string,
    variantId: product.variants[0].id as string,
    label,
  };
}
async function login(page: Page, port: number, user: Actor) {
  await page.goto(`http://127.0.0.1:${port}/login`);
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByRole("button", { name: /Đăng nhập/ }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
async function getOrder(
  id: string,
  buyer: Actor,
): Promise<{
  sellerOrders: Part[];
  status: string;
  paymentStatus: string;
  capturedAmount: string;
  refundedAmount: string;
  outstandingAmount: string;
}> {
  const response = await api.get(`${base}/orders/${id}`, {
    headers: { Authorization: `Bearer ${buyer.token}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).data;
}
async function sellerStep(
  page: Page,
  shopId: string,
  partId: string,
  name: string,
) {
  await page.goto(`http://127.0.0.1:3101/shops/${shopId}/orders`);
  await page
    .getByRole("textbox")
    .fill("Live delivery inspection and retry reason");
  const section = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: new RegExp(partId) }) });
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.url().startsWith(base) &&
      !r.url().includes("/auth/"),
  );
  await section.getByRole("button", { name, exact: true }).click();
  expect((await response).ok()).toBeTruthy();
}
test.beforeAll(async ({ playwright }) => {
  if (!testUrl)
    throw new Error("TEST_DATABASE_URL is required; no production fallback.");
  const url = new URL(testUrl);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (
    !/(?:_test|_disposable)$/i.test(name) ||
    process.env.TEST_DATABASE_NAME_CONFIRMATION !== name
  )
    throw new Error("A confirmed disposable test database is required.");
  pool = new Pool({ connectionString: testUrl });
  api = await playwright.request.newContext();
  await startApi();
});
test.afterAll(async () => {
  await stopApi();
  await pool?.end();
  await api?.dispose();
});

test("live two-shop commerce: MOCK, COD, cancellation, retry, return and restart", async ({
  browser,
}) => {
  const admin = await actor("ADMIN");
  const buyer = await actor();
  const ownerA = await actor();
  const ownerB = await actor();
  const category = await post("/admin/categories", admin.token, {
    name: `Live ${randomUUID()}`,
    parentId: null,
    visible: true,
  });
  const a = await shop(ownerA, admin, category.id, "Live Shop A");
  const b = await shop(ownerB, admin, category.id, "Live Shop B");
  await post("/users/me/addresses", buyer.token, {
    recipientName: "Live buyer",
    phone: "0901234567",
    line1: "1 Test Road",
    ward: "Ward",
    district: "District",
    province: "HCMC",
    country: "VN",
    isDefault: true,
  });
  const buyerContext = await browser.newContext();
  const sellerAContext = await browser.newContext();
  const sellerBContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const buyerPage = await buyerContext.newPage();
  const sellerA = await sellerAContext.newPage();
  const sellerB = await sellerBContext.newPage();
  const adminPage = await adminContext.newPage();
  await login(buyerPage, 3100, buyer);
  await login(sellerA, 3101, ownerA);
  await login(sellerB, 3101, ownerB);
  await login(adminPage, 3102, admin);
  async function checkout(method: "MOCK" | "COD") {
    for (const item of [a, b])
      await post("/cart/items", buyer.token, {
        variantId: item.variantId,
        quantity: 1,
      });
    await buyerPage.goto("http://127.0.0.1:3100/checkout");
    if (method === "MOCK") await buyerPage.getByRole("radio").nth(1).check();
    await buyerPage
      .getByRole("button", { name: "Kiểm tra giá và tồn kho", exact: true })
      .click();
    await buyerPage
      .getByRole("button", { name: "Đặt hàng", exact: true })
      .click();
    await expect(buyerPage).toHaveURL(/\/orders\/[0-9a-f-]+$/);
    return buyerPage.url().split("/").at(-1)!;
  }
  const mockId = await checkout("MOCK");
  await buyerPage
    .getByRole("button", {
      name: "Mô phỏng thanh toán thành công",
      exact: true,
    })
    .click();
  await expect(
    buyerPage.getByText("Thanh toán thử nghiệm thành công.", { exact: true }),
  ).toBeVisible();
  let order = await getOrder(mockId, buyer);
  const mockA = order.sellerOrders.find((p) => p.shopId === a.id)!;
  const mockB = order.sellerOrders.find((p) => p.shopId === b.id)!;
  await buyerPage
    .getByRole("button", { name: `Hủy riêng ${b.label}`, exact: true })
    .click();
  await buyerPage
    .getByRole("textbox")
    .fill("Cancel second shop after mock capture");
  await buyerPage
    .getByRole("button", { name: "Xác nhận hủy", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await getOrder(mockId, buyer)).sellerOrders.find(
          (p) => p.id === mockB.id,
        )!.status,
    )
    .toBe("CANCELLED");
  await sellerStep(sellerA, a.id, mockA.id, "Xác nhận đơn");
  await sellerStep(sellerA, a.id, mockA.id, "Đã đóng gói");
  for (const step of ["PICKED_UP", "IN_TRANSIT", "FAILED"]) {
    if (step === "FAILED") {
      await sellerA.getByRole("textbox").fill("Recipient unavailable");
    }
    await sellerStep(sellerA, a.id, mockA.id, step);
  }
  await sellerA.getByRole("textbox").fill("Retry delivery after contact");
  await sellerStep(sellerA, a.id, mockA.id, "Giao lại");
  for (const step of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"])
    await sellerStep(sellerA, a.id, mockA.id, step);
  await stopApi();
  await startApi();
  await buyerPage.reload();
  await buyerPage
    .getByRole("button", { name: "Tôi đã nhận đủ hàng", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await getOrder(mockId, buyer)).sellerOrders.find(
          (p) => p.id === mockA.id,
        )!.status,
    )
    .toBe("COMPLETED");
  const codId = await checkout("COD");
  order = await getOrder(codId, buyer);
  const codA = order.sellerOrders.find((p) => p.shopId === a.id)!;
  const codB = order.sellerOrders.find((p) => p.shopId === b.id)!;
  await sellerStep(sellerA, a.id, codA.id, "Xác nhận đơn");
  await sellerStep(sellerA, a.id, codA.id, "Đã đóng gói");
  for (const step of ["PICKED_UP", "IN_TRANSIT", "DELIVERED"])
    await sellerStep(sellerA, a.id, codA.id, step);
  await buyerPage.reload();
  await expect(
    buyerPage.getByRole("button", { name: "Tôi đã nhận đủ hàng" }),
  ).toHaveCount(0);
  await sellerStep(sellerA, a.id, codA.id, "Ghi nhận đã thu COD");
  await buyerPage.reload();
  await buyerPage
    .getByRole("button", { name: "Tôi đã nhận đủ hàng", exact: true })
    .click();
  await sellerStep(sellerB, b.id, codB.id, "Xác nhận đơn");
  await sellerStep(sellerB, b.id, codB.id, "Đã đóng gói");
  for (const step of ["PICKED_UP", "IN_TRANSIT", "FAILED"]) {
    if (step === "FAILED")
      await sellerB.getByRole("textbox").fill("Return to sender");
    await sellerStep(sellerB, b.id, codB.id, step);
  }
  order = await getOrder(codId, buyer);
  const failed = order.sellerOrders.find((p) => p.id === codB.id)!.shipment!;
  await adminPage.goto("http://127.0.0.1:3102/shipments");
  await adminPage.getByLabel("Mã shipment").fill(failed.id);
  await adminPage.getByRole("button", { name: "Tra cứu", exact: true }).click();
  await adminPage
    .getByLabel("Lý do", { exact: true })
    .fill("Warehouse inspected returned goods");
  await adminPage
    .getByRole("button", {
      name: "Xác nhận hàng đã hoàn về và hủy đơn",
      exact: true,
    })
    .click();
  await expect
    .poll(
      async () =>
        (await getOrder(codId, buyer)).sellerOrders.find(
          (p) => p.id === codB.id,
        )!.status,
    )
    .toBe("CANCELLED");
  expect(await getOrder(mockId, buyer)).toMatchObject({
    capturedAmount: "2500",
    refundedAmount: "1250",
    outstandingAmount: "0",
    paymentStatus: "PARTIALLY_REFUNDED",
  });
  expect(await getOrder(codId, buyer)).toMatchObject({
    capturedAmount: "1250",
    refundedAmount: "0",
    outstandingAmount: "0",
    paymentStatus: "PAID",
  });
  const stocks = await pool.query(
    "SELECT variant_id,available_quantity FROM inventory WHERE variant_id=ANY($1::uuid[]) ORDER BY variant_id",
    [[a.variantId, b.variantId]],
  );
  expect(
    stocks.rows.find((row) => row.variant_id === a.variantId)
      ?.available_quantity,
  ).toBe(8);
  expect(
    stocks.rows.find((row) => row.variant_id === b.variantId)
      ?.available_quantity,
  ).toBe(10);
  await buyerPage.goto(`http://127.0.0.1:3100/orders/${codId}`);
  await expect(buyerPage.getByText("COMPLETED", { exact: true })).toBeVisible();
  await expect(buyerPage.getByText("CANCELLED", { exact: true })).toBeVisible();
  await expect(
    adminPage
      .getByRole("listitem")
      .filter({ hasText: "Warehouse inspected returned goods" }),
  ).toBeVisible();
  await buyerPage.screenshot({
    path: "test-results/fulfillment-live-buyer.png",
    fullPage: true,
  });
  await adminPage.screenshot({
    path: "test-results/fulfillment-live-admin.png",
    fullPage: true,
  });
  for (const context of [
    buyerContext,
    sellerAContext,
    sellerBContext,
    adminContext,
  ])
    await context.close();
});
