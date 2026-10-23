import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "../../../generated/prisma/client.js";
import { DatabaseService } from "../../../database/prisma.service.js";
import { OrderTransaction } from "../../order/services/order-transaction.js";
import { SettlementService } from "./settlement.service.js";
import { sumVnd } from "./payment-policy.js";

type TargetPart = { sellerOrderId: string; amount: string };
type PaymentResult = {
  eventId: string;
  outcome: "SUCCEEDED" | "FAILED" | "CANCELLED";
  expectedVersion: number;
};
const conflict = (code: string, message: string, details?: unknown) =>
  new ConflictException({ code, message, ...(details ? { details } : {}) });
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const attemptInclude = {
  allocations: { include: { refund: true } },
} as const;
const paymentInclude = {
  order: { include: { sellerOrders: true } },
  attempts: {
    orderBy: [{ attemptNumber: "asc" as const }, { id: "asc" as const }],
    include: attemptInclude,
  },
} as const;

@Injectable()
export class PaymentService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orderTx: OrderTransaction,
    private readonly settlement: SettlementService,
  ) {}

  async startMockAttempt(userId: string, orderId: string, key: string) {
    const requestHash = digest({ orderId });
    const result = await this.orderTx.run(async (tx) => {
      const idem = await this.claim(tx, userId, "MOCK_ATTEMPT", key, requestHash);
      if (idem.replay) return { attemptId: idem.resourceId! };
      const preview = await tx.marketplaceOrder.findFirst({
        where: { id: orderId, buyerUserId: userId },
        select: { id: true },
      });
      if (!preview) throw new NotFoundException();
      await this.orderTx.lockOrderGraph(tx, orderId);
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      const order = await tx.marketplaceOrder.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          sellerOrders: { orderBy: { id: "asc" } },
          payment: { include: { attempts: true } },
        },
      });
      const payment = order.payment;
      if (!payment) throw new NotFoundException();
      if (order.paymentMethod !== "MOCK")
        throw conflict("PAYMENT_METHOD_MISMATCH", "This order does not use mock prepayment.");
      if (!order.paymentDeadline || order.paymentDeadline <= now)
        throw conflict("ORDER_EXPIRED", "The mock payment window has expired.");
      if (
        order.sellerOrders.some((part) => part.status !== "PENDING" && part.status !== "CANCELLED")
      )
        throw conflict(
          "ORDER_NOT_PAYABLE",
          "Mock payment is only available before fulfillment starts.",
        );
      const liveParts = order.sellerOrders.filter((part) => part.status !== "CANCELLED");
      if (!liveParts.length) throw conflict("ORDER_CANCELLED", "All seller orders are cancelled.");
      const succeeded = payment.attempts.some(
        (attempt) =>
          attempt.provider === "MOCK" &&
          attempt.settlementKind === "NORMAL" &&
          attempt.status === "SUCCEEDED",
      );
      if (succeeded)
        throw conflict("ALREADY_PAID", "This order already has a successful mock payment.");
      const pending = payment.attempts.find(
        (attempt) =>
          attempt.provider === "MOCK" &&
          attempt.settlementKind === "NORMAL" &&
          attempt.status === "PENDING",
      );
      if (pending && pending.expiresAt && pending.expiresAt > now)
        throw conflict("ATTEMPT_IN_PROGRESS", "A mock payment attempt is already pending.");
      if (pending)
        await tx.paymentAttempt.update({
          where: { id: pending.id },
          data: { status: "CANCELLED", settledAt: now },
        });
      const snapshot: TargetPart[] = liveParts.map((part) => ({
        sellerOrderId: part.id,
        amount: part.originalTotal.toString(),
      }));
      const amount = sumVnd(snapshot.map((part) => part.amount));
      const lastAttemptNumber = Math.max(
        0,
        ...payment.attempts.map((attempt) => attempt.attemptNumber),
      );
      const previous = payment.attempts.at(-1);
      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          attemptNumber: lastAttemptNumber + 1,
          provider: "MOCK",
          settlementKind: "NORMAL",
          originalAttemptId: previous?.id ?? null,
          status: "PENDING",
          targetSellerOrdersSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          amount,
          expiresAt: order.paymentDeadline,
          operationKey: `mock-attempt:${key}`,
        },
        include: attemptInclude,
      });
      await tx.payment.update({ where: { id: payment.id }, data: { version: { increment: 1 } } });
      await tx.marketplaceOrder.update({
        where: { id: orderId },
        data: { version: { increment: 1 } },
      });
      await this.complete(tx, idem.id, "PaymentAttempt", attempt.id, 201);
      return { attemptId: attempt.id };
    });
    return this.readAttempt(userId, result.attemptId);
  }

  async mockResult(userId: string, attemptId: string, key: string, input: PaymentResult) {
    const preview = await this.db.prisma.paymentAttempt.findUnique({
      where: { id: attemptId },
      select: { payment: { select: { orderId: true } } },
    });
    if (!preview) throw new NotFoundException();
    const orderId = preview.payment.orderId;
    const requestHash = digest({ attemptId, ...input });
    const result = await this.orderTx.run(async (tx) => {
      const idem = await this.claim(tx, userId, "MOCK_RESULT", key, requestHash);
      if (idem.replay) return { attemptId: idem.resourceId!, terminalConflict: false };
      const orderPreview = await tx.marketplaceOrder.findFirst({
        where: { id: orderId, buyerUserId: userId },
        select: { id: true },
      });
      if (!orderPreview) throw new NotFoundException();
      await this.orderTx.lockOrderGraph(tx, orderId);
      await tx.$queryRaw`SELECT id FROM payment_attempts WHERE id = ${attemptId}::uuid FOR UPDATE`;
      const payment = await tx.payment.findUniqueOrThrow({
        where: { orderId },
        include: { order: true },
      });
      const attempt = await tx.paymentAttempt.findFirst({
        where: { id: attemptId, paymentId: payment.id },
        include: attemptInclude,
      });
      if (!attempt) throw new NotFoundException();
      const eventPayload = {
        eventId: input.eventId,
        attemptId,
        outcome: input.outcome,
        expectedVersion: input.expectedVersion,
      };
      const payloadDigest = digest(eventPayload);
      const seen = await tx.paymentEvent.findUnique({
        where: { provider_externalEventId: { provider: "MOCK", externalEventId: input.eventId } },
      });
      if (seen) {
        if (seen.payloadDigest !== payloadDigest)
          throw conflict("EVENT_ID_REUSED", "This event ID was already used for different data.");
        await this.complete(tx, idem.id, "PaymentAttempt", attempt.id, 200);
        return { attemptId: attempt.id, terminalConflict: false };
      }
      if (payment.order.version !== input.expectedVersion)
        throw conflict("VERSION_CONFLICT", "Payment changed. Reload before submitting the result.");
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      const deadline = payment.order.paymentDeadline;
      const late =
        input.outcome === "SUCCEEDED" &&
        attempt.status !== "SUCCEEDED" &&
        (attempt.status !== "PENDING" ||
          !deadline ||
          deadline <= now ||
          Boolean(attempt.expiresAt && attempt.expiresAt <= now));
      if (attempt.status === "PENDING" && !late) {
        if (input.outcome === "SUCCEEDED") {
          const alreadySucceeded = await tx.paymentAttempt.findFirst({
            where: {
              paymentId: payment.id,
              provider: "MOCK",
              settlementKind: "NORMAL",
              status: "SUCCEEDED",
            },
          });
          if (alreadySucceeded)
            throw conflict("ALREADY_PAID", "Another mock attempt has already succeeded.");
          const snapshot = attempt.targetSellerOrdersSnapshot as unknown as TargetPart[];
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: "SUCCEEDED",
              settledAt: now,
              externalTransactionId: `MOCK-${input.eventId}`,
            },
          });
          for (const part of snapshot) {
            await tx.paymentAllocation.create({
              data: {
                attemptId: attempt.id,
                sellerOrderId: part.sellerOrderId,
                amount: part.amount,
                kind: "MOCK_PREPAYMENT",
              },
            });
          }
        } else {
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: input.outcome,
              settledAt: now,
              externalTransactionId: `MOCK-${input.eventId}`,
            },
          });
        }
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            attemptId: attempt.id,
            provider: "MOCK",
            externalEventId: input.eventId,
            payloadDigest,
            observedStatus: input.outcome,
            processingResult: "APPLIED",
          },
        });
      } else if (late) {
        if (attempt.status === "PENDING")
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: { status: "CANCELLED", settledAt: now },
          });
        await this.settlement.compensateLate(
          tx,
          payment.id,
          attempt,
          input.eventId,
          payloadDigest,
          now,
        );
      } else {
        const processingResult = attempt.status === input.outcome ? "DUPLICATE" : "IGNORED";
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            attemptId: attempt.id,
            provider: "MOCK",
            externalEventId: input.eventId,
            payloadDigest,
            observedStatus: input.outcome,
            processingResult,
          },
        });
        if (processingResult === "IGNORED") {
          await tx.payment.update({
            where: { id: payment.id },
            data: { version: { increment: 1 } },
          });
          await tx.marketplaceOrder.update({
            where: { id: orderId },
            data: { version: { increment: 1 } },
          });
          await this.complete(tx, idem.id, "PaymentAttempt", attempt.id, 409);
          return { attemptId: attempt.id, terminalConflict: true };
        }
      }
      await tx.payment.update({ where: { id: payment.id }, data: { version: { increment: 1 } } });
      await tx.marketplaceOrder.update({
        where: { id: orderId },
        data: { version: { increment: 1 } },
      });
      await this.complete(tx, idem.id, "PaymentAttempt", attempt.id, 200);
      return { attemptId: attempt.id, terminalConflict: false };
    });
    if (result.terminalConflict)
      throw conflict(
        "RESULT_ALREADY_TERMINAL",
        "The attempt already has a different terminal result.",
      );
    return this.readAttempt(userId, result.attemptId);
  }

  async collectCod(
    userId: string,
    sellerOrderId: string,
    key: string,
    eventId: string,
    expectedVersion: number,
  ) {
    const preview = await this.db.prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { orderId: true },
    });
    if (!preview) throw new NotFoundException();
    const orderId = preview.orderId;
    const requestHash = digest({ sellerOrderId, eventId, expectedVersion });
    const result = await this.orderTx.run(async (tx) => {
      const idem = await this.claim(tx, userId, "COD_COLLECTION", key, requestHash);
      if (idem.replay) return { orderId, attemptId: idem.resourceId! };
      await this.orderTx.lockSellerOrderGraph(tx, sellerOrderId);
      const order = await tx.marketplaceOrder.findFirst({
        where: { id: orderId, payment: { method: "COD" } },
        include: { payment: true },
      });
      if (!order?.payment) throw new NotFoundException();
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { systemRole: true },
      });
      if (actor?.systemRole !== "ADMIN") {
        const part = await tx.sellerOrder.findFirst({
          where: {
            id: sellerOrderId,
            shop: { status: "ACTIVE", members: { some: { userId, status: "ACTIVE" } } },
          },
          select: { id: true },
        });
        if (!part) throw new NotFoundException();
      }
      const part = await tx.sellerOrder.findUniqueOrThrow({ where: { id: sellerOrderId } });
      const eventDigest = digest({ sellerOrderId, eventId, expectedVersion });
      const seen = await tx.paymentEvent.findUnique({
        where: {
          provider_externalEventId: { provider: "COD_SIMULATION", externalEventId: eventId },
        },
      });
      if (seen) {
        if (seen.payloadDigest !== eventDigest)
          throw conflict("EVENT_ID_REUSED", "This event ID was already used for different data.");
        await this.complete(tx, idem.id, "PaymentAttempt", seen.attemptId!, 200);
        return { orderId, attemptId: seen.attemptId! };
      }
      if (order.version !== expectedVersion)
        throw conflict("VERSION_CONFLICT", "Payment changed. Reload before collecting COD.");
      if (part.status !== "DELIVERED")
        throw conflict("ORDER_NOT_DELIVERED", "COD can be collected only after delivery.");
      if (order.paymentMethod !== "COD")
        throw conflict("PAYMENT_METHOD_MISMATCH", "This order does not use COD.");
      if (
        await tx.paymentAllocation.findFirst({ where: { sellerOrderId, kind: "COD_COLLECTION" } })
      )
        throw conflict(
          "COD_ALREADY_COLLECTED",
          "COD has already been collected for this seller order.",
        );
      const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!
        .now;
      const number = await tx.paymentAttempt.count({ where: { paymentId: order.payment.id } });
      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentId: order.payment.id,
          attemptNumber: number + 1,
          provider: "COD_SIMULATION",
          settlementKind: "NORMAL",
          status: "SUCCEEDED",
          targetSellerOrdersSnapshot: [{ sellerOrderId, amount: part.originalTotal.toString() }],
          amount: part.originalTotal,
          externalTransactionId: `COD-${eventId}`,
          settledAt: now,
          operationKey: `cod-collection:${key}`,
          allocations: {
            create: { sellerOrderId, amount: part.originalTotal, kind: "COD_COLLECTION" },
          },
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: order.payment.id,
          attemptId: attempt.id,
          provider: "COD_SIMULATION",
          externalEventId: eventId,
          payloadDigest: requestHash,
          observedStatus: "SUCCEEDED",
          processingResult: "APPLIED",
        },
      });
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { version: { increment: 1 } },
      });
      await tx.marketplaceOrder.update({
        where: { id: orderId },
        data: { version: { increment: 1 } },
      });
      await this.complete(tx, idem.id, "PaymentAttempt", attempt.id, 200);
      return { orderId, attemptId: attempt.id };
    });
    const payment = await this.db.prisma.marketplaceOrder.findFirst({
      where: { id: result.orderId },
      include: { payment: { include: paymentInclude } },
    });
    if (!payment?.payment) throw new NotFoundException();
    const attempt = payment.payment.attempts.find((item) => item.id === result.attemptId);
    if (!attempt) return this.presentBase(payment.payment, payment);
    return this.presentAttempt(payment, attempt);
  }

  async expireDueOrders() {
    const dbNow = (
      await this.db.prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`
    )[0]!.now;
    const due = await this.db.prisma.marketplaceOrder.findMany({
      where: {
        paymentMethod: "MOCK",
        paymentDeadline: { lte: dbNow },
        sellerOrders: { some: { status: "PENDING" } },
      },
      select: { id: true },
      orderBy: [{ paymentDeadline: "asc" }, { id: "asc" }],
      take: 100,
    });
    let expired = 0;
    for (const order of due) {
      const didExpire = await this.orderTx.run(async (tx) => {
        const locked = await this.orderTx.lockOrderGraph(tx, order.id);
        await this.orderTx.lockInventory(tx, locked.sellerOrderIds);
        const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!
          .now;
        const row = await tx.marketplaceOrder.findUniqueOrThrow({
          where: { id: order.id },
          include: {
            sellerOrders: { include: { items: true } },
            payment: { include: { attempts: true } },
          },
        });
        if (!row.paymentDeadline || row.paymentDeadline > now || row.paymentMethod !== "MOCK")
          return false;
        if (
          row.payment?.attempts.some(
            (attempt) => attempt.settlementKind === "NORMAL" && attempt.status === "SUCCEEDED",
          )
        )
          return false;
        for (const attempt of row.payment?.attempts ?? []) {
          if (attempt.provider === "MOCK" && attempt.status === "PENDING")
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: { status: "CANCELLED", settledAt: now },
            });
        }
        for (const part of row.sellerOrders.filter(
          (sellerOrder) => sellerOrder.status === "PENDING",
        )) {
          await this.settlement.cancelAndRestore(
            tx,
            part.id,
            part.orderId,
            part.items,
            "Payment window expired",
            "SYSTEM",
            null,
            now,
            "PAYMENT_EXPIRED",
          );
        }
        await tx.marketplaceOrder.update({
          where: { id: row.id },
          data: { version: { increment: 1 } },
        });
        await tx.payment.update({
          where: { id: row.payment!.id },
          data: { version: { increment: 1 } },
        });
        await tx.auditEvent.create({
          data: {
            actorKind: "SYSTEM",
            action: "ORDER_PAYMENT_EXPIRED",
            targetType: "MarketplaceOrder",
            targetId: row.id,
            reason: "Mock payment deadline expired.",
            outcome: "SUCCESS",
            requestId: randomUUID(),
            safeMetadata: {
              restoredSellerOrderCount: row.sellerOrders.filter((part) => part.status === "PENDING")
                .length,
            },
          },
        });
        return true;
      });
      if (didExpire) expired += 1;
    }
    return expired;
  }

  private async readAttempt(userId: string, attemptId: string) {
    const attempt = await this.db.prisma.paymentAttempt.findFirst({
      where: { id: attemptId, payment: { order: { buyerUserId: userId } } },
      include: {
        ...attemptInclude,
        payment: { include: { order: { include: { sellerOrders: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException();
    return this.presentAttempt(attempt.payment.order, attempt);
  }

  private presentBase(
    payment: { id: string; createdAt: Date },
    order: {
      id: string;
      publicNumber: string;
      originalTotal: { toString(): string };
      paymentMethod: string;
    },
  ) {
    return {
      id: payment.id,
      orderId: order.id,
      transactionCode: order.publicNumber,
      method: order.paymentMethod,
      status: "PENDING",
      settlementKind: "NORMAL",
      originalAttemptId: null,
      amount: order.originalTotal.toString(),
      currency: "VND",
      allocations: [],
      refunds: [],
      createdAt: payment.createdAt,
      resolvedAt: null,
    };
  }

  private presentAttempt(
    order: { id: string; paymentMethod: string },
    attempt: {
      id: string;
      status: string;
      settlementKind: string;
      originalAttemptId: string | null;
      amount: { toString(): string };
      externalTransactionId: string | null;
      createdAt: Date;
      settledAt: Date | null;
      allocations: Array<{
        sellerOrderId: string;
        amount: { toString(): string };
        refund: {
          id: string;
          amount: { toString(): string };
          reason: string;
          createdAt: Date;
        } | null;
      }>;
    },
  ) {
    return {
      id: attempt.id,
      orderId: order.id,
      transactionCode: attempt.externalTransactionId ?? attempt.id,
      method: order.paymentMethod,
      status: attempt.status,
      settlementKind: attempt.settlementKind,
      originalAttemptId: attempt.originalAttemptId,
      amount: attempt.amount.toString(),
      currency: "VND",
      allocations: attempt.allocations.map((allocation) => ({
        sellerOrderId: allocation.sellerOrderId,
        amount: allocation.amount.toString(),
      })),
      refunds: attempt.allocations.flatMap((allocation) =>
        allocation.refund
          ? [
              {
                id: allocation.refund.id,
                sellerOrderId: allocation.sellerOrderId,
                amount: allocation.refund.amount.toString(),
                reason: allocation.refund.reason,
                createdAt: allocation.refund.createdAt,
              },
            ]
          : [],
      ),
      createdAt: attempt.createdAt,
      resolvedAt: attempt.settledAt,
    };
  }

  private async claim(
    tx: Prisma.TransactionClient,
    userId: string,
    operation: string,
    key: string,
    requestHash: string,
  ) {
    await tx.$executeRaw`
      INSERT INTO idempotency_records (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
      VALUES (${userId}::uuid, ${userId}, ${operation}, ${key}, ${requestHash}, 'IN_PROGRESS')
      ON CONFLICT (actor_scope, operation, idempotency_key) DO NOTHING`;
    const row = await tx.idempotencyRecord.findUnique({
      where: {
        actorScope_operation_idempotencyKey: { actorScope: userId, operation, idempotencyKey: key },
      },
    });
    if (!row) throw new Error("Payment idempotency record could not be loaded.");
    await tx.$queryRaw`SELECT id FROM idempotency_records WHERE id = ${row.id}::uuid FOR UPDATE`;
    const locked = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id: row.id } });
    if (locked.requestHash !== requestHash)
      throw conflict(
        "IDEMPOTENCY_KEY_REUSED",
        "This key was used for a different payment request.",
      );
    if (locked.state === "COMPLETED" && locked.resourceId)
      return { id: locked.id, replay: true, resourceId: locked.resourceId };
    return { id: locked.id, replay: false, resourceId: null };
  }

  private complete(
    tx: Prisma.TransactionClient,
    id: string,
    resourceType: string,
    resourceId: string,
    responseStatus: number,
  ) {
    return tx.idempotencyRecord.update({
      where: { id },
      data: {
        state: "COMPLETED",
        responseStatus,
        resourceType,
        resourceId,
        responseSummary: { id: resourceId },
      },
    });
  }
}
