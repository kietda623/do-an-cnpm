import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../../../database/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { aggregateOrder } from "./order-aggregate.js";

type QuoteLine = {
  cartItemId: string;
  variantId: string;
  shopId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};
const orderInclude = {
  sellerOrders: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
    include: { items: { orderBy: { createdAt: "asc" as const } } },
  },
  payment: true,
};
const conflict = (code: string, message: string) => new ConflictException({ code, message });

@Injectable()
export class CheckoutService {
  constructor(private readonly db: DatabaseService) {}

  async create(userId: string, quoteId: string, idempotencyKey: string) {
    const requestHash = createHash("sha256").update(JSON.stringify({ quoteId })).digest("hex");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.createOnce(userId, quoteId, idempotencyKey, requestHash);
      } catch (error) {
        const code =
          typeof error === "object" && error !== null && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (attempt < 2 && ["P2034", "40001", "40P01"].includes(code)) continue;
        throw error;
      }
    }
    throw new Error("Checkout retry loop exhausted unexpectedly.");
  }

  private async createOnce(
    userId: string,
    quoteId: string,
    idempotencyKey: string,
    requestHash: string,
  ) {
    const result = await this.db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO idempotency_records (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
        VALUES (${userId}::uuid, ${userId}, 'CHECKOUT', ${idempotencyKey}, ${requestHash}, 'IN_PROGRESS')
        ON CONFLICT (actor_scope, operation, idempotency_key) DO NOTHING`;
      const key = await tx.idempotencyRecord.findUnique({
        where: {
          actorScope_operation_idempotencyKey: {
            actorScope: userId,
            operation: "CHECKOUT",
            idempotencyKey,
          },
        },
      });
      if (!key) throw new Error("Idempotency claim could not be loaded.");
      await tx.$queryRaw`SELECT id FROM idempotency_records WHERE id = ${key.id}::uuid FOR UPDATE`;
      const lockedKey = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id: key.id } });
      if (lockedKey.requestHash !== requestHash)
        throw conflict(
          "IDEMPOTENCY_KEY_REUSED",
          "This key was already used for a different checkout request.",
        );
      if (lockedKey.state === "COMPLETED" && lockedKey.resourceId) {
        const replay = await tx.marketplaceOrder.findFirst({
          where: { id: lockedKey.resourceId, buyerUserId: userId },
          include: orderInclude,
        });
        if (!replay) throw new Error("Completed checkout result is missing.");
        return aggregateOrder(replay);
      }

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const quotePreview = await tx.checkoutQuote.findFirst({
        where: { id: quoteId, buyerUserId: userId },
      });
      if (!quotePreview) throw new NotFoundException();
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${quotePreview.cartId}::uuid AND buyer_user_id = ${userId}::uuid FOR UPDATE`;
      const quoteLock = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM checkout_quotes WHERE id = ${quoteId}::uuid AND buyer_user_id = ${userId}::uuid FOR UPDATE`;
      if (!quoteLock.length) throw new NotFoundException();
      const quote = await tx.checkoutQuote.findUniqueOrThrow({ where: { id: quoteId } });
      if (quote.consumedOrderId)
        throw conflict("QUOTE_CONSUMED", "This checkout quote has already been used.");
      const timeRows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
      if (quote.expiresAt <= timeRows[0]!.now)
        throw conflict("QUOTE_EXPIRED", "This quote expired. Create a new quote before checkout.");

      const cart = await tx.cart.findFirst({ where: { id: quote.cartId, buyerUserId: userId } });
      if (!cart) throw new NotFoundException();
      if (cart.version !== quote.cartVersion)
        throw conflict("CART_CHANGED", "The cart changed. Review it and create a new quote.");

      const snapshot = quote.selectedItems as unknown as QuoteLine[];
      const ids = snapshot.map((line) => line.cartItemId);
      const lines = await tx.cartItem.findMany({
        where: { cartId: cart.id, id: { in: ids } },
        include: {
          variant: {
            include: {
              inventory: true,
              product: {
                include: {
                  shop: true,
                  category: true,
                  images: { orderBy: { position: "asc" }, take: 1, include: { asset: true } },
                },
              },
            },
          },
        },
      });
      if (lines.length !== snapshot.length)
        throw conflict("CART_CHANGED", "A quoted cart item was removed. Create a new quote.");
      const variantIds = lines.map((line) => line.variantId).sort();
      const categoryIds = [...new Set(lines.map((line) => line.variant.product.categoryId))];
      const productIds = [...new Set(lines.map((line) => line.variant.product.id))];
      const shopIds = [...new Set(lines.map((line) => line.variant.product.shopId))].sort();
      if (shopIds.length)
        await tx.$queryRaw`SELECT id FROM shops WHERE id = ANY(${shopIds}::uuid[]) ORDER BY id FOR UPDATE`;
      if (categoryIds.length) {
        await tx.$queryRaw`
          WITH RECURSIVE ancestors(id, parent_id) AS (
            SELECT id, parent_id FROM categories WHERE id = ANY(${categoryIds}::uuid[])
            UNION ALL SELECT c.id, c.parent_id FROM categories c JOIN ancestors a ON c.id = a.parent_id
          )
          SELECT id FROM categories WHERE id IN (SELECT id FROM ancestors) ORDER BY id FOR UPDATE`;
      }
      if (productIds.length)
        await tx.$queryRaw`SELECT id FROM products WHERE id = ANY(${productIds}::uuid[]) ORDER BY id FOR UPDATE`;
      if (variantIds.length)
        await tx.$queryRaw`SELECT id FROM product_variants WHERE id = ANY(${variantIds}::uuid[]) ORDER BY id FOR UPDATE`;
      if (variantIds.length)
        await tx.$queryRaw`SELECT variant_id FROM inventory WHERE variant_id = ANY(${variantIds}::uuid[]) ORDER BY variant_id FOR UPDATE`;
      const fresh = await tx.cartItem.findMany({
        where: { cartId: cart.id, id: { in: ids } },
        include: {
          variant: {
            include: {
              inventory: true,
              product: {
                include: {
                  shop: true,
                  category: true,
                  images: { orderBy: { position: "asc" }, take: 1, include: { asset: true } },
                },
              },
            },
          },
        },
      });
      const freshCategoryIds = [...new Set(fresh.map((line) => line.variant.product.categoryId))];
      const hiddenCategoryRows = freshCategoryIds.length
        ? await tx.$queryRaw<Array<{ product_id: string }>>`
            WITH RECURSIVE ancestors(product_id, category_id, parent_id, status) AS (
              SELECT p.id, c.id, c.parent_id, c.status FROM products p JOIN categories c ON c.id = p.category_id
              WHERE p.id = ANY(${fresh.map((line) => line.variant.product.id)}::uuid[])
              UNION ALL SELECT a.product_id, c.id, c.parent_id, c.status FROM ancestors a JOIN categories c ON c.id = a.parent_id
            ) SELECT DISTINCT product_id FROM ancestors WHERE status = 'HIDDEN'`
        : [];
      const hiddenProducts = new Set(hiddenCategoryRows.map((row) => row.product_id));
      const byId = new Map(snapshot.map((line) => [line.cartItemId, line]));
      for (const line of fresh) {
        const quoted = byId.get(line.id)!;
        const product = line.variant.product;
        if (
          line.quantity !== quoted.quantity ||
          line.variant.id !== quoted.variantId ||
          product.shopId !== quoted.shopId
        )
          throw conflict("CART_CHANGED", "A quoted cart item changed. Create a new quote.");
        if (line.variant.price.toString() !== quoted.unitPrice)
          throw conflict(
            "PRICE_CHANGED",
            "A product price changed. Create and review a new quote.",
          );
        if (
          product.shop.status !== "ACTIVE" ||
          product.saleStatus !== "ACTIVE" ||
          product.adminHidden ||
          product.category.status !== "VISIBLE" ||
          hiddenProducts.has(product.id) ||
          line.variant.saleStatus !== "ACTIVE"
        )
          throw conflict("PRODUCT_UNAVAILABLE", "A quoted product is no longer available.");
        if (!line.variant.inventory || line.variant.inventory.availableQuantity < line.quantity)
          throw conflict("INSUFFICIENT_STOCK", "There is not enough stock for a quoted product.");
      }
      const address = await tx.address.findFirst({
        where: { id: quote.addressId, userId, deletedAt: null },
      });
      if (!address)
        throw conflict(
          "ADDRESS_CHANGED",
          "The selected address is unavailable. Create a new quote.",
        );
      const currentAddress = {
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        ward: address.ward,
        district: address.district,
        province: address.province,
        country: address.country,
        postalCode: address.postalCode,
      };
      if (JSON.stringify(currentAddress) !== JSON.stringify(quote.recipientSnapshot))
        throw conflict("ADDRESS_CHANGED", "The selected address changed. Create a new quote.");

      const total = BigInt(quote.total.toString());
      const orderId = randomUUID();
      const publicNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`;
      const order = await tx.marketplaceOrder.create({
        data: {
          id: orderId,
          buyerUserId: userId,
          publicNumber,
          recipientSnapshot: quote.recipientSnapshot as Prisma.InputJsonValue,
          paymentMethod: quote.paymentMethod,
          originalTotal: total.toString(),
          shippingTotal: "0",
          paymentDeadline:
            quote.paymentMethod === "MOCK"
              ? new Date(timeRows[0]!.now.getTime() + 15 * 60_000)
              : null,
          createdAt: timeRows[0]!.now,
          status: "PENDING",
        },
      });
      const grouped = new Map<string, typeof fresh>();
      for (const line of fresh) {
        const group = grouped.get(line.variant.product.shopId) ?? [];
        group.push(line);
        grouped.set(line.variant.product.shopId, group);
      }
      for (const [shopId, shopLines] of [...grouped.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const shop = shopLines[0]!.variant.product.shop;
        const shopTotal = shopLines.reduce(
          (sum, line) => sum + BigInt(line.variant.price.toString()) * BigInt(line.quantity),
          0n,
        );
        const sellerOrder = await tx.sellerOrder.create({
          data: {
            orderId: order.id,
            shopId,
            shopNameSnapshot: shop.name,
            status: "PENDING",
            originalTotal: shopTotal.toString(),
          },
        });
        for (const line of shopLines.sort((a, b) => a.variantId.localeCompare(b.variantId))) {
          const product = line.variant.product;
          const unitPrice = BigInt(line.variant.price.toString());
          const lineTotal = unitPrice * BigInt(line.quantity);
          const stock = line.variant.inventory!;
          const updated = await tx.inventory.updateMany({
            where: { variantId: line.variantId, shopId, availableQuantity: { gte: line.quantity } },
            data: { availableQuantity: { decrement: line.quantity }, version: { increment: 1 } },
          });
          if (!updated.count)
            throw conflict(
              "INSUFFICIENT_STOCK",
              "Stock changed during checkout. Create a new quote.",
            );
          const orderItem = await tx.orderItem.create({
            data: {
              sellerOrderId: sellerOrder.id,
              shopId,
              productId: product.id,
              variantId: line.variantId,
              productNameSnapshot: product.name,
              skuSnapshot: line.variant.skuNormalized,
              attributesSnapshot: line.variant.attributes as Prisma.InputJsonValue,
              imageAssetId: product.images[0]?.assetId ?? null,
              imageKeySnapshot: product.images[0]?.asset.objectKey ?? null,
              unitPrice: unitPrice.toString(),
              quantity: line.quantity,
              lineTotal: lineTotal.toString(),
            },
          });
          await tx.inventoryMovement.create({
            data: {
              inventoryId: line.variantId,
              shopId,
              sellerOrderId: sellerOrder.id,
              orderItemId: orderItem.id,
              actorUserId: userId,
              kind: "SALE",
              effectType: "SALE",
              quantityDelta: -line.quantity,
              quantityAfter: stock.availableQuantity - line.quantity,
              reason: "Checkout",
              operationKey: `sale:${order.id}:${orderItem.id}`,
            },
          });
        }
      }
      await tx.payment.create({ data: { orderId: order.id, method: quote.paymentMethod } });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          actorUserId: userId,
          actorKind: "USER",
          action: "CHECKOUT_CREATED",
          toStatus: "PENDING",
          operationKey: `checkout:${order.id}`,
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id, id: { in: ids } } });
      await tx.cart.update({ where: { id: cart.id }, data: { version: { increment: 1 } } });
      await tx.checkoutQuote.update({
        where: { id: quote.id },
        data: { consumedOrderId: order.id },
      });
      await tx.idempotencyRecord.update({
        where: { id: lockedKey.id },
        data: {
          state: "COMPLETED",
          responseStatus: 201,
          resourceType: "MarketplaceOrder",
          resourceId: order.id,
          responseSummary: { orderId: order.id },
        },
      });
      const created = await tx.marketplaceOrder.findFirstOrThrow({
        where: { id: order.id, buyerUserId: userId },
        include: orderInclude,
      });
      return aggregateOrder(created);
    });
    return result;
  }
}
