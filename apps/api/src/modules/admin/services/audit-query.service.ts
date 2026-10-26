import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { DatabaseService } from "../../../database/prisma.service.js";

const sensitiveKey =
  /(password|secret|token|hash|credential|authorization|cookie)/i;
function sanitize(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitiveKey.test(key))
        .map(([key, item]) => [key, sanitize(item as Prisma.JsonValue)]),
    );
  }
  return value;
}

@Injectable()
export class AuditQueryService {
  constructor(private readonly db: DatabaseService) {}

  async list(query: {
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.AuditEventWhereInput = {
      ...(query.resourceType ? { targetType: query.resourceType } : {}),
      ...(query.resourceId ? { targetId: query.resourceId } : {}),
      ...(query.actorId ? { actorUserId: query.actorId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const { rows, total } = await this.db.prisma.$transaction(
      async (tx) => {
        const [rows, total] = await Promise.all([
          tx.auditEvent.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          tx.auditEvent.count({ where }),
        ]);
        return { rows, total };
      },
      { isolationLevel: "RepeatableRead" },
    );
    return {
      data: rows.map((row) => ({
        id: row.id,
        actorId: row.actorUserId,
        action: row.action,
        resourceType: row.targetType,
        resourceId: row.targetId,
        reason: row.reason,
        createdAt: row.createdAt,
        requestId: row.requestId,
        metadata: sanitize(row.safeMetadata),
      })),
      meta: { page, pageSize, total },
    };
  }
}
