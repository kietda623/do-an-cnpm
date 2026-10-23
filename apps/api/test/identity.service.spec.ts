import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../src/modules/identity/identity.service.js";

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
    const service = new AuthService(
      { prisma } as never,
      new ConfigService({ JWT_SIGNING_SECRET: secret }),
    );
    const result = await service.register({
      email: " Buyer@Example.Test ",
      password: "Correct horse battery staple 9!",
      fullName: " Test Buyer ",
      clientPlatform: "ANDROID",
    });

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

  it("issues a CSRF token only accepted when cookie and header match", async () => {
    const service = new AuthService({} as never, new ConfigService({ JWT_SIGNING_SECRET: secret }));
    const issued = await service.csrf();
    expect(service.verifyCsrf(issued.cookie, issued.csrfToken)).toBe(true);
    expect(service.verifyCsrf(issued.cookie, `${issued.csrfToken}x`)).toBe(false);
    expect(service.verifyCsrf(undefined, issued.csrfToken)).toBe(false);
  });
});
