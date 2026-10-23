import { Injectable } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";

type SnapshotPart = { sellerOrderId: string; amount: string };
type OrderItem = { id: string; variantId: string; shopId: string; quantity: number };

@Injectable()
export class SettlementService {
  async cancelAndRestore(
    tx: Prisma.TransactionClient,
    sellerOrderId: string,
    orderId: string,
    items: OrderItem[],
    reason: string,
    actorKind: "USER" | "SYSTEM",
    actorUserId: string | null,
    now: Date,
    action: string,
  ) {
    const part = await tx.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderId } });
    if (part.status === "CANCELLED") return part;
    await tx.sellerOrder.update({
      where: { id: sellerOrderId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellationReason: reason,
        stockReturnedAt: now,
        version: { increment: 1 },
      },
    });
    for (const item of items) {
      const inventory = await tx.inventory.findUniqueOrThrow({
        where: { variantId: item.variantId },
      });
      await tx.inventory.update({
        where: { variantId: item.variantId },
        data: { availableQuantity: { increment: item.quantity }, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryId: item.variantId,
          shopId: item.shopId,
          sellerOrderId,
          orderItemId: item.id,
          actorUserId,
          kind: "CANCEL_RETURN",
          effectType: "RESTORE",
          quantityDelta: item.quantity,
          quantityAfter: inventory.availableQuantity + item.quantity,
          reason,
          operationKey: `restore:${sellerOrderId}:${item.id}`,
        },
      });
    }
    const allocations = await tx.paymentAllocation.findMany({
      where: { sellerOrderId, kind: "MOCK_PREPAYMENT", refund: null },
      include: { attempt: true },
    });
    for (const allocation of allocations) {
      if (allocation.attempt.status !== "SUCCEEDED") continue;
      await tx.simulatedRefund.create({
        data: {
          allocationId: allocation.id,
          sellerOrderId,
          amount: allocation.amount,
          reason: "CANCELLATION",
          operationKey: `refund:cancel:${allocation.id}`,
        },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId,
        sellerOrderId,
        actorUserId,
        actorKind,
        action,
        fromStatus: part.status,
        toStatus: "CANCELLED",
        reason,
        operationKey: `cancel:${sellerOrderId}`,
      },
    });
    return part;
  }

  async compensateLate(
    tx: Prisma.TransactionClient,
    paymentId: string,
    attempt: { id: string; amount: { toString(): string }; targetSellerOrdersSnapshot: unknown },
    eventId: string,
    payloadDigest: string,
    now: Date,
  ) {
    const source = await tx.paymentEvent.create({
      data: {
        paymentId,
        attemptId: attempt.id,
        provider: "MOCK",
        externalEventId: eventId,
        payloadDigest,
        observedStatus: "SUCCEEDED",
        processingResult: "REFUNDED",
        lateReceivedAmount: attempt.amount,
        lateReceivedTransactionId: `MOCK-LATE-${eventId}`,
      },
    });
    const snapshot = attempt.targetSellerOrdersSnapshot as SnapshotPart[];
    const latest = await tx.paymentAttempt.aggregate({
      where: { paymentId },
      _max: { attemptNumber: true },
    });
    const compensation = await tx.paymentAttempt.create({
      data: {
        paymentId,
        attemptNumber: latest._max.attemptNumber! + 1,
        provider: "MOCK",
        settlementKind: "LATE_COMPENSATION",
        originalAttemptId: attempt.id,
        compensatesEventId: source.id,
        status: "SUCCEEDED",
        targetSellerOrdersSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        amount: attempt.amount,
        externalTransactionId: `MOCK-LATE-${eventId}`,
        settledAt: now,
        operationKey: `late-compensation:${eventId}`,
      },
    });
    for (const part of snapshot) {
      const allocation = await tx.paymentAllocation.create({
        data: {
          attemptId: compensation.id,
          sellerOrderId: part.sellerOrderId,
          amount: part.amount,
          kind: "MOCK_PREPAYMENT",
        },
      });
      await tx.simulatedRefund.create({
        data: {
          allocationId: allocation.id,
          sellerOrderId: part.sellerOrderId,
          amount: allocation.amount,
          reason: "LATE_SUCCESS",
          operationKey: `refund:late:${source.id}:${part.sellerOrderId}`,
        },
      });
    }
  }
}
