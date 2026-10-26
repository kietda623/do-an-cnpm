import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { ShipmentStatus } from "../../../generated/prisma/client.js";
import type { SystemRole } from "../../../common/auth/access-context.js";
import { canFulfillExistingOrder } from "../../../common/auth/fulfillment-access.js";
import { isAdmin } from "../../../common/auth/permissions.js";
import { DatabaseService } from "../../../database/prisma.service.js";
import { deriveMarketplaceOrderStatus } from "../../order/services/order-aggregate.js";
import {
  canAdvanceShipment,
  canConfirmReturn,
  canRetryShipment,
} from "../../order/services/fulfillment-policy.js";
import { OrderTransaction } from "../../order/services/order-transaction.js";
import { SettlementService } from "../../payment/services/settlement.service.js";

type Action = "EVENT" | "RETRY" | "RETURN";
type Input = {
  expectedVersion: number;
  reason?: string;
  event?: ShipmentStatus;
  eventId?: string;
};
const conflict = (code: string, message: string) =>
  new ConflictException({ code, message });

@Injectable()
export class ShippingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orderTx: OrderTransaction,
    private readonly settlement: SettlementService,
  ) {}

  async get(userId: string, systemRole: SystemRole, shipmentId: string) {
    const shipment = await this.db.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        sellerOrder: { include: { order: true } },
        events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    });
    if (!shipment) throw new NotFoundException();
    if (
      !isAdmin(systemRole) &&
      shipment.sellerOrder.order.buyerUserId !== userId
    ) {
      await this.db.prisma.$transaction((tx) =>
        canFulfillExistingOrder(tx, userId, shipment.sellerOrder.shopId),
      );
    }
    return this.present(shipment);
  }

  event(
    userId: string,
    systemRole: SystemRole,
    shipmentId: string,
    key: string,
    input: Input,
  ) {
    return this.perform(userId, systemRole, shipmentId, key, "EVENT", input);
  }

  retry(
    userId: string,
    systemRole: SystemRole,
    shipmentId: string,
    key: string,
    input: Input,
  ) {
    return this.perform(userId, systemRole, shipmentId, key, "RETRY", input);
  }

  confirmReturn(userId: string, shipmentId: string, key: string, input: Input) {
    return this.perform(userId, "ADMIN", shipmentId, key, "RETURN", input);
  }

  private async perform(
    userId: string,
    systemRole: SystemRole,
    shipmentId: string,
    key: string,
    action: Action,
    input: Input,
  ) {
    const preview = await this.db.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { sellerOrder: { select: { orderId: true } } },
    });
    if (!preview) throw new NotFoundException();
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ shipmentId, action, input }))
      .digest("hex");
    const result = await this.orderTx.run(async (tx) => {
      const operation = `SHIPMENT_${action}`;
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
          "This key was used for another shipment request.",
        );
      if (idem.state === "COMPLETED") return { replay: true };
      await this.orderTx.lockOrderGraph(tx, preview.sellerOrder.orderId);
      await tx.$queryRaw`SELECT id FROM shipments WHERE id = ${shipmentId}::uuid FOR UPDATE`;
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id: shipmentId },
        include: { sellerOrder: { include: { items: true } } },
      });
      const part = shipment.sellerOrder;
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true, systemRole: true },
      });
      if (user?.status !== "ACTIVE") throw new NotFoundException();
      if (action === "RETURN") {
        if (!isAdmin(user.systemRole)) throw new NotFoundException();
      } else if (!isAdmin(user.systemRole)) {
        await canFulfillExistingOrder(tx, userId, part.shopId);
      }
      if (shipment.version !== input.expectedVersion)
        throw conflict(
          "VERSION_CONFLICT",
          "Shipment changed. Reload before continuing.",
        );
      const now = (
        await tx.$queryRaw<
          Array<{ now: Date }>
        >`SELECT clock_timestamp() AS now`
      )[0]!.now;
      let nextStatus = shipment.status;
      let attempt = shipment.deliveryAttempt;
      if (action === "EVENT") {
        if (!input.event || !canAdvanceShipment(shipment.status, input.event))
          throw conflict(
            "INVALID_SHIPMENT_TRANSITION",
            "Shipment event is out of sequence.",
          );
        if (input.event === "FAILED" && !input.reason?.trim())
          throw conflict("REASON_REQUIRED", "A failure reason is required.");
        nextStatus = input.event;
      } else if (action === "RETRY") {
        if (!canRetryShipment(shipment.status, shipment.returnedConfirmedAt))
          throw conflict(
            "SHIPMENT_NOT_RETRYABLE",
            "Only a failed shipment can be retried.",
          );
        nextStatus = "WAITING_PICKUP";
        attempt += 1;
      } else {
        if (
          !canConfirmReturn(
            shipment.status,
            part.status,
            shipment.returnedConfirmedAt,
          )
        )
          throw conflict(
            "RETURN_NOT_CONFIRMABLE",
            "Only a failed shipment may be returned.",
          );
        if (!input.reason?.trim())
          throw conflict("REASON_REQUIRED", "A return reason is required.");
        await this.orderTx.lockInventory(tx, [part.id]);
        await this.settlement.cancelAndRestore(
          tx,
          part.id,
          part.orderId,
          part.items,
          input.reason,
          "USER",
          userId,
          now,
          "SHIPMENT_RETURN_CONFIRMED",
          true,
        );
      }
      await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: nextStatus,
          deliveryAttempt: attempt,
          ...(nextStatus === "DELIVERED" ? { deliveredAt: now } : {}),
          ...(action === "RETURN" ? { returnedConfirmedAt: now } : {}),
          version: { increment: 1 },
        },
      });
      await tx.shipmentEvent.create({
        data: {
          shipmentId,
          actorUserId: userId,
          fromStatus: shipment.status,
          toStatus: nextStatus,
          deliveryAttempt: attempt,
          reason: input.reason,
          operationKey: `shipment:${action.toLowerCase()}:${key}`,
        },
      });
      if (
        action === "EVENT" &&
        (nextStatus === "PICKED_UP" || nextStatus === "DELIVERED")
      ) {
        await tx.sellerOrder.update({
          where: { id: part.id },
          data: {
            status: nextStatus === "PICKED_UP" ? "SHIPPING" : "DELIVERED",
            version: { increment: 1 },
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: part.orderId,
            sellerOrderId: part.id,
            actorUserId: userId,
            actorKind: "USER",
            action: `SHIPMENT_${nextStatus}`,
            fromStatus: part.status,
            toStatus: nextStatus === "PICKED_UP" ? "SHIPPING" : "DELIVERED",
            operationKey: `shipment-order:${key}`,
          },
        });
      }
      const parts = await tx.sellerOrder.findMany({
        where: { orderId: part.orderId },
        select: { status: true },
      });
      await tx.marketplaceOrder.update({
        where: { id: part.orderId },
        data: {
          status: deriveMarketplaceOrderStatus(
            parts.map(({ status }) => status),
          ) as never,
          version: { increment: 1 },
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          actorKind: "USER",
          action: `SHIPMENT_${action}`,
          targetType: "Shipment",
          targetId: shipmentId,
          shopId: part.shopId,
          reason: input.reason,
          outcome: "SUCCESS",
          requestId: randomUUID(),
          safeMetadata: {
            orderId: part.orderId,
            sellerOrderId: part.id,
            status: nextStatus,
          },
        },
      });
      await tx.idempotencyRecord.update({
        where: { id: idem.id },
        data: {
          state: "COMPLETED",
          responseStatus: 200,
          resourceType: "Shipment",
          resourceId: shipmentId,
          responseSummary: { shipmentId, status: nextStatus },
        },
      });
      return { replay: false };
    });
    return {
      ...(await this.get(userId, systemRole, shipmentId)),
      replay: result.replay,
    };
  }

  private present(shipment: {
    id: string;
    sellerOrderId: string;
    status: string;
    trackingCode: string;
    deliveryAttempt: number;
    version: number;
    createdAt: Date;
    updatedAt: Date;
    events: Array<{
      id: string;
      fromStatus: string | null;
      toStatus: string;
      deliveryAttempt: number;
      reason: string | null;
      createdAt: Date;
    }>;
  }) {
    return {
      id: shipment.id,
      sellerOrderId: shipment.sellerOrderId,
      status: shipment.status,
      trackingCode: shipment.trackingCode,
      attemptNumber: shipment.deliveryAttempt,
      version: shipment.version,
      history: shipment.events.map((event) => ({
        id: event.id,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        attemptNumber: event.deliveryAttempt,
        reason: event.reason,
        createdAt: event.createdAt,
      })),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }
}
