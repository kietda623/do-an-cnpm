import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureHttp } from "../../src/common/http/configure-http.js";
import { DatabaseService } from "../../src/database/prisma.service.js";

const storefrontOrigin = "https://shop.example.test";
const blockedOrigins = ["https://unrelated.example.test", "tauri://localhost"];

describe("CORS headers on CSRF rejection", () => {
  let app: INestApplication;
  let previousOrigins: string | undefined;

  beforeAll(async () => {
    previousOrigins = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = storefrontOrigin;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // The rejection happens in middleware; no persistence is required.
      .overrideProvider(DatabaseService)
      .useValue({ isConfigured: false })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = previousOrigins;
  });

  it("allows the preflight for a browser auth mutation", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/v1/auth/register")
      .set("Origin", storefrontOrigin)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-csrf-token");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      storefrontOrigin,
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  for (const blockedOrigin of blockedOrigins) {
    it(`does not grant credentialed CORS to ${blockedOrigin}`, async () => {
      const response = await request(app.getHttpServer())
        .options("/api/v1/auth/refresh")
        .set("Origin", blockedOrigin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type,x-csrf-token");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(
        response.headers["access-control-allow-credentials"],
      ).toBeUndefined();
    });
  }

  it("keeps the CORS header on a CSRF rejection so the browser can read it", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Origin", storefrontOrigin)
      .set("X-CSRF-Token", "not-a-valid-csrf-token")
      .send({
        fullName: "CORS Probe",
        email: "cors-probe@example.test",
        password: "Correct horse battery staple 9!",
        clientPlatform: "WEB",
      });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_REJECTED");
    expect(response.headers["access-control-allow-origin"]).toBe(
      storefrontOrigin,
    );
  });

  it("lets a Bearer-authenticated write through when the browser has an unrelated cookie", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Origin", storefrontOrigin)
      .set("Cookie", "probe_cookie=1")
      .set("X-CSRF-Token", "not-a-valid-csrf-token")
      .send({
        name: "Probe shop",
        slug: "probe-shop",
        description: "Probe",
        contactAddress: "Probe",
        phone: "0923145200",
      });

    expect(response.status).toBe(401);
  });

  it("lets a Bearer-authenticated write through when the browser still holds a stale csrf cookie", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/shops")
      .set("Origin", storefrontOrigin)
      .set("Cookie", "csrf=stale.legacy")
      .set("X-CSRF-Token", "not-a-valid-csrf-token")
      .send({
        name: "Probe shop",
        slug: "probe-shop",
        description: "Probe",
        contactAddress: "Probe",
        phone: "0923145200",
      });

    expect(response.status).toBe(401);
  });

  it("accepts a browser auth mutation when the header matches the issued cookie", async () => {
    const issued = await request(app.getHttpServer())
      .get("/api/v1/auth/csrf")
      .set("Origin", storefrontOrigin);
    const token = issued.body.data.csrfToken as string;
    const cookiePair = String(issued.headers["set-cookie"]?.[0] ?? "").split(
      ";",
    )[0]!;

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("Origin", storefrontOrigin)
      .set("Cookie", cookiePair)
      .set("X-CSRF-Token", token)
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
