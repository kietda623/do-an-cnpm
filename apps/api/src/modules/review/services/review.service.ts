import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { assertCanReadExistingShopData } from "../../../common/auth/fulfillment-access.js";
import { DatabaseService } from "../../../database/prisma.service.js";
import { DiscoveryService } from "../../catalog/services/discovery.service.js";

type ReviewQuery = {
  rating?: number;
  productId?: string;
  page?: number;
  pageSize?: number;
};

@Injectable()
export class ReviewService {
  constructor(
    private readonly db: DatabaseService,
    private readonly discovery: DiscoveryService,
  ) {}

  async create(
    userId: string,
    input: { orderItemId: string; rating: number; comment: string },
  ) {
    try {
      return await this.db.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const buyer = await tx.user.findFirst({
          where: { id: userId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!buyer) throw new UnauthorizedException();
        const identity = await tx.orderItem.findFirst({
          where: {
            id: input.orderItemId,
            sellerOrder: { order: { buyerUserId: userId } },
          },
          select: {
            sellerOrderId: true,
            sellerOrder: { select: { orderId: true } },
          },
        });
        if (!identity) throw new NotFoundException();
        await tx.$queryRaw`SELECT id FROM marketplace_orders WHERE id = ${identity.sellerOrder.orderId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM seller_orders WHERE id = ${identity.sellerOrderId}::uuid FOR UPDATE`;
        const item = await tx.orderItem.findFirst({
          where: {
            id: input.orderItemId,
            sellerOrder: { order: { buyerUserId: userId } },
          },
          include: { sellerOrder: true, review: true },
        });
        if (!item) throw new NotFoundException();
        if (item.sellerOrder.status !== "COMPLETED")
          throw new UnprocessableEntityException({
            code: "REVIEW_NOT_ELIGIBLE",
          });
        if (item.review)
          throw new ConflictException({ code: "REVIEW_ALREADY_EXISTS" });
        const review = await tx.review.create({
          data: {
            buyerUserId: userId,
            orderItemId: item.id,
            productId: item.productId,
            rating: input.rating,
            comment: input.comment.trim(),
          },
          include: {
            buyer: { select: { displayName: true } },
            orderItem: { select: { shopId: true } },
          },
        });
        return this.project(review);
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      )
        throw new ConflictException({ code: "REVIEW_ALREADY_EXISTS" });
      throw error;
    }
  }

  async publicList(productId: string, query: ReviewQuery) {
    await this.discovery.product(productId);
    return this.list({ ...query, productId });
  }

  async shopList(userId: string, shopId: string, query: ReviewQuery) {
    await assertCanReadExistingShopData(this.db.prisma, userId, shopId);
    if (
      query.productId &&
      !(await this.db.prisma.product.findFirst({
        where: { id: query.productId, shopId },
        select: { id: true },
      }))
    )
      throw new NotFoundException();
    return this.list(query, shopId);
  }

  private async list(query: ReviewQuery, shopId?: string) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.rating ? { rating: query.rating } : {}),
      ...(shopId ? { orderItem: { shopId } } : {}),
    };
    const [rows, total] = await this.db.prisma.$transaction([
      this.db.prisma.review.findMany({
        where,
        include: {
          buyer: { select: { displayName: true } },
          orderItem: { select: { shopId: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.prisma.review.count({ where }),
    ]);
    return {
      data: rows.map((row) => this.project(row)),
      meta: { page, pageSize, total },
    };
  }

  private project(review: {
    id: string;
    productId: string;
    orderItemId: string;
    rating: number;
    comment: string;
    createdAt: Date;
    buyer: { displayName: string };
    orderItem: { shopId: string };
  }) {
    return {
      id: review.id,
      productId: review.productId,
      shopId: review.orderItem.shopId,
      orderItemId: review.orderItemId,
      buyerDisplayName: review.buyer.displayName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
