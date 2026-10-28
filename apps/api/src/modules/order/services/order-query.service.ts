import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import { canFulfillExistingOrder } from "../../../common/auth/fulfillment-access.js";
import { aggregateOrder } from "./order-aggregate.js";

const orderInclude = {
  sellerOrders: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: {
      items: { orderBy: { createdAt: "asc" as const }, include: { review: { select: { id: true, rating: true, comment: true, createdAt: true } } } },
      shipment: {
        include: {
          events: {
            orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
          },
        },
      },
    },
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

  async listAdmin(query: {
    q?: string;
    buyerId?: string;
    shopId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();
    const where = {
      ...(query.buyerId ? { buyerUserId: query.buyerId } : {}),
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.shopId ? { sellerOrders: { some: { shopId: query.shopId } } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { publicNumber: { contains: q, mode: "insensitive" as const } },
              { buyer: { emailNormalized: { contains: q, mode: "insensitive" as const } } },
              { buyer: { displayName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    };
    const result = await this.db.prisma.$transaction(async (tx) => {
      const [orders, total] = await Promise.all([
        tx.marketplaceOrder.findMany({
          where,
          select: { id: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.marketplaceOrder.count({ where }),
      ]);
      return { orders, total };
    }, { isolationLevel: "RepeatableRead" });
    const rows = await Promise.all(result.orders.map(({ id }) => this.get("", id, true)));
    return {
      data: rows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        partiallyCancelled: order.partiallyCancelled,
        originalTotal: order.originalTotal,
        outstandingAmount: order.outstandingAmount,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })),
      meta: { page, pageSize, total: result.total },
    };
  }

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
    if (query.paymentStatus)
      rows = rows.filter((row) => row.paymentStatus === query.paymentStatus);
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

  async getSellerPart(
    userId: string,
    shopId: string,
    id: string,
    admin = false,
  ) {
    const row = await this.db.prisma.$transaction(async (tx) => {
      if (!admin) await canFulfillExistingOrder(tx, userId, shopId);
      return tx.marketplaceOrder.findFirst({
        where: {
          sellerOrders: {
            some: {
              id,
              shopId,
            },
          },
        },
        include: orderInclude,
      });
    });
    if (!row) throw new NotFoundException();
    const part = aggregateOrder(row).sellerOrders.find(
      (item) => item.id === id && item.shopId === shopId,
    );
    if (!part) throw new NotFoundException();
    return part;
  }

  async listSellerParts(
    userId: string,
    shopId: string,
    query: {
      status?: string;
      from?: string;
      to?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      shopId,
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const { parts, total } = await this.db.prisma.$transaction(async (tx) => {
      await canFulfillExistingOrder(tx, userId, shopId);
      const [parts, total] = await Promise.all([
        tx.sellerOrder.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: { id: true },
        }),
        tx.sellerOrder.count({ where }),
      ]);
      return { parts, total };
    });
    const data = await Promise.all(
      parts.map(({ id }) => this.getSellerPart(userId, shopId, id)),
    );
    return { data, meta: { page, pageSize, total } };
  }
}
