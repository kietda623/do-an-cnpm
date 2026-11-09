import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import type { INestApplication } from "@nestjs/common";
import { ServiceUnavailableException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { configureHttp } from "../../src/common/http/configure-http.js";
import { CsrfRequestMiddleware } from "../../src/common/http/csrf-request.middleware.js";
import { RequestIdMiddleware } from "../../src/common/http/request-id.middleware.js";
import { RequestLoggerMiddleware } from "../../src/common/logging/request-logger.middleware.js";
import { StructuredLogger } from "../../src/common/logging/logger.js";
import { AuthController } from "../../src/modules/identity/identity.controller.js";
import { AuthService } from "../../src/modules/identity/identity.service.js";
import { RateLimitExceededException } from "../../src/modules/identity/rate-limiter.service.js";

describe("auth rate-limit HTTP behavior", () => {
  let app: INestApplication;
  let forwardedIp: string | undefined;
  const auth = {
    register: jest.fn(async (_input: unknown, ip: string) => {
      forwardedIp = ip;
      throw new RateLimitExceededException(37);
    }),
    login: jest.fn(),
    refresh: jest.fn(),
    csrf: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        {
          provide: ConfigService,
          useValue: new ConfigService({ API_TRUST_PROXY_HOPS: "0" }),
        },
        RequestIdMiddleware,
        RequestLoggerMiddleware,
        StructuredLogger,
        CsrfRequestMiddleware,
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureHttp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("returns the retry delay and ignores untrusted forwarding headers", async () => {
    const spoofedIp = "198.51.100.42";
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .set("X-Forwarded-For", spoofedIp)
      .send({
        email: "buyer@example.test",
        password: "Correct horse battery staple 9!",
        fullName: "Test Buyer",
        clientPlatform: "ANDROID",
      });

    expect(response.status).toBe(429);
    expect(response.headers["retry-after"]).toBe("37");
    expect(response.body.error).toMatchObject({ code: "RATE_LIMITED" });
    expect(forwardedIp).toBeTruthy();
    expect(forwardedIp).not.toBe(spoofedIp);
    expect(response.headers["access-control-expose-headers"]).toContain(
      "Retry-After",
    );
  });

  it("keeps Redis failures as a standard 503 error envelope", async () => {
    auth.register.mockImplementationOnce(async () => {
      throw new ServiceUnavailableException({
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Authentication rate limiting is temporarily unavailable.",
      });
    });

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: "buyer@example.test",
        password: "Correct horse battery staple 9!",
        fullName: "Test Buyer",
        clientPlatform: "ANDROID",
      });

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: { code: "INTERNAL_ERROR", requestId: expect.any(String) },
    });
  });
});
