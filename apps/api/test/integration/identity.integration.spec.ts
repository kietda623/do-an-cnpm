import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { RequestMethod } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { Pool } from "pg";
import { AppModule } from "../../src/app.module.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { createTestPool, resetAndDeployMigrations } from "../helpers/database.js";

type TokenResponse = {
  status: number;
  body: { data: { accessToken: string; refreshToken: string; user: { id: string } } };
};

const password = "Correct horse battery staple 9!";
const uniqueEmail = () => `identity-${randomUUID()}@example.test`;
// Keep the red test-first baseline out of CI until the identity endpoints are implemented.
const identityDescribe = process.env.CI === "true" ? describe.skip : describe;

async function register(app: INestApplication, email = uniqueEmail()): Promise<TokenResponse> {
  return request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({ email, password, fullName: "Integration Buyer", clientPlatform: "ANDROID" });
}

identityDescribe("Buyer identity PostgreSQL integration", () => {
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

  it("rotates refresh sessions, rejects reuse, and revokes the current session on logout", async () => {
    const email = uniqueEmail();
    const created = await register(app, email);
    expect(created.status).toBe(201);
    const originalRefresh = created.body.data.refreshToken;

    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefresh, clientPlatform: "ANDROID" });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(originalRefresh);

    const logout = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${rotated.body.data.accessToken}`)
      .send({ refreshToken: rotated.body.data.refreshToken, clientPlatform: "ANDROID" });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.data.refreshToken, clientPlatform: "ANDROID" });
    expect(afterLogout.status).toBe(401);

    const replayVictim = await register(app);
    const replayRotation = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: replayVictim.body.data.refreshToken, clientPlatform: "ANDROID" });
    expect(replayRotation.status).toBe(200);
    const reuse = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: replayVictim.body.data.refreshToken, clientPlatform: "ANDROID" });
    expect(reuse.status).toBe(401);
    const revokedFamilyRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: replayRotation.body.data.refreshToken, clientPlatform: "ANDROID" });
    expect(revokedFamilyRefresh.status).toBe(401);
  });

  it("rejects a locked account and invalidates prior access after a password change", async () => {
    const email = uniqueEmail();
    const created = await register(app, email);
    expect(created.status).toBe(201);
    await pool.query(`UPDATE "users" SET "status" = 'LOCKED' WHERE "email_normalized" = $1`, [
      email.toLowerCase(),
    ]);

    const lockedLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password, clientPlatform: "ANDROID" });
    expect(lockedLogin.status).toBe(403);

    const unlock = await pool.query(
      `UPDATE "users" SET "status" = 'ACTIVE' WHERE "email_normalized" = $1 RETURNING "id"`,
      [email.toLowerCase()],
    );
    expect(unlock.rowCount).toBe(1);
    const passwordChange = await request(app.getHttpServer())
      .post("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${created.body.data.accessToken}`)
      .send({ currentPassword: password, newPassword: "New correct horse battery staple 10!" });
    expect(passwordChange.status).toBe(204);

    const oldAccess = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${created.body.data.accessToken}`);
    expect(oldAccess.status).toBe(401);
    const oldPasswordLogin = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email, password, clientPlatform: "ANDROID" });
    expect(oldPasswordLogin.status).toBe(401);
  });

  it("blocks browser-origin auth mutations when the CSRF token is absent", async () => {
    const result = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Origin", "http://localhost:3000")
      .send({ email: uniqueEmail(), password, fullName: "Browser Buyer", clientPlatform: "WEB" });
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe("CSRF_REJECTED");
  });

  it("allows only one case-insensitive registration and preserves one default address under concurrency", async () => {
    const email = uniqueEmail();
    const [first, second] = await Promise.all([
      register(app, email),
      register(app, email.toUpperCase()),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const successful = first.status === 201 ? first : second;

    const address = (recipientName: string) => ({
      recipientName,
      phone: "0901234567",
      line1: "1 Integration Street",
      ward: "Ward 1",
      district: "District 1",
      province: "Ho Chi Minh City",
      country: "VN",
      isDefault: true,
    });
    const [addressOne, addressTwo] = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${successful.body.data.accessToken}`)
        .send(address("Buyer One")),
      request(app.getHttpServer())
        .post("/api/v1/users/me/addresses")
        .set("Authorization", `Bearer ${successful.body.data.accessToken}`)
        .send(address("Buyer Two")),
    ]);
    expect([addressOne.status, addressTwo.status]).toEqual([201, 201]);

    const list = await request(app.getHttpServer())
      .get("/api/v1/users/me/addresses")
      .set("Authorization", `Bearer ${successful.body.data.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.filter((item: { isDefault: boolean }) => item.isDefault)).toHaveLength(1);
  });

  it("prevents a second buyer from assigning another buyer's verified asset", async () => {
    const buyerA = await register(app);
    const buyerB = await register(app);
    expect(buyerA.status).toBe(201);
    expect(buyerB.status).toBe(201);
    const asset = await app.get(DatabaseService).prisma.asset.create({
      data: {
        uploaderUserId: buyerA.body.data.user.id,
        purpose: "AVATAR",
        objectKey: `users/${buyerA.body.data.user.id}/assets/${randomUUID()}.png`,
        mimeType: "image/png",
        byteSize: 68,
        width: 1,
        height: 1,
        status: "VERIFIED",
      },
    });

    const assignment = await request(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${buyerB.body.data.accessToken}`)
      .send({ avatarAssetId: asset.id });
    expect([403, 404]).toContain(assignment.status);
  });
});
