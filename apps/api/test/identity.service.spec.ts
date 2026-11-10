import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { AuthService } from "../src/modules/identity/identity.service.js";
import { RateLimitExceededException } from "../src/modules/identity/rate-limiter.service.js";
import type { RateLimiterService } from "../src/modules/identity/rate-limiter.service.js";

const secret = "unit-test-signing-secret-that-is-long-enough";
const now = new Date("2026-10-23T00:00:00.000Z");
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  emailNormalized: "buyer@example.test",
  passwordHash: "",
  displayName: "Test Buyer",
  phone: null,
  systemRole: "BUYER" as const,
  status: "ACTIVE" as const,
  authVersion: 0,
  createdAt: now,
  updatedAt: now,
};

function createRateLimiter(overrides: Partial<RateLimiterService> = {}): RateLimiterService {
  return {
    assertRegisterAllowed: jest.fn(async () => {}),
    assertLoginAllowed: jest.fn(async () => {}),
    assertRefreshIpAllowed: jest.fn(async () => {}),
    assertRefreshFamilyAllowed: jest.fn(async () => {}),
    ...overrides,
  } as RateLimiterService;
}

describe("AuthService", () => {
  it("stores an Argon2id password hash and returns a short-lived access token", async () => {
    const createdUser = { ...user };
    const prisma = {
      user: {
        create: jest.fn(async ({ data }: { data: { passwordHash: string } }) =>
          Object.assign(createdUser, data),
        ),
      },
      session: {
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "00000000-0000-4000-8000-000000000002",
          ...data,
        })),
      },
    };
    const rateLimiter = createRateLimiter();
    const service = new AuthService(
      { prisma } as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
      rateLimiter,
    );
    const result = await service.register({
      email: " Buyer@Example.Test ",
      password: "Correct horse battery staple 9!",
      fullName: " Test Buyer ",
      clientPlatform: "ANDROID",
    }, "203.0.113.10");

    expect(rateLimiter.assertRegisterAllowed).toHaveBeenCalledWith(
      "203.0.113.10",
      " Buyer@Example.Test ",
    );
    expect(createdUser.emailNormalized).toBe("buyer@example.test");
    expect(createdUser.displayName).toBe("Test Buyer");
    expect(createdUser.passwordHash).not.toContain("Correct horse");
    expect(createdUser.passwordHash).toContain("$argon2id$");
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientPlatform: "ANDROID",
          refreshHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    );
    expect(result.expiresIn).toBe(600);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{64}$/);
  });

  it("checks the register limit before password hashing or database work", async () => {
    const denied = new RateLimitExceededException(19);
    const rateLimiter = createRateLimiter({
      assertRegisterAllowed: jest.fn(async () => {
        throw denied;
      }),
    });
    const create = jest.fn();
    const hash = jest.spyOn(argon2, "hash");
    const service = new AuthService(
      { prisma: { user: { create } } } as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
      rateLimiter,
    );

    await expect(
      service.register(
        {
          email: "buyer@example.test",
          password: "Correct horse battery staple 9!",
          fullName: "Test Buyer",
          clientPlatform: "ANDROID",
        },
        "203.0.113.11",
      ),
    ).rejects.toBe(denied);

    expect(hash).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("checks the login limit before database lookup", async () => {
    const denied = new RateLimitExceededException(23);
    const rateLimiter = createRateLimiter({
      assertLoginAllowed: jest.fn(async () => {
        throw denied;
      }),
    });
    const findUnique = jest.fn();
    const service = new AuthService(
      { prisma: { user: { findUnique } } } as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
      rateLimiter,
    );

    await expect(
      service.login(
        { email: "buyer@example.test", password: "password", clientPlatform: "ANDROID" },
        "203.0.113.12",
      ),
    ).rejects.toBe(denied);

    expect(findUnique).not.toHaveBeenCalled();
  });

  it("checks refresh IP before lookup and family before the locked rotation transaction", async () => {
    const events: string[] = [];
    const denied = new RateLimitExceededException(29);
    const rateLimiter = createRateLimiter({
      assertRefreshIpAllowed: jest.fn(async () => {
        events.push("ip");
      }),
      assertRefreshFamilyAllowed: jest.fn(async (familyId: string) => {
        events.push(`family:${familyId}`);
        throw denied;
      }),
    });
    const findUnique = jest.fn(async () => {
      events.push("lookup");
      return { familyId: "family-a" };
    });
    const transaction = jest.fn();
    const service = new AuthService(
      { prisma: { session: { findUnique }, $transaction: transaction } } as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
      rateLimiter,
    );

    await expect(service.refresh("opaque-refresh-token", "ANDROID", "203.0.113.13"))
      .rejects.toBe(denied);

    expect(events).toEqual(["ip", "lookup", "family:family-a"]);
    expect(rateLimiter.assertRefreshIpAllowed).toHaveBeenCalledWith("203.0.113.13");
    expect(rateLimiter.assertRefreshFamilyAllowed).toHaveBeenCalledWith("family-a");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("issues a CSRF token only accepted when cookie and header match", async () => {
    const service = new AuthService(
      {} as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
      createRateLimiter(),
    );
    const issued = await service.csrf();
    expect(service.verifyCsrf(issued.cookie, issued.csrfToken)).toBe(true);
    expect(service.verifyCsrf(issued.cookie, `${issued.csrfToken}x`)).toBe(false);
    expect(service.verifyCsrf(undefined, issued.csrfToken)).toBe(false);
  });
});
