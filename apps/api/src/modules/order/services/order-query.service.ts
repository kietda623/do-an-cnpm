import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import { aggregateOrder } from "./order-aggregate.js";

const orderInclude = {
  sellerOrders: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { items: { orderBy: { createdAt: "asc" as const } } },
  },
  payment: {
    include: {
      attempts: {
        orderBy: [{ attemptNumber: "asc" as const }, { id: "asc" as const }],
        include: { allocations: { include: { refund: true } } },
      },
    },
  },
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
    const orders = await this.db.prisma.$transaction(
      (tx) =>
        tx.marketplaceOrder.findMany({
          where,
          include: orderInclude,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      { isolationLevel: "RepeatableRead" },
    );
    let rows = orders.map((row) => {
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
    if (query.paymentStatus) rows = rows.filter((row) => row.paymentStatus === query.paymentStatus);
    const total = rows.length;
    const data = rows.slice((page - 1) * pageSize, page * pageSize);
    return { data, meta: { page, pageSize, total } };
  }

  async get(userId: string, id: string, admin = false) {
    const row = await this.db.prisma.marketplaceOrder.findFirst({
      where: { id, ...(admin ? {} : { buyerUserId: userId }) },
      include: {
        ...orderInclude,
        payment: {
          include: {
            attempts: {
              orderBy: [{ attemptNumber: "asc" }, { id: "asc" }],
              include: { allocations: { include: { refund: true } } },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    return aggregateOrder(row);
  }

  async getSellerPart(userId: string, shopId: string, id: string, admin = false) {
    const row = await this.db.prisma.marketplaceOrder.findFirst({
      where: {
        sellerOrders: {
          some: {
            id,
            shopId,
            ...(admin
              ? {}
              : { shop: { status: "ACTIVE", members: { some: { userId, status: "ACTIVE" } } } }),
          },
        },
      },
      include: orderInclude,
    });
    if (!row) throw new NotFoundException();
    const part = aggregateOrder(row).sellerOrders.find(
      (item) => item.id === id && item.shopId === shopId,
    );
    if (!part) throw new NotFoundException();
    return part;
  }
}
