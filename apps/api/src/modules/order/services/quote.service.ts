import { Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../../../database/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";

type QuoteInput = { cartItemIds: string[]; addressId: string; paymentMethod: "COD" | "MOCK" };
type QuoteLine = {
  cartItemId: string;
  variantId: string;
  shopId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

@Injectable()
export class QuoteService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, input: QuoteInput) {
    const ids = [...new Set(input.cartItemIds)].sort();
    if (ids.length !== input.cartItemIds.length) {
      return {
        quoteId: randomUUID(),
        expiresAt: new Date(Date.now() + 5 * 60_000),
        lines: [],
        groups: [],
        addressSnapshot: null,
        total: "0",
        currency: "VND",
        valid: false,
        issues: [
          {
            cartItemId: null,
            code: "DUPLICATE_CART_ITEM",
            message: "Choose each cart line only once.",
          },
        ],
      };
    }
    const cart = await this.db.prisma.cart.findUnique({
      where: { buyerUserId: userId },
      include: {
        items: {
          where: { id: { in: ids } },
          orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
          include: {
            variant: {
              include: {
                inventory: true,
                product: { include: { shop: true, category: true } },
              },
            },
          },
        },
      },
    });
    if (!cart || cart.items.length !== ids.length) throw new NotFoundException();
    const address = await this.db.prisma.address.findFirst({
      where: { id: input.addressId, userId, deletedAt: null },
    });
    if (!address) throw new NotFoundException();
    const nowRows = await this.db.prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const productIds = [...new Set(cart.items.map((item) => item.variant.product.id))];
    const hiddenRows = productIds.length
      ? await this.db.prisma.$queryRaw<Array<{ product_id: string }>>`
          WITH RECURSIVE ancestors(product_id, category_id, parent_id, status) AS (
            SELECT p.id, c.id, c.parent_id, c.status FROM products p
            JOIN categories c ON c.id = p.category_id WHERE p.id = ANY(${productIds}::uuid[])
            UNION ALL SELECT a.product_id, c.id, c.parent_id, c.status
            FROM ancestors a JOIN categories c ON c.id = a.parent_id
          ) SELECT DISTINCT product_id FROM ancestors WHERE status = 'HIDDEN'`
      : [];
    const hiddenProducts = new Set(hiddenRows.map((row) => row.product_id));
    const now = nowRows[0]!.now;
    const expiresAt = new Date(now.getTime() + 5 * 60_000);
    const lines: QuoteLine[] = [];
    const issues: Array<{ cartItemId: string | null; code: string; message: string }> = [];
    const grouped = new Map<string, { shopId: string; subtotal: bigint }>();
    for (const item of cart.items) {
      const variant = item.variant;
      const product = variant.product;
      const unitPrice = BigInt(variant.price.toString());
      const lineTotal = unitPrice * BigInt(item.quantity);
      lines.push({
        cartItemId: item.id,
        variantId: variant.id,
        shopId: product.shopId,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        lineTotal: lineTotal.toString(),
      });
      const group = grouped.get(product.shopId) ?? { shopId: product.shopId, subtotal: 0n };
      group.subtotal += lineTotal;
      grouped.set(product.shopId, group);
      if (!item.selected) {
        issues.push({
          cartItemId: item.id,
          code: "ITEM_NOT_SELECTED",
          message: "Select each cart item before requesting a checkout quote.",
        });
      }
      if (
        product.shop.status !== "ACTIVE" ||
        product.saleStatus !== "ACTIVE" ||
        product.adminHidden ||
        product.category.status !== "VISIBLE" ||
        hiddenProducts.has(product.id) ||
        variant.saleStatus !== "ACTIVE"
      ) {
        issues.push({
          cartItemId: item.id,
          code: "PRODUCT_UNAVAILABLE",
          message: "A product is no longer available for purchase.",
        });
      } else if (!variant.inventory || variant.inventory.availableQuantity < item.quantity) {
        issues.push({
          cartItemId: item.id,
          code: "INSUFFICIENT_STOCK",
          message: "There is not enough stock for a selected item.",
        });
      }
    }
    const total = lines.reduce((sum, line) => sum + BigInt(line.lineTotal), 0n);
    const groups = [...grouped.values()].map((group) => ({
      shopId: group.shopId,
      subtotal: group.subtotal.toString(),
      shippingFee: "0",
      total: group.subtotal.toString(),
    }));
    const addressSnapshot = {
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      ward: address.ward,
      district: address.district,
      province: address.province,
      country: address.country,
      postalCode: address.postalCode,
    };
    const quoteId = randomUUID();
    const canonical = JSON.stringify({
      userId,
      cartId: cart.id,
      cartVersion: cart.version,
      lines,
      addressId: address.id,
      addressSnapshot,
      paymentMethod: input.paymentMethod,
    });
    const canonicalHash = createHash("sha256").update(canonical).digest("hex");
    if (total > 0n && issues.length === 0) {
      await this.db.prisma.checkoutQuote.create({
        data: {
          id: quoteId,
          buyerUserId: userId,
          cartId: cart.id,
          cartVersion: cart.version,
          selectedItems: lines as unknown as Prisma.InputJsonValue,
          addressId: address.id,
          recipientSnapshot: addressSnapshot as unknown as Prisma.InputJsonValue,
          paymentMethod: input.paymentMethod,
          total: total.toString(),
          canonicalHash,
          expiresAt,
          createdAt: now,
        },
      });
    }
    return {
      quoteId,
      expiresAt,
      lines,
      groups,
      addressSnapshot,
      total: total.toString(),
      currency: "VND" as const,
      valid: issues.length === 0,
      issues,
    };
  }
}
