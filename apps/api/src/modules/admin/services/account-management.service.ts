import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { canAccessAdmin } from "../../../common/auth/permissions.js";
import { DatabaseService } from "../../../database/prisma.service.js";

type UserStatus = "ACTIVE" | "LOCKED";
type UserRecord = {
  id: string;
  emailNormalized: string;
  displayName: string;
  phone: string | null;
  systemRole: "BUYER" | "ADMIN";
  status: UserStatus;
  authVersion: number;
  createdAt: Date;
  updatedAt: Date;
  avatarAsset: {
    id: string;
    objectKey: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  } | null;
};
type UserDto = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatar: {
    id: string;
    url: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  } | null;
  roles: string[];
  status: UserStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

const userSelect = {
  id: true,
  emailNormalized: true,
  displayName: true,
  phone: true,
  systemRole: true,
  status: true,
  authVersion: true,
  createdAt: true,
  updatedAt: true,
  avatarAsset: {
    select: {
      id: true,
      objectKey: true,
      mimeType: true,
      byteSize: true,
      width: true,
      height: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class AccountManagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async list(query: {
    q?: string;
    status?: UserStatus;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(q
        ? {
            OR: [
              { emailNormalized: { contains: q, mode: "insensitive" } },
              { displayName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    };
    const { rows, total } = await this.db.prisma.$transaction(
      async (tx) => {
        const [rows, total] = await Promise.all([
          tx.user.findMany({
            where,
            select: userSelect,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.user.count({ where }),
        ]);
        return { rows, total };
      },
      { isolationLevel: "RepeatableRead" },
    );
    return {
      data: rows.map((user) => this.project(user)),
      meta: { page, pageSize, total },
    };
  }

  lock(
    actorUserId: string,
    targetUserId: string,
    key: string,
    input: { reason: string; expectedVersion: number },
    requestId?: string,
  ) {
    return this.changeStatus(
      actorUserId,
      targetUserId,
      key,
      input,
      "LOCK",
      requestId,
    );
  }

  unlock(
    actorUserId: string,
    targetUserId: string,
    key: string,
    input: { reason: string; expectedVersion: number },
    requestId?: string,
  ) {
    return this.changeStatus(
      actorUserId,
      targetUserId,
      key,
      input,
      "UNLOCK",
      requestId,
    );
  }

  private async changeStatus(
    actorUserId: string,
    targetUserId: string,
    key: string,
    input: { reason: string; expectedVersion: number },
    action: "LOCK" | "UNLOCK",
    requestId?: string,
  ): Promise<UserDto> {
    if (action === "LOCK" && actorUserId === targetUserId) {
      throw new ForbiddenException({
        code: "ADMIN_SELF_LOCK_FORBIDDEN",
        message: "Administrators cannot lock their own account.",
      });
    }
    if (!input.reason.trim())
      throw new BadRequestException({
        code: "REASON_REQUIRED",
        message: "A reason is required.",
      });

    const operation = "POST:/admin/users/{id}/" + action.toLowerCase();
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          targetUserId,
          reason: input.reason.trim(),
          expectedVersion: input.expectedVersion,
        }),
      )
      .digest("hex");
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO idempotency_records
          (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
        VALUES (${actorUserId}::uuid, ${actorUserId}, ${operation}, ${key}, ${requestHash}, 'IN_PROGRESS')
        ON CONFLICT (actor_scope, operation, idempotency_key) DO NOTHING`;
      const idem = await tx.idempotencyRecord.findUniqueOrThrow({
        where: {
          actorScope_operation_idempotencyKey: {
            actorScope: actorUserId,
            operation,
            idempotencyKey: key,
          },
        },
      });
      await tx.$queryRaw`SELECT id FROM idempotency_records WHERE id = ${idem.id}::uuid FOR UPDATE`;
      const lockedIdem = await tx.idempotencyRecord.findUniqueOrThrow({
        where: { id: idem.id },
      });
      if (lockedIdem.requestHash !== requestHash) {
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "This key was already used for a different request.",
        });
      }
      if (lockedIdem.state === "COMPLETED" && lockedIdem.responseSummary) {
        return lockedIdem.responseSummary as unknown as UserDto;
      }

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${targetUserId}::uuid FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: targetUserId },
        select: userSelect,
      });
      if (!current) throw new NotFoundException();
      if (current.authVersion !== input.expectedVersion) {
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "The account changed. Reload before continuing.",
        });
      }
      const fromStatus: UserStatus = action === "LOCK" ? "ACTIVE" : "LOCKED";
      const toStatus: UserStatus = action === "LOCK" ? "LOCKED" : "ACTIVE";
      if (current.status !== fromStatus) {
        throw new ConflictException({
          code: "ACCOUNT_STATE_CONFLICT",
          message: `Only a ${fromStatus.toLowerCase()} account can be ${action.toLowerCase()}ed.`,
        });
      }

      const now = new Date();
      const nextVersion = current.authVersion + 1;
      const updated = await tx.user.updateMany({
        where: {
          id: targetUserId,
          status: fromStatus,
          authVersion: input.expectedVersion,
        },
        data: {
          status: toStatus,
          authVersion: { increment: 1 },
          updatedAt: now,
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "The account changed. Reload before continuing.",
        });
      }
      if (action === "LOCK") {
        await tx.session.updateMany({
          where: { userId: targetUserId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      const user = this.project({
        ...current,
        status: toStatus,
        authVersion: nextVersion,
        updatedAt: now,
      });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          actorKind: "USER",
          action: action === "LOCK" ? "user.locked" : "user.unlocked",
          targetType: "User",
          targetId: targetUserId,
          reason: input.reason.trim(),
          outcome: "SUCCESS",
          requestId: requestId ?? randomUUID(),
          safeMetadata: { fromStatus, toStatus, version: nextVersion },
        },
      });
      await tx.idempotencyRecord.update({
        where: { id: idem.id },
        data: {
          state: "COMPLETED",
          responseStatus: 200,
          resourceType: "User",
          resourceId: targetUserId,
          responseSummary: user as unknown as Prisma.InputJsonValue,
        },
      });
      return user;
    });
  }

  private project(user: UserRecord): UserDto {
    const base = this.config
      .get<string>("ASSET_PUBLIC_READ_BASE")
      ?.replace(/\/$/, "");
    return {
      id: user.id,
      email: user.emailNormalized,
      fullName: user.displayName,
      phone: user.phone,
      avatar:
        user.avatarAsset && base
          ? {
              id: user.avatarAsset.id,
              url: `${base}/${user.avatarAsset.objectKey}`,
              mimeType: user.avatarAsset.mimeType,
              byteSize: user.avatarAsset.byteSize,
              width: user.avatarAsset.width,
              height: user.avatarAsset.height,
            }
          : null,
      roles: canAccessAdmin(user.systemRole) ? ["ADMIN"] : ["BUYER"],
      status: user.status,
      version: user.authVersion,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
