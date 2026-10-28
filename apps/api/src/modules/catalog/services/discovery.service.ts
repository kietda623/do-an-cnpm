import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../../../database/prisma.service.js";
import {
  DiscoveryRepository,
  type DiscoveryFilters,
} from "../repositories/discovery.repository.js";

@Injectable()
export class DiscoveryService {
  private readonly publicBase: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly repository: DiscoveryRepository,
    config: ConfigService,
  ) {
    this.publicBase = (
      config.get<string>("ASSET_PUBLIC_READ_BASE") ??
      config.get<string>("S3_PUBLIC_READ_BASE") ??
      ""
    ).replace(/\/$/, "");
  }

  async list(input: Partial<DiscoveryFilters>) {
    const filters = this.normalize(input);
    const { items, total } = await this.repository.list(filters);
    if (!items.length)
      return { data: [], meta: { page: filters.page, pageSize: filters.pageSize, total } };

    const products = await this.db.prisma.product.findMany({
      where: { id: { in: items.map((item) => item.id) } },
      include: { images: { include: { asset: true }, orderBy: { position: "asc" } } },
    });
    const ratings = await this.db.prisma.review.groupBy({
      by: ["productId"], where: { productId: { in: items.map((item) => item.id) } },
      _avg: { rating: true }, _count: { _all: true },
    });
    const ratingsById = new Map(ratings.map((rating) => [rating.productId, rating]));
    const byId = new Map(products.map((product) => [product.id, product]));
    return {
      data: items.flatMap((item) => {
        const product = byId.get(item.id);
        if (!product) return [];
        return [
          {
            id: product.id,
            shopId: product.shopId,
            shopName: item.shopName,
            name: product.name,
            image: product.images[0] ? this.asset(product.images[0].asset) : null,
            minimumPrice: item.minimumPrice,
            available: item.available,
            ratingAverage: ratingsById.get(product.id)?._avg.rating?.toString() ?? null,
            ratingCount: ratingsById.get(product.id)?._count._all ?? 0,
            createdAt: item.createdAt.toISOString(),
          },
        ];
      }),
      meta: { page: filters.page, pageSize: filters.pageSize, total },
    };
  }

  async product(id: string) {
    const visibleCategories = await this.db.prisma.$queryRaw<Array<{ id: string }>>`
      WITH RECURSIVE visible AS (
        SELECT id, parent_id FROM categories WHERE status = 'VISIBLE' AND parent_id IS NULL
        UNION ALL SELECT c.id, c.parent_id FROM categories c JOIN visible p ON c.parent_id = p.id WHERE c.status = 'VISIBLE'
      ) SELECT id FROM visible`;
    const product = await this.db.prisma.product.findFirst({
      where: {
        id,
        saleStatus: "ACTIVE",
        adminHidden: false,
        categoryId: { in: visibleCategories.map((category) => category.id) },
        shop: { status: "ACTIVE" },
        variants: { some: { saleStatus: "ACTIVE" } },
      },
      include: {
        category: { select: { id: true, name: true } },
        shop: { select: { id: true, name: true, slugNormalized: true } },
        images: { include: { asset: true }, orderBy: { position: "asc" } },
        variants: {
          where: { saleStatus: "ACTIVE" },
          include: { inventory: true },
          orderBy: [{ price: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!product || !product.variants.length) throw new NotFoundException();
    const rating = await this.db.prisma.review.aggregate({ where: { productId: id }, _avg: { rating: true }, _count: { _all: true } });
    const variants = product.variants.map((variant) => ({
      id: variant.id,
      sku: variant.skuNormalized,
      attributes: variant.attributes,
      price: variant.price.toFixed(0),
      availableQuantity: variant.inventory?.availableQuantity ?? 0,
    }));
    return {
      id: product.id,
      shopId: product.shopId,
      categoryId: product.category.id,
      selling: true,
      name: product.name,
      description: product.description,
      category: product.category,
      shop: { id: product.shop.id, name: product.shop.name, slug: product.shop.slugNormalized },
      images: product.images.map((image) => this.asset(image.asset)),
      minimumPrice: variants[0]!.price,
      variants,
      ratingAverage: rating._avg.rating?.toString() ?? null,
      ratingCount: rating._count._all,
    };
  }

  async shopProducts(shopId: string, input: Partial<DiscoveryFilters>) {
    const shop = await this.db.prisma.shop.findFirst({ where: { id: shopId, status: "ACTIVE" } });
    if (!shop) throw new NotFoundException();
    return this.list({ ...input, shopId });
  }

  private normalize(input: Partial<DiscoveryFilters>): DiscoveryFilters {
    const minPrice = input.minPrice?.trim();
    const maxPrice = input.maxPrice?.trim();
    if (minPrice !== undefined && !/^\d{1,18}$/.test(minPrice))
      throw new BadRequestException({
        code: "INVALID_PRICE_RANGE",
        message: "minPrice must be a non-negative integer amount.",
      });
    if (maxPrice !== undefined && !/^\d{1,18}$/.test(maxPrice))
      throw new BadRequestException({
        code: "INVALID_PRICE_RANGE",
        message: "maxPrice must be a non-negative integer amount.",
      });
    if (minPrice !== undefined && maxPrice !== undefined && BigInt(minPrice) > BigInt(maxPrice))
      throw new BadRequestException({
        code: "INVALID_PRICE_RANGE",
        message: "minPrice must not exceed maxPrice.",
      });
    return {
      q: input.q?.trim() || undefined,
      categoryId: input.categoryId,
      shopId: input.shopId,
      minPrice,
      maxPrice,
      sort: input.sort ?? "NEWEST",
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 20,
    };
  }

  private asset(asset: {
    id: string;
    objectKey: string;
    mimeType: string;
    byteSize: number;
    width: number;
    height: number;
  }) {
    return {
      id: asset.id,
      url: this.publicBase ? `${this.publicBase}/${asset.objectKey}` : asset.objectKey,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
    };
  }
}
