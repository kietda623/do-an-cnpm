import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../../database/prisma.service.js";
@Injectable()
export class InventoryService {
  constructor(private readonly db: DatabaseService) {}
  async get(userId: string, shopId: string, variantId: string) {
    const member = await this.db.prisma.shopMember.findFirst({
      where: { shopId, userId, status: "ACTIVE", shop: { status: "ACTIVE" } },
    });
    if (!member) throw new NotFoundException();
    const row = await this.db.prisma.inventory.findFirst({ where: { shopId, variantId } });
    if (!row) throw new NotFoundException();
    return {
      variantId: row.variantId,
      shopId: row.shopId,
      availableQuantity: row.availableQuantity,
      version: row.version,
    };
  }
  async adjust(
    userId: string,
    shopId: string,
    variantId: string,
    input: { delta: number; reason: string; expectedVersion: number },
  ) {
    if (!Number.isInteger(input.delta) || input.delta === 0)
      throw new UnprocessableEntityException({
        code: "INVALID_DELTA",
        message: "Stock adjustment must be a non-zero integer.",
      });
    const member = await this.db.prisma.shopMember.findFirst({
      where: { shopId, userId, status: "ACTIVE", shop: { status: "ACTIVE" } },
    });
    if (!member) throw new NotFoundException();
    return this.db.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ available_quantity: number; version: number }>
      >`SELECT available_quantity,version FROM inventory WHERE shop_id=${shopId}::uuid AND variant_id=${variantId}::uuid FOR UPDATE`;
      const row = rows[0];
      if (!row) throw new NotFoundException();
      if (row.version !== input.expectedVersion)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Inventory changed. Reload before adjusting.",
        });
      const next = row.available_quantity + input.delta;
      if (next < 0)
        throw new ConflictException({
          code: "INSUFFICIENT_STOCK",
          message: "Adjustment would make stock negative.",
        });
      const updated = await tx.inventory.updateMany({
        where: { shopId, variantId, version: input.expectedVersion },
        data: { availableQuantity: next, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Inventory changed. Reload before adjusting.",
        });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: variantId,
          shopId,
          actorUserId: userId,
          kind: "ADJUST",
          quantityDelta: input.delta,
          quantityAfter: next,
          reason: input.reason.trim(),
          operationKey: `adjust:${randomUUID()}`,
        },
      });
      return { variantId, shopId, availableQuantity: next, version: input.expectedVersion + 1 };
    });
  }
}
