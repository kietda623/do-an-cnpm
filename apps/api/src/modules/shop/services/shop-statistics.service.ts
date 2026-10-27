import { BadRequestException, Injectable } from "@nestjs/common";
import { assertCanReadExistingShopData } from "../../../common/auth/fulfillment-access.js";
import { DatabaseService } from "../../../database/prisma.service.js";

type DateRange = { from?: string; to?: string };
type RevenuePoint = { period: string; completedCount: number; revenue: string };
const range = (query: DateRange) => {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to) throw new BadRequestException({ code: "INVALID_DATE_RANGE" });
  return { from, to };
};

@Injectable()
export class ShopStatisticsService {
  constructor(private readonly db: DatabaseService) {}

  async stats(userId: string, shopId: string, query: DateRange) {
    const { from, to } = range(query);
    const result = await this.db.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await assertCanReadExistingShopData(tx, userId, shopId);
        const [
          productCount,
          pendingCount,
          processingCount,
          completedCount,
          total,
        ] = await Promise.all([
          tx.product.count({
            where: { shopId, saleStatus: { not: "DISCONTINUED" } },
          }),
          tx.sellerOrder.count({ where: { shopId, status: "PENDING" } }),
          tx.sellerOrder.count({
            where: {
              shopId,
              status: { in: ["CONFIRMED", "PACKING", "SHIPPING", "DELIVERED"] },
            },
          }),
          tx.sellerOrder.count({ where: { shopId, status: "COMPLETED" } }),
          tx.sellerOrder.aggregate({
            where: {
              shopId,
              status: "COMPLETED",
              completedAt: { gte: from, lt: to },
            },
            _sum: { originalTotal: true },
          }),
        ]);
        return {
          productCount,
          pendingCount,
          processingCount,
          completedCount,
          completedRevenue: total._sum.originalTotal?.toFixed(0) ?? "0",
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
    return {
      shopId,
      ...result,
      currency: "VND" as const,
      simulated: true as const,
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Asia/Saigon" as const,
    };
  }

  async revenue(
    userId: string,
    shopId: string,
    query: DateRange & { groupBy: "DAY" | "MONTH" },
  ) {
    const { from, to } = range(query);
    const points = await this.db.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await assertCanReadExistingShopData(tx, userId, shopId);
        return tx.$queryRaw<RevenuePoint[]>`
        SELECT to_char(timezone('Asia/Saigon', completed_at),
          CASE WHEN ${query.groupBy}::text = 'DAY' THEN 'YYYY-MM-DD' ELSE 'YYYY-MM' END) AS period,
          COUNT(*)::int AS "completedCount", SUM(original_total)::text AS revenue
        FROM seller_orders
        WHERE shop_id = ${shopId}::uuid AND status = 'COMPLETED'
          AND completed_at >= ${from} AND completed_at < ${to}
        GROUP BY 1 ORDER BY 1`;
      },
      { isolationLevel: "RepeatableRead" },
    );
    const totalRevenue = points
      .reduce((sum, point) => sum + BigInt(point.revenue), 0n)
      .toString();
    return {
      shopId,
      groupBy: query.groupBy,
      points,
      totalRevenue,
      currency: "VND" as const,
      simulated: true as const,
      timezone: "Asia/Saigon" as const,
    };
  }
}
