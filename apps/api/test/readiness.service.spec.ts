import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { RateLimitStore } from "../src/modules/identity/rate-limit/rate-limit-store.js";
import { RateLimiterService } from "../src/modules/identity/rate-limiter.service.js";
import { HealthController } from "../src/health/health.controller.js";
import { ReadinessService } from "../src/health/readiness.service.js";

const requiredConfig = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://localhost/marketplace_test",
  JWT_SIGNING_SECRET: "test-signing-secret-at-least-32-characters",
  RATE_LIMIT_REDIS_URL: "redis://localhost:56380",
  RATE_LIMIT_KEY_SECRET: "test-rate-limit-key-secret-at-least-32-characters",
  RATE_LIMIT_KEY_PREFIX: "marketplace-test",
};

function createStore(
  ping: () => Promise<void> = async () => {},
): RateLimitStore {
  return {
    consume: async () => ({ allowed: true, retryAfterSeconds: 0 }),
    ping,
  };
}

function createReadiness(store: RateLimitStore) {
  const database = {
    isConfigured: true,
    checkConnection: jest.fn(async () => {}),
  };
  const service = new ReadinessService(
    new ConfigService(requiredConfig),
    database as never,
    store,
  );
  return { database, service };
}

describe("ReadinessService", () => {
  it("reports Redis up after a successful ping", async () => {
    const ping = jest.fn(async () => {});
    const store = createStore(ping);
    const { database, service } = createReadiness(store);

    await expect(service.check()).resolves.toEqual({
      configuration: "up",
      database: "up",
      rateLimiter: "up",
    });
    expect(database.checkConnection).toHaveBeenCalledTimes(1);
    expect(ping).toHaveBeenCalledTimes(1);
  });

  it("marks configuration down when Redis connection settings are missing", async () => {
    const service = new ReadinessService(
      new ConfigService({
        ...requiredConfig,
        RATE_LIMIT_REDIS_URL: "",
        RATE_LIMIT_KEY_PREFIX: "",
      }),
      { isConfigured: true, checkConnection: async () => {} } as never,
      createStore(),
    );

    await expect(service.check()).resolves.toEqual({
      configuration: "down",
      database: "up",
      rateLimiter: "up",
    });
  });

  it("marks /health/ready down when Redis ping fails", async () => {
    const { service } = createReadiness(
      createStore(async () => {
        throw new Error("Redis unavailable");
      }),
    );
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: ReadinessService, useValue: service }],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();

    try {
      const response = await request(app.getHttpServer()).get("/health/ready");
      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        checks: {
          configuration: "up",
          database: "up",
          rateLimiter: "down",
        },
      });
    } finally {
      await app.close();
    }
  });

  it.each([undefined, "short"])(
    "rejects missing or short production rate-limit keys (%s)",
    (secret) => {
      const configValues = {
        NODE_ENV: "production",
        RATE_LIMIT_KEY_SECRET: secret,
      };
      const config = {
        get: (key: keyof typeof configValues) => configValues[key],
      } as unknown as ConfigService;
      expect(() => new RateLimiterService(createStore(), config)).toThrow(
        "RATE_LIMIT_KEY_SECRET must contain at least 32 characters",
      );
    },
  );

  it("keeps local Compose Redis loopback-bound and separates app/test key namespaces", () => {
    const compose = parse(
      readFileSync(resolve(process.cwd(), "../../docker-compose.yml"), "utf8"),
    ) as {
      services: Record<
        string,
        {
          ports?: string[];
          environment?: Record<string, string>;
        }
      >;
    };
    const redis = compose.services.redis;
    const api = compose.services.api;
    const apiTest = compose.services["api-test"];

    expect(redis?.ports).toContain("127.0.0.1:56379:6379");
    expect(api?.environment?.RATE_LIMIT_REDIS_URL).toBe(
      "${RATE_LIMIT_REDIS_URL:-redis://redis:6379}",
    );
    expect(api?.environment?.RATE_LIMIT_KEY_PREFIX).toBe(
      "${RATE_LIMIT_KEY_PREFIX:-marketplace}",
    );
    expect(api?.environment?.RATE_LIMIT_KEY_SECRET).toContain(
      "RATE_LIMIT_KEY_SECRET",
    );
    expect(apiTest?.environment?.RATE_LIMIT_REDIS_URL).toBe(
      "redis://redis-test:6379",
    );
    expect(apiTest?.environment?.RATE_LIMIT_KEY_PREFIX).toBe(
      "marketplace-test",
    );
    expect(apiTest?.environment?.RATE_LIMIT_KEY_SECRET).toContain(
      "RATE_LIMIT_KEY_SECRET",
    );
  });
});
