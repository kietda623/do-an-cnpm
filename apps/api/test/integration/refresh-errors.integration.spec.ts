import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { RequestMethod, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { ContractErrorFilter } from "../../src/common/http/error.filter.js";
import { DatabaseService } from "../../src/database/prisma.service.js";
import { resetAndDeployMigrations } from "../helpers/database.js";

describe("refresh error codes over native and browser transports", () => {
  let app: INestApplication;
  const origin = "http://localhost:3000";
  const password = "Correct horse battery staple 9!";
  const email = () => `refresh-${randomUUID()}@example.test`;
  beforeAll(async () => {
    process.env.CORS_ORIGINS = origin;
    await resetAndDeployMigrations();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
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
  afterAll(async () => app?.close());

  it.each(["ANDROID", "WEB"] as const)(
    "returns identical codes for %s",
    async (platform) => {
      const mail = email();
      let csrf = "";
      let csrfCookie = "";
      if (platform === "WEB") {
        const response = await request(app.getHttpServer())
          .get("/api/v1/auth/csrf")
          .set("Origin", origin);
        expect(response.status).toBe(200);
        csrf = response.body.data.csrfToken;
        csrfCookie = (
          response.headers["set-cookie"] as unknown as string[]
        )[0]!.split(";")[0]!;
      }
      const send = (path: string, body: object, token?: string) => {
        const call = request(app.getHttpServer()).post(path).send(body);
        if (platform === "WEB")
          call
            .set("Origin", origin)
            .set("X-CSRF-Token", csrf)
            .set("Cookie", [
              csrfCookie,
              ...(token ? [`refresh_token=${token}`] : []),
            ]);
        return call;
      };
      const register = await send("/api/v1/auth/register", {
        email: mail,
        password,
        fullName: "Refresh Buyer",
        clientPlatform: platform,
      });
      expect(register.status).toBe(201);
      const cookieToken = (result: { headers: Record<string, unknown> }) =>
        (result.headers["set-cookie"] as string[])
          .find((value) => value.startsWith("refresh_token="))!
          .split(";")[0]!
          .slice("refresh_token=".length);
      const token =
        platform === "WEB"
          ? cookieToken(register)
          : (register.body.data.refreshToken as string);
      const refresh = (value: string) =>
        send(
          "/api/v1/auth/refresh",
          {
            clientPlatform: platform,
            ...(platform === "ANDROID" ? { refreshToken: value } : {}),
          },
          value,
        );
      const rotated = await refresh(token);
      expect(rotated.status).toBe(200);
      const next =
        platform === "WEB"
          ? cookieToken(rotated)
          : (rotated.body.data.refreshToken as string);
      const reused = await refresh(token);
      expect(reused.status).toBe(401);
      expect(reused.body.error.code).toBe("SESSION_REVOKED");
      const familyRevoked = await refresh(next);
      expect(familyRevoked.status).toBe(401);
      expect(familyRevoked.body.error.code).toBe("SESSION_REVOKED");
      const invalid = await refresh(`invalid-${randomUUID()}`);
      expect(invalid.status).toBe(401);
      expect(invalid.body.error.code).toBe("INVALID_REFRESH");
      const second = await send("/api/v1/auth/register", {
        email: email(),
        password,
        fullName: "Expiry Buyer",
        clientPlatform: platform,
      });
      expect(second.status).toBe(201);
      const expiredToken =
        platform === "WEB"
          ? cookieToken(second)
          : (second.body.data.refreshToken as string);
      await app
        .get(DatabaseService)
        .prisma.session.updateMany({
          where: {
            refreshHash: createHash("sha256")
              .update(expiredToken)
              .digest("hex"),
          },
          data: {
            createdAt: new Date(Date.now() - 8 * 86400_000),
            expiresAt: new Date(Date.now() - 86400_000),
          },
        });
      const expired = await refresh(expiredToken);
      expect(expired.status).toBe(401);
      expect(expired.body.error.code).toBe("INVALID_REFRESH");
    },
    60_000,
  );
});
