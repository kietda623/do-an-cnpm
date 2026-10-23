import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import { aggregateOrder } from "./order-aggregate.js";

const orderInclude = {
  sellerOrders: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { items: { orderBy: { createdAt: "asc" as const } } },
  },
  payment: true,
};

@Injectable()
export class OrderQueryService {
  constructor(private readonly db: DatabaseService) {}

  async list(
    userId: string,
    query: {
      status?: string;
      paymentStatus?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    // Payment attempts and settlement are introduced in US6. US5 orders are all unpaid.
    if (query.paymentStatus && query.paymentStatus !== "UNPAID") {
      return { data: [], meta: { page, pageSize, total: 0 } };
    }
    const where = {
      buyerUserId: userId,
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.status ? { status: query.status as never } : {}),
    };
    const [orders, total] = await Promise.all([
      this.db.prisma.marketplaceOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.prisma.marketplaceOrder.count({ where }),
    ]);
    const data = orders.map((row) => {
      const order = aggregateOrder(row);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        partiallyCancelled: order.partiallyCancelled,
        originalTotal: order.originalTotal,
        outstandingAmount: order.outstandingAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      };
    });
    return { data, meta: { page, pageSize, total } };
  }

  async get(userId: string, id: string) {
    const row = await this.db.prisma.marketplaceOrder.findFirst({
      where: { id, buyerUserId: userId },
      include: orderInclude,
    });
    if (!row) throw new NotFoundException();
    return aggregateOrder(row);
  }
}
