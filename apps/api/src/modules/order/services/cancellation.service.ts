import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { DatabaseService } from "../../../database/prisma.service.js";
import {
  buyerCancellationBlockers,
  canCancelSellerOrder,
} from "../../payment/services/payment-policy.js";
import { SettlementService } from "../../payment/services/settlement.service.js";
import { OrderTransaction } from "./order-transaction.js";

type CancelInput = { reason: string; expectedVersion: number };
const conflict = (code: string, message: string, details?: unknown) =>
  new ConflictException({ code, message, ...(details ? { details } : {}) });

@Injectable()
export class CancellationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orderTx: OrderTransaction,
    private readonly settlement: SettlementService,
  ) {}

  async cancelAll(userId: string, orderId: string, key: string, input: CancelInput) {
    return this.perform(
      userId,
      "BUYER_CANCEL_ALL",
      key,
      orderId,
      JSON.stringify(input),
      async (tx) => {
        const row = await tx.marketplaceOrder.findFirst({
          where: { id: orderId, buyerUserId: userId },
          include: {
            sellerOrders: { include: { items: true } },
            payment: { include: { attempts: true } },
          },
        });
        if (!row) throw new NotFoundException();
        if (row.version !== input.expectedVersion)
          throw conflict("VERSION_CONFLICT", "Order changed. Reload before cancelling.");
        const live = row.sellerOrders.filter((part) => part.status !== "CANCELLED");
        const blockers = buyerCancellationBlockers(live);
        if (blockers.length)
          throw conflict(
            "ORDER_NOT_CANCELLABLE",
            "Some seller orders have entered fulfillment.",
            blockers.map((id) => ({
              field: "blockingSellerOrderIds",
              code: "ORDER_IN_PROGRESS",
              message: id,
            })),
          );
        if (!live.length)
          throw conflict("ORDER_ALREADY_CANCELLED", "The order is already cancelled.");
        await this.orderTx.lockInventory(
          tx,
          live.map(({ id }) => id),
        );
        await this.invalidatePendingAttempts(tx, row.payment?.attempts ?? []);
        const now = await this.dbNow(tx);
        for (const part of live)
          await this.settlement.cancelAndRestore(
            tx,
            part.id,
            orderId,
            part.items,
            input.reason,
            "USER",
            userId,
            now,
            "BUYER_CANCELLED",
          );
        await tx.marketplaceOrder.update({
          where: { id: orderId },
          data: { status: "CANCELLED", version: { increment: 1 } },
        });
        if (row.payment)
          await tx.payment.update({
            where: { id: row.payment.id },
            data: { version: { increment: 1 } },
          });
        await this.audit(tx, userId, "ORDER_CANCELLED", "MarketplaceOrder", orderId, input.reason, {
          sellerOrderIds: live.map(({ id }) => id),
        });
        return { orderId, status: "CANCELLED", cancelledSellerOrderIds: live.map(({ id }) => id) };
      },
    );
  }

  async cancelPart(
    userId: string,
    orderId: string,
    sellerOrderId: string,
    key: string,
    input: CancelInput,
  ) {
    return this.perform(
      userId,
      "BUYER_CANCEL_PART",
      key,
      orderId,
      `${sellerOrderId}:${JSON.stringify(input)}`,
      async (tx) => {
        const row = await tx.marketplaceOrder.findFirst({
          where: { id: orderId, buyerUserId: userId },
          include: {
            sellerOrders: { include: { items: true } },
            payment: { include: { attempts: true } },
          },
        });
        if (!row) throw new NotFoundException();
        const part = row.sellerOrders.find(({ id }) => id === sellerOrderId);
        if (!part) throw new NotFoundException();
        if (part.version !== input.expectedVersion)
          throw conflict("VERSION_CONFLICT", "Seller order changed. Reload before cancelling.");
        if (!canCancelSellerOrder(part.status, "BUYER"))
          throw conflict("ORDER_NOT_CANCELLABLE", "Only a pending seller order can be cancelled.");
        await this.orderTx.lockInventory(tx, [part.id]);
        await this.invalidatePendingAttempts(tx, row.payment?.attempts ?? []);
        const now = await this.dbNow(tx);
        await this.settlement.cancelAndRestore(
          tx,
          part.id,
          orderId,
          part.items,
          input.reason,
          "USER",
          userId,
          now,
          "BUYER_CANCELLED",
        );
        const allCancelled = row.sellerOrders.every(
          (item) => item.id === part.id || item.status === "CANCELLED",
        );
        await tx.marketplaceOrder.update({
          where: { id: orderId },
          data: {
            ...(allCancelled ? { status: "CANCELLED" as const } : {}),
            version: { increment: 1 },
          },
        });
        if (row.payment)
          await tx.payment.update({
            where: { id: row.payment.id },
            data: { version: { increment: 1 } },
          });
        await this.audit(
          tx,
          userId,
          "SELLER_ORDER_CANCELLED_BY_BUYER",
          "SellerOrder",
          part.id,
          input.reason,
          { orderId },
        );
        return { orderId, sellerOrderId: part.id, status: "CANCELLED" };
      },
    );
  }

  async rejectSeller(
    userId: string,
    shopId: string,
    sellerOrderId: string,
    key: string,
    input: CancelInput,
  ) {
    const preview = await this.db.prisma.sellerOrder.findFirst({
      where: { id: sellerOrderId, shopId },
      select: { orderId: true },
    });
    if (!preview) throw new NotFoundException();
    return this.perform(
      userId,
      "SELLER_REJECT_ORDER",
      key,
      preview.orderId,
      `${shopId}:${sellerOrderId}:${JSON.stringify(input)}`,
      (tx) => this.rejectPart(tx, userId, sellerOrderId, input, shopId),
    );
  }

  async rejectAdmin(userId: string, sellerOrderId: string, key: string, input: CancelInput) {
    const preview = await this.db.prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { orderId: true },
    });
    if (!preview) throw new NotFoundException();
    return this.perform(
      userId,
      "ADMIN_REJECT_ORDER",
      key,
      preview.orderId,
      `${sellerOrderId}:${JSON.stringify(input)}`,
      (tx) => this.rejectPart(tx, userId, sellerOrderId, input),
    );
  }

  private async rejectPart(
    tx: Prisma.TransactionClient,
    userId: string,
    sellerOrderId: string,
    input: CancelInput,
    shopId?: string,
  ) {
    if (shopId) {
      const member = await tx.shopMember.findFirst({
        where: { shopId, userId, status: "ACTIVE", shop: { status: "ACTIVE" } },
        select: { id: true },
      });
      if (!member) throw new NotFoundException();
    }
    const partPreview = await tx.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { orderId: true, shopId: true },
    });
    if (!partPreview || (shopId && partPreview.shopId !== shopId)) throw new NotFoundException();
    const row = await tx.marketplaceOrder.findUniqueOrThrow({
      where: { id: partPreview.orderId },
      include: {
        sellerOrders: { include: { items: true } },
        payment: { include: { attempts: true } },
      },
    });
    const part = row.sellerOrders.find(({ id }) => id === sellerOrderId);
    if (!part) throw new NotFoundException();
    if (part.version !== input.expectedVersion)
      throw conflict("VERSION_CONFLICT", "Seller order changed. Reload before rejecting.");
    if (!canCancelSellerOrder(part.status, "SELLER"))
      throw conflict(
        "ORDER_NOT_REJECTABLE",
        "Only pending or confirmed seller orders can be rejected.",
      );
    await this.orderTx.lockInventory(tx, [part.id]);
    await this.invalidatePendingAttempts(tx, row.payment?.attempts ?? []);
    const now = await this.dbNow(tx);
    await this.settlement.cancelAndRestore(
      tx,
      part.id,
      row.id,
      part.items,
      input.reason,
      "USER",
      userId,
      now,
      "SELLER_REJECTED",
    );
    const allCancelled = row.sellerOrders.every(
      (item) => item.id === part.id || item.status === "CANCELLED",
    );
    await tx.marketplaceOrder.update({
      where: { id: row.id },
      data: {
        ...(allCancelled ? { status: "CANCELLED" as const } : {}),
        version: { increment: 1 },
      },
    });
    if (row.payment)
      await tx.payment.update({
        where: { id: row.payment.id },
        data: { version: { increment: 1 } },
      });
    await this.audit(
      tx,
      userId,
      shopId ? "SELLER_ORDER_REJECTED" : "ADMIN_SELLER_ORDER_REJECTED",
      "SellerOrder",
      part.id,
      input.reason,
      { orderId: row.id, shopId: shopId ?? null },
    );
    return { orderId: row.id, sellerOrderId: part.id, status: "CANCELLED" };
  }

  private async perform<T>(
    userId: string,
    operation: string,
    key: string,
    orderId: string,
    requestData: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<{ summary: T; replay: boolean }> {
    const requestHash = `${orderId}:${requestData}`;
    const idemResult = await this.orderTx.run(async (tx) => {
      await tx.$executeRaw`INSERT INTO idempotency_records (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
        VALUES (${userId}::uuid, ${userId}, ${operation}, ${key}, ${requestHash}, 'IN_PROGRESS')
        ON CONFLICT (actor_scope, operation, idempotency_key) DO NOTHING`;
      const idem = await tx.idempotencyRecord.findUniqueOrThrow({
        where: {
          actorScope_operation_idempotencyKey: {
            actorScope: userId,
            operation,
            idempotencyKey: key,
          },
        },
      });
      await tx.$queryRaw`SELECT id FROM idempotency_records WHERE id = ${idem.id}::uuid FOR UPDATE`;
      const locked = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id: idem.id } });
      if (locked.requestHash !== requestHash)
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This key was used for a different cancellation request.",
        );
      if (locked.state === "COMPLETED")
        return { replay: true, summary: locked.responseSummary as T };
      await this.orderTx.lockOrderGraph(tx, orderId);
      const result = await work(tx);
      await tx.idempotencyRecord.update({
        where: { id: idem.id },
        data: {
          state: "COMPLETED",
          responseStatus: 200,
          resourceType: "MarketplaceOrder",
          resourceId: orderId,
          responseSummary: result as Prisma.InputJsonValue,
        },
      });
      return { replay: false, summary: result };
    });
    return idemResult;
  }

  private async invalidatePendingAttempts(
    tx: Prisma.TransactionClient,
    attempts: Array<{ id: string; provider: string; status: string }>,
  ) {
    const pending = attempts.filter(
      (attempt) => attempt.provider === "MOCK" && attempt.status === "PENDING",
    );
    if (pending.length)
      await tx.paymentAttempt.updateMany({
        where: { id: { in: pending.map(({ id }) => id) } },
        data: { status: "CANCELLED", settledAt: await this.dbNow(tx) },
      });
  }

  private async dbNow(tx: Prisma.TransactionClient) {
    return (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!.now;
  }

  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
    safeMetadata: Prisma.InputJsonObject,
  ) {
    return tx.auditEvent.create({
      data: {
        actorUserId: userId,
        actorKind: "USER",
        action,
        targetType,
        targetId,
        reason,
        outcome: "SUCCESS",
        requestId: randomUUID(),
        safeMetadata,
      },
    });
  }
}
