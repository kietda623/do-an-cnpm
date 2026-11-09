import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient } from "redis";
import request from "supertest";
import { AppModule } from "../../src/app.module.js";
import { configureHttp } from "../../src/common/http/configure-http.js";
import { RATE_LIMIT_STORE } from "../../src/modules/identity/rate-limit/rate-limit-store.js";
import { RedisRateLimitStore } from "../../src/modules/identity/rate-limit/redis-rate-limit-store.js";
import { RateLimiterService } from "../../src/modules/identity/rate-limiter.service.js";
import {
  createTestPool,
  resetAndDeployMigrations,
} from "../helpers/database.js";

const redisUrl = process.env.RATE_LIMIT_REDIS_URL ?? "redis://127.0.0.1:56380";
const secret = "auth-rate-limit-integration-key-is-at-least-32-characters";
const testPrefix = `auth-rate-limit:${randomUUID()}`;
const environment = process.env.NODE_ENV ?? "test";
const store = new RedisRateLimitStore(redisUrl, environment, testPrefix);
const cleanupClient = createClient({ url: redisUrl });
cleanupClient.on("error", () => {});
const password = "Correct horse battery staple 9!";
const uniqueEmail = () => `rate-limit-${randomUUID()}@example.test`;

type TokenResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: { data: { accessToken: string; refreshToken: string } };
};

async function register(
  app: INestApplication,
  email: string,
): Promise<TokenResponse> {
  return request(app.getHttpServer())
    .post("/api/v1/auth/register")
    .send({
      email,
      password,
      fullName: "Rate Limit Buyer",
      clientPlatform: "ANDROID",
    });
}

async function refresh(
  app: INestApplication,
  refreshToken: string,
): Promise<TokenResponse> {
  return request(app.getHttpServer())
    .post("/api/v1/auth/refresh")
    .send({ refreshToken, clientPlatform: "ANDROID" });
}

describe("authentication rate limits over PostgreSQL and Redis", () => {
  let app: INestApplication;
  let pool: Awaited<ReturnType<typeof createTestPool>>;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
    await cleanupClient.connect();

    const rateLimiter = new RateLimiterService(
      store,
      new ConfigService({
        RATE_LIMIT_KEY_SECRET: secret,
        RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE: "10",
        RATE_LIMIT_REGISTER_IP_PER_MINUTE: "100",
        RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE: "10",
        RATE_LIMIT_LOGIN_IP_PER_MINUTE: "100",
        RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE: "2",
        RATE_LIMIT_REFRESH_IP_PER_MINUTE: "100",
      }),
    );
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RATE_LIMIT_STORE)
      .useValue(store)
      .overrideProvider(RateLimiterService)
      .useValue(rateLimiter)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureHttp(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await pool?.end();

    if (cleanupClient.isReady) {
      let cursor = "0";
      do {
        const result = await cleanupClient.scan(cursor, {
          MATCH: `${environment}:${testPrefix}:*`,
          COUNT: 100,
        });
        cursor = result.cursor;
        if (result.keys.length > 0) await cleanupClient.del(result.keys);
      } while (cursor !== "0");
    }
    if (cleanupClient.isOpen) await cleanupClient.close();
  });

  it("keeps one family bucket across rotations without blocking another family", async () => {
    const buyerA = await register(app, uniqueEmail());
    const buyerB = await register(app, uniqueEmail());
    expect(buyerA.status).toBe(201);
    expect(buyerB.status).toBe(201);

    const buyerAFirstRotation = await refresh(
      app,
      buyerA.body.data.refreshToken,
    );
    expect(buyerAFirstRotation.status).toBe(200);
    const buyerASecondRotation = await refresh(
      app,
      buyerAFirstRotation.body.data.refreshToken,
    );
    expect(buyerASecondRotation.status).toBe(200);

    const buyerBFirstRotation = await refresh(
      app,
      buyerB.body.data.refreshToken,
    );
    expect(buyerBFirstRotation.status).toBe(200);

    const exhaustedFamily = await refresh(
      app,
      buyerASecondRotation.body.data.refreshToken,
    );
    expect(exhaustedFamily.status).toBe(429);
    expect(exhaustedFamily.headers["retry-after"]).toBeDefined();

    const separateFamily = await refresh(
      app,
      buyerBFirstRotation.body.data.refreshToken,
    );
    expect(separateFamily.status).toBe(200);
  });
});
