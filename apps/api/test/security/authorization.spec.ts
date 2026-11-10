import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureHttp } from "../../src/common/http/configure-http.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { RateLimiterService } from "../../src/modules/identity/rate-limiter.service.js";
import { resetAndDeployMigrations } from "../helpers/database.js";

const id = "11111111-1111-4111-8111-111111111111";
const password = "Correct horse battery staple 9!";
const email = () => `security-${randomUUID()}@example.test`;
const integrationMode = process.env.API_TEST_MODE === "integration";

type Mutation = {
  method: "post" | "patch" | "put" | "delete";
  path: string;
};

const bearerProtectedMutations: Mutation[] = [
  { method: "post", path: "/api/v1/shops" },
  { method: "patch", path: `/api/v1/shops/${id}` },
  { method: "post", path: `/api/v1/shops/${id}/resubmit` },
  { method: "post", path: `/api/v1/admin/shops/${id}/approve` },
  { method: "post", path: `/api/v1/admin/shops/${id}/reject` },
  { method: "post", path: `/api/v1/admin/shops/${id}/suspend` },
  { method: "post", path: `/api/v1/admin/shops/${id}/resume` },
  { method: "post", path: "/api/v1/admin/categories" },
  { method: "patch", path: `/api/v1/admin/categories/${id}` },
  { method: "post", path: `/api/v1/shops/${id}/products` },
  { method: "patch", path: `/api/v1/shops/${id}/products/${id}` },
  { method: "post", path: `/api/v1/shops/${id}/products/${id}/variants` },
  { method: "patch", path: `/api/v1/shops/${id}/variants/${id}` },
  {
    method: "post",
    path: `/api/v1/shops/${id}/variants/${id}/inventory-adjustments`,
  },
  { method: "post", path: "/api/v1/payments/mock-attempts" },
  { method: "post", path: `/api/v1/payments/${id}/mock-result` },
  {
    method: "post",
    path: `/api/v1/payments/seller-orders/${id}/cod-collection`,
  },
  { method: "post", path: `/api/v1/orders/${id}/cancel` },
  { method: "post", path: `/api/v1/orders/${id}/seller-orders/${id}/cancel` },
  { method: "post", path: `/api/v1/shops/${id}/orders/${id}/reject` },
  { method: "post", path: `/api/v1/admin/seller-orders/${id}/reject` },
  { method: "post", path: "/api/v1/reviews" },
  { method: "post", path: "/api/v1/auth/logout" },
  { method: "patch", path: "/api/v1/users/me" },
  { method: "post", path: "/api/v1/users/me/password" },
  { method: "post", path: "/api/v1/users/me/addresses" },
  { method: "patch", path: `/api/v1/users/me/addresses/${id}` },
  { method: "delete", path: `/api/v1/users/me/addresses/${id}` },
  { method: "post", path: "/api/v1/users/me/assets" },
  { method: "post", path: "/api/v1/cart/items" },
  { method: "patch", path: `/api/v1/cart/items/${id}` },
  { method: "delete", path: `/api/v1/cart/items/${id}` },
  { method: "post", path: `/api/v1/shipments/${id}/events` },
  { method: "post", path: `/api/v1/shipments/${id}/retry` },
  { method: "post", path: "/api/v1/checkout" },
  { method: "post", path: `/api/v1/orders/${id}/seller-orders/${id}/receive` },
  { method: "post", path: `/api/v1/admin/products/${id}/hide` },
  { method: "post", path: "/api/v1/checkout/quotes" },
  { method: "post", path: `/api/v1/shops/${id}/orders/${id}/confirm` },
  { method: "post", path: `/api/v1/shops/${id}/orders/${id}/pack` },
  { method: "post", path: `/api/v1/admin/shipments/${id}/return-confirmation` },
  { method: "post", path: `/api/v1/admin/seller-orders/${id}/confirm` },
  { method: "post", path: `/api/v1/admin/seller-orders/${id}/pack` },
  { method: "post", path: `/api/v1/admin/users/${id}/lock` },
  { method: "post", path: `/api/v1/admin/users/${id}/unlock` },
];

describe("security authorization boundaries", () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (integrationMode) await resetAndDeployMigrations();
    const moduleBuilder = Test.createTestingModule({ imports: [AppModule] });
    if (!integrationMode) {
      moduleBuilder.overrideProvider(DatabaseService).useValue({
        isConfigured: false,
        prisma: {},
      });
    }
    const moduleRef = await moduleBuilder
      .overrideProvider(RateLimiterService)
      .useValue({
        assertRegisterAllowed: async () => {},
        assertLoginAllowed: async () => {},
        assertRefreshIpAllowed: async () => {},
        assertRefreshFamilyAllowed: async () => {},
      })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureHttp(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it.each(bearerProtectedMutations)(
    "rejects an unauthenticated $method $path",
    async (route) => {
      const client = request(app.getHttpServer());
      const result = await client[route.method](route.path).send({});
      expect(result.status).toBe(401);
    },
  );

  const integrationIt = integrationMode ? it : it.skip;
  integrationIt(
    "does not let another buyer read, update, or delete a user's address",
    async () => {
      const db = app.get(DatabaseService);
      const owner = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: email(),
          password,
          fullName: "Address Owner",
          clientPlatform: "ANDROID",
        });
      expect(owner.status).toBe(201);

      const created = await request(app.getHttpServer())
        .post("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
        .send({
          recipientName: "Address Owner",
          phone: "0901234567",
          line1: "1 Test Street",
          ward: "Ward 1",
          district: "District 1",
          province: "Ho Chi Minh City",
          country: "VN",
          isDefault: true,
        });
      expect(created.status).toBe(201);

      const other = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({
          email: email(),
          password,
          fullName: "Other Buyer",
          clientPlatform: "ANDROID",
        });
      expect(other.status).toBe(201);
      const otherToken = other.body.data.accessToken as string;
      const addressId = created.body.data.id as string;

      const read = await request(app.getHttpServer())
        .get("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${otherToken}`);
      expect(read.status).toBe(200);
      expect(read.body.data).toEqual([]);

      const update = await request(app.getHttpServer())
        .patch(`/api/v1/users/me/addresses/${addressId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ recipientName: "Changed by another buyer" });
      expect(update.status).toBe(404);

      const remove = await request(app.getHttpServer())
        .delete(`/api/v1/users/me/addresses/${addressId}`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(remove.status).toBe(404);

      const ownerRead = await request(app.getHttpServer())
        .get("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${owner.body.data.accessToken}`);
      expect(ownerRead.status).toBe(200);
      expect(ownerRead.body.data).toEqual([
        expect.objectContaining({
          id: addressId,
          recipientName: "Address Owner",
        }),
      ]);
      const stored = await db.prisma.address.findUnique({
        where: { id: addressId },
      });
      expect(stored?.deletedAt).toBeNull();
    },
  );
});
