import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import { OrderQueryService } from "../../order/services/order-query.service.js";

@Injectable()
export class OrderInquiryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orders: OrderQueryService,
  ) {}

  list(query: Parameters<OrderQueryService["listAdmin"]>[0]) {
    return this.orders.listAdmin(query);
  }

  async get(id: string) {
    const order = await this.orders.get("", id, true);
    const sellerOrderIds = order.sellerOrders.map((part) => part.id);
    const refs = await this.db.prisma.auditEvent.findMany({
      where: {
        OR: [
          { targetType: "MarketplaceOrder", targetId: id },
          ...(sellerOrderIds.length
            ? [{ targetType: "SellerOrder", targetId: { in: sellerOrderIds } }]
            : []),
        ],
      },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { order, auditReferenceIds: refs.map((row) => row.id) };
  }
}
