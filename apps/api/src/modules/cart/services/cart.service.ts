import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" as const },
    include: {
      variant: {
        include: {
          inventory: true,
          product: {
            include: {
              shop: true,
              category: true,
              images: { orderBy: { position: "asc" as const }, take: 1, include: { asset: true } },
            },
          },
        },
      },
    },
  },
};
type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type CartItemWrite = { variantId: string; quantity: number };
type CartItemPatch = { quantity?: number; selected?: boolean };

@Injectable()
export class CartService {
  constructor(private readonly db: DatabaseService) {}

  private async ensureCart(userId: string, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.db.prisma;
    return client.cart.upsert({
      where: { buyerUserId: userId },
      create: { buyerUserId: userId },
      update: {},
    });
  }

  async get(userId: string) {
    const cart = await this.ensureCart(userId);
    return this.read(cart.id);
  }

  private async read(cartId: string) {
    const cart = (await this.db.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: cartInclude,
    })) as CartRecord;
    const productIds = [...new Set(cart.items.map((item) => item.variant.product.id))];
    const hiddenRows = productIds.length
      ? await this.db.prisma.$queryRaw<Array<{ product_id: string }>>`
          WITH RECURSIVE ancestors(product_id, category_id, parent_id, status) AS (
            SELECT p.id, c.id, c.parent_id, c.status
            FROM products p JOIN categories c ON c.id = p.category_id
            WHERE p.id = ANY(${productIds}::uuid[])
            UNION ALL
            SELECT a.product_id, c.id, c.parent_id, c.status
            FROM ancestors a JOIN categories c ON c.id = a.parent_id
          )
          SELECT DISTINCT product_id FROM ancestors WHERE status = 'HIDDEN'`
      : [];
    const hiddenProducts = new Set(hiddenRows.map((row) => row.product_id));
    const groups = new Map<
      string,
      { shopId: string; shopName: string; items: unknown[]; selectedSubtotal: bigint }
    >();
    for (const line of cart.items) {
      const variant = line.variant;
      const product = variant.product;
      const shopId = product.shopId;
      const quantityOnHand = variant.inventory?.availableQuantity ?? 0;
      const eligibility =
        product.shop.status === "ACTIVE" &&
        product.saleStatus === "ACTIVE" &&
        !product.adminHidden &&
        product.category.status === "VISIBLE" &&
        !hiddenProducts.has(product.id) &&
        variant.saleStatus === "ACTIVE";
      let unavailableReason: string | null = null;
      if (!eligibility) unavailableReason = "PRODUCT_UNAVAILABLE";
      else if (quantityOnHand < line.quantity) unavailableReason = "INSUFFICIENT_STOCK";
      const group = groups.get(shopId) ?? {
        shopId,
        shopName: product.shop.name,
        items: [],
        selectedSubtotal: 0n,
      };
      const price = BigInt(variant.price.toString());
      if (line.selected) group.selectedSubtotal += price * BigInt(line.quantity);
      group.items.push({
        id: line.id,
        variantId: variant.id,
        productId: product.id,
        shopId,
        productName: product.name,
        sku: variant.skuNormalized,
        attributes: variant.attributes,
        image: null,
        currentUnitPrice: price.toString(),
        quantity: line.quantity,
        selected: line.selected,
        availableQuantity: quantityOnHand,
        purchasable: eligibility && quantityOnHand >= line.quantity,
        unavailableReason,
      });
      groups.set(shopId, group);
    }
    const values = [...groups.values()].map((group) => ({
      shopId: group.shopId,
      shopName: group.shopName,
      items: group.items,
      selectedSubtotal: group.selectedSubtotal.toString(),
    }));
    const selectedTotal = values.reduce(
      (total, group) => total + BigInt(group.selectedSubtotal),
      0n,
    );
    return {
      id: cart.id,
      version: cart.version,
      groups: values,
      selectedTotal: selectedTotal.toString(),
      currency: "VND" as const,
      updatedAt: cart.updatedAt,
    };
  }

  async add(userId: string, input: CartItemWrite) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999)
      throw new UnprocessableEntityException({
        code: "INVALID_QUANTITY",
        message: "Quantity must be between 1 and 999.",
      });
    const cart = await this.db.prisma.$transaction(async (tx) => {
      const ownedCart = await this.ensureCart(userId, tx);
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${ownedCart.id}::uuid FOR UPDATE`;
      const variant = await tx.productVariant.findUnique({
        where: { id: input.variantId },
        include: { inventory: true, product: { include: { shop: true, category: true } } },
      });
      if (!variant) throw new NotFoundException();
      const hidden = await tx.$queryRaw<Array<{ hidden: boolean }>>`
        WITH RECURSIVE ancestors(id, parent_id, status) AS (
          SELECT id, parent_id, status FROM categories WHERE id = ${variant.product.categoryId}::uuid
          UNION ALL SELECT c.id, c.parent_id, c.status FROM categories c JOIN ancestors a ON c.id = a.parent_id
        ) SELECT EXISTS (SELECT 1 FROM ancestors WHERE status = 'HIDDEN') AS hidden`;
      if (
        variant.product.shop.status !== "ACTIVE" ||
        variant.product.saleStatus !== "ACTIVE" ||
        variant.product.adminHidden ||
        hidden[0]?.hidden ||
        variant.product.category.status !== "VISIBLE" ||
        variant.saleStatus !== "ACTIVE"
      )
        throw new UnprocessableEntityException({
          code: "PRODUCT_UNAVAILABLE",
          message: "This product is not available.",
        });
      const previous = await tx.cartItem.findUnique({
        where: { cartId_variantId: { cartId: ownedCart.id, variantId: input.variantId } },
      });
      const nextQuantity = (previous?.quantity ?? 0) + input.quantity;
      if (nextQuantity > 999)
        throw new UnprocessableEntityException({
          code: "INVALID_QUANTITY",
          message: "Quantity must be between 1 and 999.",
        });
      if (!variant.inventory || variant.inventory.availableQuantity < nextQuantity)
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_STOCK",
          message: "There is not enough stock for this quantity.",
        });
      if (previous) {
        await tx.cartItem.update({
          where: { id: previous.id },
          data: { quantity: nextQuantity, selected: true, version: { increment: 1 } },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId: ownedCart.id, variantId: input.variantId, quantity: input.quantity },
        });
      }
      return tx.cart.update({ where: { id: ownedCart.id }, data: { version: { increment: 1 } } });
    });
    return this.read(cart.id);
  }

  async patch(userId: string, itemId: string, input: CartItemPatch) {
    if (input.quantity === undefined && input.selected === undefined)
      throw new UnprocessableEntityException({
        code: "EMPTY_UPDATE",
        message: "Provide quantity or selected.",
      });
    if (
      input.quantity !== undefined &&
      (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999)
    )
      throw new UnprocessableEntityException({
        code: "INVALID_QUANTITY",
        message: "Quantity must be between 1 and 999.",
      });
    const cart = await this.db.prisma.$transaction(async (tx) => {
      const ownedCart = await this.ensureCart(userId, tx);
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${ownedCart.id}::uuid FOR UPDATE`;
      const line = await tx.cartItem.findFirst({
        where: { id: itemId, cartId: ownedCart.id },
        include: { variant: { include: { inventory: true } } },
      });
      if (!line) throw new NotFoundException();
      if (
        input.quantity !== undefined &&
        (!line.variant.inventory || line.variant.inventory.availableQuantity < input.quantity)
      )
        throw new UnprocessableEntityException({
          code: "INSUFFICIENT_STOCK",
          message: "There is not enough stock for this quantity.",
        });
      await tx.cartItem.update({
        where: { id: itemId },
        data: { ...input, version: { increment: 1 } },
      });
      return tx.cart.update({ where: { id: ownedCart.id }, data: { version: { increment: 1 } } });
    });
    return this.read(cart.id);
  }

  async remove(userId: string, itemId: string) {
    const cart = await this.db.prisma.$transaction(async (tx) => {
      const ownedCart = await this.ensureCart(userId, tx);
      await tx.$queryRaw`SELECT id FROM carts WHERE id = ${ownedCart.id}::uuid FOR UPDATE`;
      const deleted = await tx.cartItem.deleteMany({ where: { id: itemId, cartId: ownedCart.id } });
      if (!deleted.count) throw new NotFoundException();
      return tx.cart.update({ where: { id: ownedCart.id }, data: { version: { increment: 1 } } });
    });
    await this.read(cart.id);
  }
}
