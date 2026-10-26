import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { canFulfillExistingOrder } from "../../../common/auth/fulfillment-access.js";
import { isAdmin } from "../../../common/auth/permissions.js";
import { DatabaseService } from "../../../database/prisma.service.js";
import { canConfirmOrder, canReceiveOrder } from "./fulfillment-policy.js";
import { deriveMarketplaceOrderStatus } from "./order-aggregate.js";
import { OrderTransaction } from "./order-transaction.js";

type Action = "CONFIRM" | "PACK" | "RECEIVE";
const conflict = (code: string, message: string) =>
  new ConflictException({ code, message });

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orderTx: OrderTransaction,
  ) {}

  confirm(
    userId: string,
    shopId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
  ) {
    return this.perform(
      userId,
      sellerOrderId,
      key,
      expectedVersion,
      "CONFIRM",
      shopId,
    );
  }

  pack(
    userId: string,
    shopId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
  ) {
    return this.perform(
      userId,
      sellerOrderId,
      key,
      expectedVersion,
      "PACK",
      shopId,
    );
  }

  confirmAdmin(
    userId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
    reason: string,
  ) {
    return this.perform(
      userId,
      sellerOrderId,
      key,
      expectedVersion,
      "CONFIRM",
      undefined,
      undefined,
      { reason },
    );
  }

  packAdmin(
    userId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
    reason: string,
  ) {
    return this.perform(
      userId,
      sellerOrderId,
      key,
      expectedVersion,
      "PACK",
      undefined,
      undefined,
      { reason },
    );
  }

  receive(
    userId: string,
    orderId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
  ) {
    return this.perform(
      userId,
      sellerOrderId,
      key,
      expectedVersion,
      "RECEIVE",
      undefined,
      orderId,
    );
  }

  private async perform(
    userId: string,
    sellerOrderId: string,
    key: string,
    expectedVersion: number,
    action: Action,
    shopId?: string,
    buyerOrderId?: string,
    adminRecovery?: { reason: string },
  ) {
    const preview = await this.db.prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { orderId: true, shopId: true },
    });
    if (
      !preview ||
      (shopId && preview.shopId !== shopId) ||
      (buyerOrderId && preview.orderId !== buyerOrderId)
    )
      throw new NotFoundException();
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          sellerOrderId,
          shopId,
          buyerOrderId,
          expectedVersion,
          action,
          ...(adminRecovery ? { adminReason: adminRecovery.reason } : {}),
        }),
      )
      .digest("hex");
    return this.orderTx.run(async (tx) => {
      const operation = `${adminRecovery ? "ADMIN_" : ""}FULFILLMENT_${action}`;
      await tx.$executeRaw`INSERT INTO idempotency_records
        (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
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
      if (idem.requestHash !== requestHash)
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This key was used for a different request.",
        );
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, systemRole: true },
      });
      if (actor?.status !== "ACTIVE") throw new NotFoundException();
      if (adminRecovery) {
        if (!isAdmin(actor.systemRole)) throw new NotFoundException();
      } else if (shopId) {
        await canFulfillExistingOrder(tx, userId, shopId);
      }
      if (idem.state === "COMPLETED")
        return {
          replay: true,
          sellerOrderId,
          orderId: preview.orderId,
          shopId: preview.shopId,
        };
      await this.orderTx.lockOrderGraph(tx, preview.orderId);
      const part = await tx.sellerOrder.findUniqueOrThrow({
        where: { id: sellerOrderId },
        include: { shipment: true },
      });
      const order = await tx.marketplaceOrder.findUniqueOrThrow({
        where: { id: preview.orderId },
        include: { payment: true },
      });
      if (adminRecovery) {
        const currentActor = await tx.user.findUnique({
          where: { id: userId },
          select: { status: true, systemRole: true },
        });
        if (
          currentActor?.status !== "ACTIVE" ||
          !isAdmin(currentActor.systemRole)
        )
          throw new NotFoundException();
        const shop = await tx.shop.findUnique({
          where: { id: part.shopId },
          select: { owner: { select: { status: true } } },
        });
        if (shop?.owner.status !== "LOCKED")
          throw conflict(
            "ADMIN_RECOVERY_NOT_REQUIRED",
            "Admin fulfillment recovery is only available for a locked Seller.",
          );
      } else if (shopId) {
        await canFulfillExistingOrder(tx, userId, shopId);
      }
      if (buyerOrderId && order.buyerUserId !== userId)
        throw new NotFoundException();
      if (part.version !== expectedVersion)
        throw conflict(
          "VERSION_CONFLICT",
          "Seller order changed. Reload before continuing.",
        );
      const now = (
        await tx.$queryRaw<
          Array<{ now: Date }>
        >`SELECT clock_timestamp() AS now`
      )[0]!.now;
      const allocations = await tx.paymentAllocation.findMany({
        where: { sellerOrderId },
        include: { attempt: true, refund: true },
      });
      const netPaid = allocations
        .filter((allocation) => allocation.attempt.status === "SUCCEEDED")
        .reduce(
          (sum, allocation) =>
            sum +
            BigInt(allocation.amount.toString()) -
            BigInt(allocation.refund?.amount.toString() ?? "0"),
          0n,
        );
      let toStatus: "CONFIRMED" | "PACKING" | "COMPLETED";
      if (action === "CONFIRM") {
        if (
          !canConfirmOrder(
            part.status,
            order.paymentMethod,
            netPaid >= BigInt(part.originalTotal.toString()),
            order.paymentDeadline,
            now,
          )
        )
          throw conflict(
            "ORDER_NOT_CONFIRMABLE",
            "This seller order cannot be confirmed.",
          );
        toStatus = "CONFIRMED";
      } else if (action === "PACK") {
        if (part.status !== "CONFIRMED" || part.shipment)
          throw conflict(
            "ORDER_NOT_PACKABLE",
            "This seller order cannot be packed.",
          );
        toStatus = "PACKING";
        await tx.shipment.create({
          data: {
            sellerOrderId,
            trackingCode: `SHIP-${randomUUID()}`,
            status: "WAITING_PICKUP",
            events: {
              create: {
                actorUserId: userId,
                toStatus: "WAITING_PICKUP",
                deliveryAttempt: 1,
                operationKey: `shipment:create:${key}`,
              },
            },
          },
        });
      } else {
        const outstanding = BigInt(part.originalTotal.toString()) - netPaid;
        if (
          !canReceiveOrder(
            part.status,
            part.shipment?.status ?? null,
            outstanding.toString(),
          )
        )
          throw conflict(
            "ORDER_NOT_RECEIVABLE",
            "Delivery and payment are required before receipt.",
          );
        toStatus = "COMPLETED";
      }
      await tx.sellerOrder.update({
        where: { id: sellerOrderId },
        data: {
          status: toStatus,
          ...(toStatus === "COMPLETED" ? { completedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      const parts = await tx.sellerOrder.findMany({
        where: { orderId: order.id },
        select: { status: true },
      });
      await tx.marketplaceOrder.update({
        where: { id: order.id },
        data: {
          status: deriveMarketplaceOrderStatus(
            parts.map((item) => item.status),
          ) as never,
          version: { increment: 1 },
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          sellerOrderId,
          actorUserId: userId,
          actorKind: "USER",
          action: adminRecovery
            ? `ADMIN_SELLER_ORDER_${action}`
            : `SELLER_ORDER_${action}`,
          fromStatus: part.status,
          toStatus,
          operationKey: `fulfillment:${action.toLowerCase()}:${key}`,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          actorKind: "USER",
          action: `${adminRecovery ? "ADMIN_SELLER_ORDER_" : "SELLER_ORDER_"}${action}`,
          targetType: "SellerOrder",
          targetId: sellerOrderId,
          reason: adminRecovery?.reason,
          outcome: "SUCCESS",
          requestId: randomUUID(),
          safeMetadata: {
            orderId: order.id,
            shopId: part.shopId,
            ...(adminRecovery ? { lockedSellerRecovery: true } : {}),
          },
        },
      });
      await tx.idempotencyRecord.update({
        where: { id: idem.id },
        data: {
          state: "COMPLETED",
          responseStatus: 200,
          resourceType: "SellerOrder",
          resourceId: sellerOrderId,
          responseSummary: {
            sellerOrderId,
            orderId: order.id,
            status: toStatus,
          },
        },
      });
      return {
        replay: false,
        sellerOrderId,
        orderId: order.id,
        shopId: part.shopId,
      };
    });
  }
}
