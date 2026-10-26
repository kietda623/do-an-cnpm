import { Injectable, NotFoundException } from "@nestjs/common";
import type { SystemRole } from "../../../common/auth/access-context.js";
import { canViewPayments } from "../../../common/auth/permissions.js";
import { DatabaseService } from "../../../database/prisma.service.js";

const paymentInclude = {
  attempts: {
    orderBy: [{ attemptNumber: "asc" as const }, { id: "asc" as const }],
    include: { allocations: { include: { refund: true } } },
  },
};

@Injectable()
export class PaymentQueryService {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, systemRole: SystemRole, orderId: string) {
    const order = await this.db.prisma.marketplaceOrder.findFirst({
      where: {
        id: orderId,
        ...(!canViewPayments(systemRole) ? { buyerUserId: userId } : {}),
      },
      include: { payment: { include: paymentInclude } },
    });
    if (!order?.payment) throw new NotFoundException();
    const attempts = order.payment.attempts;
    if (!attempts.length)
      return [
        {
          id: order.payment.id,
          orderId,
          transactionCode: order.publicNumber,
          method: order.paymentMethod,
          status: "PENDING",
          settlementKind: "NORMAL",
          originalAttemptId: null,
          amount: order.originalTotal.toString(),
          currency: "VND",
          allocations: [],
          refunds: [],
          createdAt: order.payment.createdAt,
          resolvedAt: null,
        },
      ];
    return attempts.map((attempt) => ({
      id: attempt.id,
      orderId,
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
    }));
  }
}
