import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { AccountManagementService } from "../src/modules/admin/services/account-management.service.js";

const actorId = "00000000-0000-4000-8000-000000000001";
const targetId = "00000000-0000-4000-8000-000000000002";
const key = "11111111-1111-4111-8111-111111111111";
const dbNow = new Date("2020-01-02T03:04:05.000Z");
const reason = "Policy violation";
const expectedVersion = 0;
const requestHash = createHash("sha256")
  .update(JSON.stringify({ targetUserId: targetId, reason, expectedVersion }))
  .digest("hex");
const targetUser = {
  id: targetId,
  emailNormalized: "target@example.test",
  displayName: "Target User",
  phone: null,
  systemRole: "BUYER" as const,
  status: "ACTIVE" as const,
  authVersion: expectedVersion,
  createdAt: dbNow,
  updatedAt: dbNow,
  avatarAsset: null,
};

describe("AccountManagementService clock", () => {
  it("stamps lock and session revocation with the database clock", async () => {
    const userUpdateMany = jest.fn<
      (args: unknown) => Promise<{ count: number }>
    >(async () => ({ count: 1 }));
    const sessionUpdateMany = jest.fn<
      (args: unknown) => Promise<{ count: number }>
    >(async () => ({ count: 1 }));
    const tx = {
      $executeRaw: jest.fn(async () => 1),
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
        strings.join("?").includes("clock_timestamp")
          ? [{ now: dbNow }]
          : [{ id: "00000000-0000-4000-8000-000000000003" }],
      ),
      idempotencyRecord: {
        findUniqueOrThrow: jest.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000003",
          requestHash,
          state: "IN_PROGRESS",
          responseSummary: null,
        })),
        update: jest.fn(async () => ({})),
      },
      user: {
        findUnique: jest.fn(async () => targetUser),
        updateMany: userUpdateMany,
      },
      session: { updateMany: sessionUpdateMany },
      auditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: jest.fn(
        async (work: (client: typeof tx) => Promise<unknown>) => work(tx),
      ),
    };
    const service = new AccountManagementService(
      { prisma } as never,
      new ConfigService({}),
    );

    const result = await service.lock(actorId, targetId, key, {
      reason,
      expectedVersion,
    });

    expect(userUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "LOCKED",
          authVersion: { increment: 1 },
          updatedAt: dbNow,
        }),
      }),
    );
    expect(sessionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { revokedAt: dbNow } }),
    );
    expect(result.updatedAt).toBe(dbNow.toISOString());
  });
});
