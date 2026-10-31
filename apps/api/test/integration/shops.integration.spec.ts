import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";
import type { Pool } from "pg";

type AuthResult = {
  status: number;
  body: { data: { accessToken: string; user: { id: string } } };
};

type ShopResult = {
  status: number;
  body: {
    data: { id: string; slug: string; status: string; version: number; rejectionReason?: string };
  };
};

const password = "Correct horse battery staple 9!";
const uniqueEmail = () => `shop-${randomUUID()}@example.test`;

async function register(app: INestApplication, email = uniqueEmail()): Promise<AuthResult> {
  return request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, password, fullName: "Shop Applicant", clientPlatform: "ANDROID" });
}

describe("shop onboarding PostgreSQL integration", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix("api/v1", {
      exclude: [
        { path: "health/live", method: RequestMethod.GET },
        { path: "health/ready", method: RequestMethod.GET },
      ],
    });
    const csrf = app.get(CsrfRequestMiddleware);
    app.use(csrf.use.bind(csrf));
    app.useGlobalFilters(new ContractErrorFilter());
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  async function verifiedLogo(userId: string, key = randomUUID()) {
    return app.get(DatabaseService).prisma.asset.create({
      data: {
        uploaderUserId: userId,
        purpose: "SHOP_LOGO",
        objectKey: `users/${userId}/assets/${key}.png`,
        mimeType: "image/png",
        byteSize: 68,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });
  }

  async function createShop(
    token: string,
    logoAssetId: string,
    slug = `shop-${randomUUID().slice(0, 8)}`,
  ): Promise<ShopResult> {
    return request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Integration Shop",
        slug,
        description: "A shop used by PostgreSQL integration tests.",
        logoAssetId,
        contactAddress: "1 Integration Street, Ward 1",
        phone: "0901234567",
      });
  }

  async function adminToken(): Promise<string> {
    const admin = await register(app);
    expect(admin.status).toBe(201);
    await app.get(DatabaseService).prisma.user.update({
      where: { id: admin.body.data.user.id },
      data: { systemRole: "ADMIN" },
    });
    return admin.body.data.accessToken;
  }

  it("creates the owner membership atomically and hides pending shops from public reads", async () => {
    const owner = await register(app);
    const logo = await verifiedLogo(owner.body.data.user.id);
    const created = await createShop(owner.body.data.accessToken, logo.id);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe("PENDING");

    const memberships = await request(app.getHttpServer())
      .get("/api/v1/users/me/shops")
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`);
    expect(memberships.status).toBe(200);
    expect(memberships.body.data).toEqual([
      expect.objectContaining({
        shopId: created.body.data.id,
        role: "OWNER",
        shopStatus: "PENDING",
      }),
    ]);

    const publicRead = await request(app.getHttpServer()).get(
      `/api/v1/shops/${created.body.data.id}`,
    );
    expect(publicRead.status).toBe(404);
    const outsider = await register(app);
    const managementRead = await request(app.getHttpServer())
      .get(`/api/v1/shops/${created.body.data.id}/management`)
      .set("Authorization", `Bearer ${outsider.body.data.accessToken}`);
    expect(managementRead.status).toBe(404);

    const persisted = await app.get(DatabaseService).prisma.shop.findUnique({
      where: { id: created.body.data.id },
      include: { members: true, logo: true },
    });
    expect(persisted?.members).toHaveLength(1);
    expect(persisted?.members[0]).toMatchObject({ userId: owner.body.data.user.id, role: "OWNER" });
    expect(persisted?.logo).toMatchObject({ shopId: created.body.data.id, status: "VERIFIED" });
  });

  it("serializes duplicate slugs and never binds a logo owned by another buyer", async () => {
    const [first, second] = await Promise.all([register(app), register(app)]);
    const [firstLogo, secondLogo] = await Promise.all([
      verifiedLogo(first.body.data.user.id),
      verifiedLogo(second.body.data.user.id),
    ]);
    const slug = `race-${randomUUID().slice(0, 8)}`;
    const results = await Promise.all([
      createShop(first.body.data.accessToken, firstLogo.id, slug),
      createShop(second.body.data.accessToken, secondLogo.id, slug),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);

    const foreign = await createShop(second.body.data.accessToken, firstLogo.id);
    expect([403, 404]).toContain(foreign.status);
    const unverified = await app.get(DatabaseService).prisma.asset.create({
      data: {
        uploaderUserId: second.body.data.user.id,
        purpose: "SHOP_LOGO",
        objectKey: `users/${second.body.data.user.id}/assets/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 68,
        width: 1,
        height: 1,
        status: "PENDING",
      },
    });
    const pendingLogo = await createShop(second.body.data.accessToken, unverified.id);
    expect([403, 404, 422]).toContain(pendingLogo.status);

    const logos = await Promise.all(
      [firstLogo, secondLogo].map(({ id }) =>
        app.get(DatabaseService).prisma.asset.findUniqueOrThrow({ where: { id } }),
      ),
    );
    const winner = results.findIndex(({ status }) => status === 201);
    expect(logos[winner].shopId).toBe(results[winner].body.data.id);
    expect(logos[1 - winner].shopId).toBeNull();
  });

  it("enforces moderation states, optimistic versions, immutable approved slugs, and audit records", async () => {
    const owner = await register(app);
    const logo = await verifiedLogo(owner.body.data.user.id);
    const created = await createShop(owner.body.data.accessToken, logo.id);
    expect(created.status).toBe(201);
    const admin = await adminToken();

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${created.body.data.id}/reject`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ reason: "Please provide valid shop documentation.", expectedVersion: 0 });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({ status: "REJECTED", version: 1 });

    const resubmitted = await request(app.getHttpServer())
      .post(`/api/v1/shops/${created.body.data.id}/resubmit`)
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
      .send({ expectedVersion: 1 });
    expect(resubmitted.status).toBe(200);
    expect(resubmitted.body.data).toMatchObject({ status: "PENDING", version: 2 });

    const [approveOne, approveTwo] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/admin/shops/${created.body.data.id}/approve`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ expectedVersion: 2 }),
      request(app.getHttpServer())
        .post(`/api/v1/admin/shops/${created.body.data.id}/approve`)
        .set("Authorization", `Bearer ${admin}`)
        .send({ expectedVersion: 2 }),
    ]);
    expect([approveOne.status, approveTwo.status].sort()).toEqual([200, 409]);
    const approved = approveOne.status === 200 ? approveOne : approveTwo;
    expect(approved.body.data).toMatchObject({ status: "ACTIVE", version: 3 });
    expect(approved.body.data.approvedAt).toBeTruthy();

    const publicShop = await request(app.getHttpServer()).get(
      `/api/v1/shops/${created.body.data.id}`,
    );
    expect(publicShop.status).toBe(200);
    expect(publicShop.body.data).not.toHaveProperty("contactAddress");
    expect(publicShop.body.data).not.toHaveProperty("phone");
    expect(publicShop.body.data).not.toHaveProperty("version");

    const renameSlug = await request(app.getHttpServer())
      .patch(`/api/v1/shops/${created.body.data.id}`)
      .set("Authorization", `Bearer ${owner.body.data.accessToken}`)
      .send({ slug: "changed-approved-slug", expectedVersion: 3 });
    expect(renameSlug.status).toBe(409);

    const audit = await app.get(DatabaseService).prisma.auditEvent.findMany({
      where: { targetType: "Shop", targetId: created.body.data.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map(({ action }) => action)).toEqual([
      "shop.created",
      "shop.rejected",
      "shop.resubmitted",
      "shop.approved",
    ]);
    expect(audit[1]?.reason).toBe("Please provide valid shop documentation.");
    expect(audit[1]?.actorUserId).toBeTruthy();
  });

  it("restricts moderation to active admins and denies shop writes for locked accounts", async () => {
    const applicant = await register(app);
    const logo = await verifiedLogo(applicant.body.data.user.id);
    const created = await createShop(applicant.body.data.accessToken, logo.id);
    expect(created.status).toBe(201);
    const admin = await adminToken();
    await app.get(DatabaseService).prisma.user.update({
      where: { id: applicant.body.data.user.id },
      data: { status: "LOCKED" },
    });
    const lockedWrite = await createShop(applicant.body.data.accessToken, logo.id);
    expect(lockedWrite.status).toBe(401);

    const applicantModeration = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${created.body.data.id}/approve`)
      .set("Authorization", `Bearer ${applicant.body.data.accessToken}`)
      .send({ expectedVersion: 0 });
    expect(applicantModeration.status).toBe(401);

    const activeAdmin = await request(app.getHttpServer())
      .post(`/api/v1/admin/shops/${created.body.data.id}/approve`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ expectedVersion: 0 });
    expect(activeAdmin.status).toBe(200);
  });
});
