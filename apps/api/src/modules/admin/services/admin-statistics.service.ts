import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";

const grouped = (rows: Array<{ status: string; _count: { _all: number } }>) =>
  Object.fromEntries(rows.map((row) => [row.status, row._count._all]));

@Injectable()
export class AdminStatisticsService {
  constructor(private readonly db: DatabaseService) {}

  async get(query: { from?: string; to?: string }) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const snapshot = await this.db.prisma.$transaction(
      async (tx) => {
        const [
          userCount,
          shopCount,
          productCount,
          orderCount,
          users,
          shops,
          products,
          orders,
          sellerOrders,
          completed,
        ] = await Promise.all([
          tx.user.count(),
          tx.shop.count(),
          tx.product.count(),
          tx.marketplaceOrder.count(),
          tx.user.groupBy({ by: ["status"], _count: { _all: true } }),
          tx.shop.groupBy({ by: ["status"], _count: { _all: true } }),
          tx.product.groupBy({ by: ["saleStatus"], _count: { _all: true } }),
          tx.marketplaceOrder.groupBy({
            by: ["status"],
            _count: { _all: true },
          }),
          tx.sellerOrder.groupBy({ by: ["status"], _count: { _all: true } }),
          tx.sellerOrder.aggregate({
            where: { status: "COMPLETED", completedAt: { gte: from, lt: to } },
            _sum: { originalTotal: true },
          }),
        ]);
        return {
          userCount,
          shopCount,
          productCount,
          orderCount,
          countsByStatus: {
            User: grouped(users),
            Shop: grouped(shops),
            Product: grouped(
              products.map(({ saleStatus, _count }) => ({
                status: saleStatus,
                _count,
              })),
            ),
            Order: grouped(orders),
            SellerOrder: grouped(sellerOrders),
          },
          completedSellerOrderValue:
            completed._sum.originalTotal?.toFixed(0) ?? "0",
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    return {
      ...snapshot,
      currency: "VND" as const,
      simulated: true as const,
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Asia/Saigon" as const,
    };
  }
}
