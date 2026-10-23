import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../../generated/prisma/client.js";
import { DatabaseService } from "../../../database/prisma.service.js";

export type OrderLockSet = { orderId: string; paymentId: string; sellerOrderIds: string[] };

@Injectable()
export class OrderTransaction {
  constructor(private readonly db: DatabaseService) {}

  run<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.prisma.$transaction(work, { maxWait: 10_000, timeout: 30_000 });
  }

  async lockOrderGraph(tx: Prisma.TransactionClient, orderId: string): Promise<OrderLockSet> {
    const orders = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM marketplace_orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    if (!orders.length) throw new NotFoundException();
    const payments = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM payments WHERE order_id = ${orderId}::uuid FOR UPDATE`;
    if (!payments.length) throw new NotFoundException();
    const sellerOrders = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM seller_orders WHERE order_id = ${orderId}::uuid ORDER BY id FOR UPDATE`;
    return {
      orderId,
      paymentId: payments[0]!.id,
      sellerOrderIds: sellerOrders.map(({ id }) => id),
    };
  }

  async lockSellerOrderGraph(tx: Prisma.TransactionClient, sellerOrderId: string) {
    const rows = await tx.$queryRaw<Array<{ order_id: string }>>`
      SELECT order_id FROM seller_orders WHERE id = ${sellerOrderId}::uuid`;
    if (!rows.length) throw new NotFoundException();
    const locked = await this.lockOrderGraph(tx, rows[0]!.order_id);
    if (!locked.sellerOrderIds.includes(sellerOrderId)) throw new NotFoundException();
    return locked;
  }

  async lockInventory(tx: Prisma.TransactionClient, sellerOrderIds: string[]) {
    if (!sellerOrderIds.length) return;
    const variants = await tx.$queryRaw<Array<{ variant_id: string }>>`
      SELECT DISTINCT variant_id FROM order_items
      WHERE seller_order_id = ANY(${sellerOrderIds}::uuid[]) ORDER BY variant_id`;
    const ids = variants.map(({ variant_id }) => variant_id);
    if (!ids.length) return;
    await tx.$queryRaw`SELECT id FROM product_variants WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
    await tx.$queryRaw`SELECT variant_id FROM inventory WHERE variant_id = ANY(${ids}::uuid[]) ORDER BY variant_id FOR UPDATE`;
  }
}
