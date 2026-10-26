import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseService } from "../../../database/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";

const slugify = (name: string, id: string) =>
  `${
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 130) || "category"
  }-${id.slice(0, 8)}`;
const canonical = (value: Record<string, unknown>) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, String(v).trim()]),
    ),
  );
const adminProductInclude = {
  images: { include: { asset: true }, orderBy: { position: "asc" as const } },
  variants: { include: { inventory: true }, orderBy: { skuNormalized: "asc" as const } },
} satisfies Prisma.ProductInclude;
type AdminProduct = Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>;

function projectAdminProduct(product: AdminProduct, publicBase: string) {
  const activePrices = product.variants
    .filter((variant) => variant.saleStatus === "ACTIVE")
    .map((variant) => variant.price);
  const minimumPrice = activePrices.length
    ? activePrices.reduce((min, price) => price.lessThan(min) ? price : min)
    : null;
  return {
    id: product.id,
    shopId: product.shopId,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    images: product.images.map(({ asset }) => ({
      id: asset.id,
      url: publicBase ? `${publicBase}/${asset.objectKey}` : asset.objectKey,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
    })),
    selling: product.saleStatus === "ACTIVE",
    adminHidden: product.adminHidden,
    hiddenReason: product.hiddenReason,
    minimumPrice: minimumPrice?.toFixed(0) ?? null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      sku: variant.skuNormalized,
      attributes: variant.attributes,
      price: variant.price.toFixed(0),
      availableQuantity: variant.inventory?.availableQuantity ?? 0,
      selling: variant.saleStatus === "ACTIVE",
      version: variant.version,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    })),
    ratingAverage: null,
    ratingCount: 0,
    version: product.version,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
type CategoryNode = {
  id: string;
  parentId: string | null;
  name: string;
  visible: boolean;
  version: number;
  children: CategoryNode[];
};
@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async adminListProducts(query: {
    q?: string;
    shopId?: string;
    adminHidden?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const q = query.q?.trim();
    const where: Prisma.ProductWhereInput = {
      ...(query.shopId ? { shopId: query.shopId } : {}),
      ...(query.adminHidden !== undefined ? { adminHidden: query.adminHidden } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { shop: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    };
    const { rows, total } = await this.db.prisma.$transaction(async (tx) => {
      const [rows, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: {
            images: { include: { asset: true }, orderBy: { position: "asc" } },
            variants: { include: { inventory: true }, orderBy: { skuNormalized: "asc" } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        tx.product.count({ where }),
      ]);
      return { rows, total };
    }, { isolationLevel: "RepeatableRead" });
    const base = (this.config.get<string>("ASSET_PUBLIC_READ_BASE") ?? this.config.get<string>("S3_PUBLIC_READ_BASE") ?? "").replace(/\/$/, "");
    const data = rows.map((product) => projectAdminProduct(product, base));
    return { data, meta: { page, pageSize, total } };
  }

  async hideProductByAdmin(
    actorUserId: string,
    productId: string,
    key: string,
    input: { reason: string; expectedVersion: number },
    requestId?: string,
  ) {
    const operation = "POST:/admin/products/{id}/hide";
    const reason = input.reason.trim();
    if (!reason)
      throw new BadRequestException({ code: "REASON_REQUIRED", message: "A reason is required." });
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ productId, reason, expectedVersion: input.expectedVersion }))
      .digest("hex");
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO idempotency_records
          (actor_user_id, actor_scope, operation, idempotency_key, request_hash, state)
        VALUES (${actorUserId}::uuid, ${actorUserId}, ${operation}, ${key}, ${requestHash}, 'IN_PROGRESS')
        ON CONFLICT (actor_scope, operation, idempotency_key) DO NOTHING`;
      const idem = await tx.idempotencyRecord.findUniqueOrThrow({
        where: { actorScope_operation_idempotencyKey: { actorScope: actorUserId, operation, idempotencyKey: key } },
      });
      await tx.$queryRaw`SELECT id FROM idempotency_records WHERE id = ${idem.id}::uuid FOR UPDATE`;
      const lockedIdem = await tx.idempotencyRecord.findUniqueOrThrow({ where: { id: idem.id } });
      if (lockedIdem.requestHash !== requestHash)
        throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "This key was already used for a different request." });
      if (lockedIdem.state === "COMPLETED" && lockedIdem.responseSummary)
        return lockedIdem.responseSummary;

      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const current = await tx.product.findUnique({ where: { id: productId } });
      if (!current) throw new NotFoundException();
      if (current.version !== input.expectedVersion)
        throw new ConflictException({ code: "VERSION_CONFLICT", message: "Product changed. Reload before moderating." });
      if (current.adminHidden)
        throw new ConflictException({ code: "PRODUCT_ALREADY_HIDDEN", message: "Product is already hidden." });
      const now = new Date();
      const changed = await tx.product.updateMany({
        where: { id: productId, version: input.expectedVersion, adminHidden: false },
        data: { adminHidden: true, hiddenReason: reason, version: { increment: 1 }, updatedAt: now },
      });
      if (changed.count !== 1)
        throw new ConflictException({ code: "VERSION_CONFLICT", message: "Product changed. Reload before moderating." });
      const result = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: adminProductInclude });
      await tx.auditEvent.create({
        data: {
          actorUserId,
          actorKind: "USER",
          action: "product.hidden",
          targetType: "Product",
          targetId: productId,
          reason,
          outcome: "SUCCESS",
          requestId: requestId ?? randomUUID(),
          safeMetadata: { shopId: result.shopId, version: result.version },
        },
      });
      const base = (this.config.get<string>("ASSET_PUBLIC_READ_BASE") ?? this.config.get<string>("S3_PUBLIC_READ_BASE") ?? "").replace(/\/$/, "");
      const response = projectAdminProduct(result, base);
      await tx.idempotencyRecord.update({
        where: { id: idem.id },
        data: {
          state: "COMPLETED",
          responseStatus: 200,
          resourceType: "Product",
          resourceId: productId,
          responseSummary: response as unknown as Prisma.InputJsonValue,
        },
      });
      return response;
    });
  }
  async categories(parentId?: string, tree = false) {
    const rows = await this.db.prisma.$queryRaw<
      Array<{ id: string; parentId: string | null; name: string; version: number }>
    >`
      WITH RECURSIVE visible AS (
        SELECT c.id,c.parent_id,c.name,c.version FROM categories c WHERE c.status='VISIBLE' AND c.parent_id IS NULL
        UNION ALL SELECT c.id,c.parent_id,c.name,c.version FROM categories c JOIN visible p ON p.id=c.parent_id WHERE c.status='VISIBLE'
      ) SELECT id, parent_id AS "parentId", name, version FROM visible
      WHERE (${parentId ?? null}::uuid IS NULL OR parent_id=${parentId ?? null}::uuid) ORDER BY name,id`;
    if (!tree) return rows.map((r) => ({ ...r, visible: true }));
    const nodes = new Map(
      rows.map((r) => [r.id, { ...r, visible: true, children: [] as unknown[] }]),
    );
    const roots: unknown[] = [];
    for (const node of nodes.values()) {
      if (node.parentId) nodes.get(node.parentId)?.children.push(node);
      else roots.push(node);
    }
    return roots;
  }
  async adminCategories() {
    const rows = await this.db.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { name: "asc" }, { id: "asc" }],
    });
    const nodes = new Map<string, CategoryNode>(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          parentId: row.parentId,
          name: row.name,
          visible: row.status === "VISIBLE",
          version: row.version,
          children: [],
        },
      ]),
    );
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId) {
        nodes.get(node.parentId)?.children.push(node);
      } else roots.push(node);
    }
    return roots;
  }
  async createCategory(
    userId: string,
    input: { name: string; parentId?: string | null; visible: boolean },
  ) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78123901)`;
      if (input.parentId) {
        const parent = await tx.category.findUnique({ where: { id: input.parentId } });
        if (!parent || parent.status !== "VISIBLE")
          throw new UnprocessableEntityException({
            code: "INVALID_CATEGORY_PARENT",
            message: "Parent category must be visible.",
          });
      }
      const id = randomUUID();
      const category = await tx.category.create({
        data: {
          id,
          name: input.name.trim(),
          slug: slugify(input.name, id),
          parentId: input.parentId ?? null,
          status: input.visible ? "VISIBLE" : "HIDDEN",
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          actorKind: "USER",
          action: "category.created",
          targetType: "Category",
          targetId: category.id,
          outcome: "SUCCESS",
          requestId: randomUUID(),
          safeMetadata: { visible: input.visible, parentId: input.parentId ?? null },
        },
      });
      return this.categoryProjection(category);
    });
  }
  async patchCategory(
    userId: string,
    id: string,
    input: { name?: string; parentId?: string | null; visible?: boolean; expectedVersion: number },
  ) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78123901)`;
      const current = await tx.category.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      if (current.version !== input.expectedVersion)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Category changed. Reload and try again.",
        });
      if (input.parentId !== undefined) {
        if (input.parentId === id)
          throw new ConflictException({
            code: "CATEGORY_CYCLE",
            message: "A category cannot be its own parent.",
          });
        if (input.parentId) {
          const found = await tx.$queryRaw<
            Array<{ id: string }>
          >`WITH RECURSIVE descendants AS (SELECT id FROM categories WHERE parent_id=${id}::uuid UNION ALL SELECT c.id FROM categories c JOIN descendants d ON c.parent_id=d.id) SELECT id FROM descendants WHERE id=${input.parentId}::uuid`;
          if (found.length)
            throw new ConflictException({
              code: "CATEGORY_CYCLE",
              message: "Category parent would create a cycle.",
            });
          const parent = await tx.category.findUnique({ where: { id: input.parentId } });
          if (!parent || parent.status !== "VISIBLE")
            throw new UnprocessableEntityException({
              code: "INVALID_CATEGORY_PARENT",
              message: "Parent category must be visible.",
            });
        }
      }
      const updated = await tx.category.updateMany({
        where: { id, version: input.expectedVersion },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.visible !== undefined ? { status: input.visible ? "VISIBLE" : "HIDDEN" } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Category changed. Reload and try again.",
        });
      const category = await tx.category.findUniqueOrThrow({ where: { id } });
      await tx.auditEvent.create({
        data: {
          actorUserId: userId,
          actorKind: "USER",
          action: "category.updated",
          targetType: "Category",
          targetId: id,
          outcome: "SUCCESS",
          requestId: randomUUID(),
          safeMetadata: {
            version: category.version,
            visible: category.status === "VISIBLE",
            parentId: category.parentId,
          },
        },
      });
      return this.categoryProjection(category);
    });
  }
  private categoryProjection(row: {
    id: string;
    parentId: string | null;
    name: string;
    status: string;
    version: number;
  }) {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      visible: row.status === "VISIBLE",
      version: row.version,
    };
  }
  async createProduct(
    userId: string,
    shopId: string,
    input: {
      name: string;
      description: string;
      categoryId: string;
      imageAssetIds: string[];
      selling: boolean;
      variants: Array<{
        sku: string;
        attributes: Record<string, unknown>;
        price: string;
        stock: number;
        selling: boolean;
      }>;
    },
  ) {
    return this.db.prisma.$transaction(async (tx) => {
      await this.requireShop(tx, userId, shopId);
      const category = await tx.category.findUnique({ where: { id: input.categoryId } });
      if (!category || category.status !== "VISIBLE")
        throw new UnprocessableEntityException({
          code: "CATEGORY_UNAVAILABLE",
          message: "Choose a visible category.",
        });
      const parentCheck = await tx.$queryRaw<
        Array<{ ok: boolean }>
      >`WITH RECURSIVE ancestors AS (SELECT id,parent_id,status FROM categories WHERE id=${input.categoryId}::uuid UNION ALL SELECT c.id,c.parent_id,c.status FROM categories c JOIN ancestors a ON c.id=a.parent_id) SELECT bool_and(status='VISIBLE') AS ok FROM ancestors`;
      if (!parentCheck[0]?.ok)
        throw new UnprocessableEntityException({
          code: "CATEGORY_UNAVAILABLE",
          message: "Category is under a hidden parent.",
        });
      const assets = await tx.asset.findMany({
        where: {
          id: { in: input.imageAssetIds },
          purpose: "PRODUCT_IMAGE",
          status: "VERIFIED",
          shopId,
          uploaderUserId: userId,
        },
      });
      if (
        assets.length !== input.imageAssetIds.length ||
        new Set(input.imageAssetIds).size !== input.imageAssetIds.length
      )
        throw new UnprocessableEntityException({
          code: "INVALID_PRODUCT_IMAGE",
          message: "Use verified images uploaded for this shop.",
        });
      if (!input.variants.length)
        throw new UnprocessableEntityException({
          code: "VARIANT_REQUIRED",
          message: "Add at least one variant.",
        });
      const skuSet = new Set<string>(),
        attributeSet = new Set<string>();
      const variants = input.variants.map((v) => {
        const sku = v.sku.trim().toUpperCase(),
          key = canonical(v.attributes);
        if (skuSet.has(sku) || attributeSet.has(key))
          throw new ConflictException({
            code: "DUPLICATE_VARIANT",
            message: "Variant SKU or attributes are duplicated.",
          });
        skuSet.add(sku);
        attributeSet.add(key);
        if (!/^\d+$/.test(v.price) || BigInt(v.price) <= 0n)
          throw new UnprocessableEntityException({
            code: "INVALID_PRICE",
            message: "Price must be a positive integer VND string.",
          });
        return {
          sku,
          key,
          attrs: Object.fromEntries(
            Object.entries(v.attributes).map(([k, x]) => [k, String(x).trim()]),
          ),
          price: v.price,
          stock: v.stock,
          status: v.selling ? ("ACTIVE" as const) : ("DISCONTINUED" as const),
        };
      });
      if (
        input.selling &&
        (!input.imageAssetIds.length || !variants.some((v) => v.status === "ACTIVE"))
      )
        throw new UnprocessableEntityException({
          code: "PRODUCT_NOT_PUBLISHABLE",
          message: "A published product needs at least one image and one active variant.",
        });
      try {
        const product = await tx.product.create({
          data: {
            shopId,
            categoryId: input.categoryId,
            name: input.name.trim(),
            description: input.description.trim(),
            saleStatus: input.selling ? "ACTIVE" : "DRAFT",
            images: {
              create: input.imageAssetIds.map((assetId, position) => ({ assetId, position })),
            },
          },
        });
        for (const variant of variants) {
          const created = await tx.productVariant.create({
            data: {
              productId: product.id,
              shopId,
              skuNormalized: variant.sku,
              attributes: variant.attrs,
              attributesKey: variant.key,
              price: variant.price,
              saleStatus: variant.status,
            },
          });
          await tx.inventory.create({
            data: { variantId: created.id, shopId, availableQuantity: variant.stock },
          });
          if (variant.stock > 0)
            await tx.inventoryMovement.create({
              data: {
                inventoryId: created.id,
                shopId,
                actorUserId: userId,
                kind: "INITIAL",
                quantityDelta: variant.stock,
                quantityAfter: variant.stock,
                reason: "Opening stock",
                operationKey: `initial:${randomUUID()}`,
              },
            });
        }
        return this.productProjection(
          await tx.product.findUniqueOrThrow({
            where: { id: product.id },
            include: {
              images: { include: { asset: true }, orderBy: { position: "asc" } },
              variants: { include: { inventory: true }, orderBy: { skuNormalized: "asc" } },
            },
          }),
        );
      } catch (error) {
        if ((error as { code?: string })?.code === "P2002")
          throw new ConflictException({
            code: "DUPLICATE_VARIANT",
            message: "SKU or variant attributes already exist in this shop.",
          });
        throw error;
      }
    });
  }
  private async requireShop(tx: Prisma.TransactionClient, userId: string, shopId: string) {
    const member = await tx.shopMember.findFirst({
      where: { shopId, userId, status: "ACTIVE", shop: { status: "ACTIVE" } },
    });
    if (!member) throw new NotFoundException();
    return member;
  }
  async listManagement(userId: string, shopId: string) {
    await this.requireShop(this.db.prisma, userId, shopId);
    const rows = await this.db.prisma.product.findMany({
      where: { shopId },
      include: {
        images: { include: { asset: true }, orderBy: { position: "asc" } },
        variants: { include: { inventory: true }, orderBy: { skuNormalized: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((p) => this.productProjection(p));
  }
  async getManagement(userId: string, shopId: string, id: string) {
    await this.requireShop(this.db.prisma, userId, shopId);
    const p = await this.db.prisma.product.findFirst({
      where: { id, shopId },
      include: {
        images: { include: { asset: true }, orderBy: { position: "asc" } },
        variants: { include: { inventory: true }, orderBy: { skuNormalized: "asc" } },
      },
    });
    if (!p) throw new NotFoundException();
    return this.productProjection(p);
  }
  async patchProduct(
    userId: string,
    shopId: string,
    id: string,
    input: {
      name?: string;
      description?: string;
      categoryId?: string;
      imageAssetIds?: string[];
      selling?: boolean;
      expectedVersion: number;
    },
  ) {
    await this.requireShop(this.db.prisma, userId, shopId);
    await this.db.prisma.$transaction(async (tx) => {
      const current = await tx.product.findFirst({ where: { id, shopId } });
      if (!current) throw new NotFoundException();
      if (current.version !== input.expectedVersion)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Product changed. Reload before saving.",
        });
      if (input.categoryId) {
        const allowed = await tx.$queryRaw<
          Array<{ ok: boolean }>
        >`WITH RECURSIVE ancestors AS (SELECT id,parent_id,status FROM categories WHERE id=${input.categoryId}::uuid UNION ALL SELECT c.id,c.parent_id,c.status FROM categories c JOIN ancestors a ON c.id=a.parent_id) SELECT bool_and(status='VISIBLE') AS ok FROM ancestors`;
        if (!allowed[0]?.ok)
          throw new UnprocessableEntityException({
            code: "CATEGORY_UNAVAILABLE",
            message: "Choose a visible category outside hidden branches.",
          });
      }
      if (input.imageAssetIds) {
        const assets = await tx.asset.findMany({
          where: {
            id: { in: input.imageAssetIds },
            uploaderUserId: userId,
            shopId,
            purpose: "PRODUCT_IMAGE",
            status: "VERIFIED",
          },
        });
        if (
          !input.imageAssetIds.length ||
          new Set(input.imageAssetIds).size !== input.imageAssetIds.length ||
          assets.length !== input.imageAssetIds.length
        )
          throw new UnprocessableEntityException({
            code: "INVALID_PRODUCT_IMAGE",
            message: "Use verified images uploaded for this shop.",
          });
      }
      const hasImage = input.imageAssetIds
        ? input.imageAssetIds.length > 0
        : (await tx.productImage.count({ where: { productId: id } })) > 0;
      const hasActiveVariant =
        (await tx.productVariant.count({
          where: { productId: id, shopId, saleStatus: "ACTIVE" },
        })) > 0;
      if (input.selling && (!hasImage || !hasActiveVariant))
        throw new UnprocessableEntityException({
          code: "PRODUCT_NOT_PUBLISHABLE",
          message: "A published product needs an image and an active variant.",
        });
      const res = await tx.product.updateMany({
        where: { id, shopId, version: input.expectedVersion },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.selling !== undefined
            ? {
                saleStatus: input.selling
                  ? "ACTIVE"
                  : current.saleStatus === "DRAFT"
                    ? "DRAFT"
                    : "DISCONTINUED",
              }
            : {}),
          version: { increment: 1 },
        },
      });
      if (!res.count)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Product changed. Reload before saving.",
        });
      if (input.imageAssetIds) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: input.imageAssetIds.map((assetId, position) => ({
            productId: id,
            assetId,
            position,
          })),
        });
      }
    });
    return this.getManagement(userId, shopId, id);
  }
  private productProjection(p: {
    id: string;
    shopId: string;
    categoryId: string;
    name: string;
    description: string;
    saleStatus: string;
    adminHidden: boolean;
    hiddenReason: string | null;
    version: number;
    images: Array<{
      asset: {
        id: string;
        objectKey: string;
        mimeType: string;
        byteSize: number;
        width: number;
        height: number;
      };
    }>;
    variants: Array<{
      id: string;
      skuNormalized: string;
      attributes: Prisma.JsonValue;
      price: Prisma.Decimal;
      saleStatus: string;
      version: number;
      inventory: { availableQuantity: number; version: number } | null;
    }>;
  }) {
    return {
      id: p.id,
      shopId: p.shopId,
      categoryId: p.categoryId,
      name: p.name,
      description: p.description,
      selling: p.saleStatus === "ACTIVE",
      adminHidden: p.adminHidden,
      hiddenReason: p.hiddenReason,
      version: p.version,
      images: p.images.map((i) => ({
        assetId: i.asset.id,
        objectKey: i.asset.objectKey,
        mimeType: i.asset.mimeType,
        byteSize: i.asset.byteSize,
        width: i.asset.width,
        height: i.asset.height,
      })),
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.skuNormalized,
        attributes: v.attributes,
        price: v.price.toFixed(0),
        selling: v.saleStatus === "ACTIVE",
        version: v.version,
        availableQuantity: v.inventory?.availableQuantity ?? 0,
        inventoryVersion: v.inventory?.version ?? 0,
      })),
    };
  }
  async createVariant(
    userId: string,
    shopId: string,
    productId: string,
    input: {
      sku: string;
      attributes: Record<string, unknown>;
      price: string;
      stock: number;
      selling: boolean;
    },
  ) {
    await this.requireShop(this.db.prisma, userId, shopId);
    const product = await this.db.prisma.product.findFirst({ where: { id: productId, shopId } });
    if (!product) throw new NotFoundException();
    if (!/^\d+$/.test(input.price) || BigInt(input.price) <= 0n)
      throw new UnprocessableEntityException({
        code: "INVALID_PRICE",
        message: "Price must be a positive integer VND string.",
      });
    const attrs = Object.fromEntries(
      Object.entries(input.attributes).map(([k, v]) => [k, String(v).trim()]),
    );
    const key = canonical(attrs);
    try {
      return await this.db.prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.create({
          data: {
            productId,
            shopId,
            skuNormalized: input.sku.trim().toUpperCase(),
            attributes: attrs,
            attributesKey: key,
            price: input.price,
            saleStatus: input.selling ? "ACTIVE" : "DISCONTINUED",
          },
        });
        await tx.inventory.create({
          data: { variantId: variant.id, shopId, availableQuantity: input.stock },
        });
        if (input.stock > 0)
          await tx.inventoryMovement.create({
            data: {
              inventoryId: variant.id,
              shopId,
              actorUserId: userId,
              kind: "INITIAL",
              quantityDelta: input.stock,
              quantityAfter: input.stock,
              reason: "Opening stock",
              operationKey: `initial:${randomUUID()}`,
            },
          });
        return {
          id: variant.id,
          sku: variant.skuNormalized,
          attributes: variant.attributes,
          price: variant.price.toFixed(0),
          selling: variant.saleStatus === "ACTIVE",
          availableQuantity: input.stock,
          version: variant.version,
        };
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002")
        throw new ConflictException({
          code: "DUPLICATE_VARIANT",
          message: "SKU or attributes already exist.",
        });
      throw error;
    }
  }
  async patchVariant(
    userId: string,
    shopId: string,
    id: string,
    input: {
      sku?: string;
      attributes?: Record<string, unknown>;
      price?: string;
      selling?: boolean;
      expectedVersion: number;
    },
  ) {
    await this.requireShop(this.db.prisma, userId, shopId);
    const v = await this.db.prisma.productVariant.findFirst({ where: { id, shopId } });
    if (!v) throw new NotFoundException();
    if (v.version !== input.expectedVersion)
      throw new ConflictException({
        code: "VERSION_CONFLICT",
        message: "Variant changed. Reload before saving.",
      });
    if (input.price !== undefined && (!/^\d+$/.test(input.price) || BigInt(input.price) <= 0n))
      throw new UnprocessableEntityException({
        code: "INVALID_PRICE",
        message: "Price must be a positive integer VND string.",
      });
    const attrs = input.attributes
      ? Object.fromEntries(Object.entries(input.attributes).map(([k, x]) => [k, String(x).trim()]))
      : undefined;
    try {
      const u = await this.db.prisma.productVariant.updateMany({
        where: { id, shopId, version: input.expectedVersion },
        data: {
          ...(input.sku ? { skuNormalized: input.sku.trim().toUpperCase() } : {}),
          ...(attrs ? { attributes: attrs, attributesKey: canonical(attrs) } : {}),
          ...(input.price ? { price: input.price } : {}),
          ...(input.selling !== undefined
            ? { saleStatus: input.selling ? "ACTIVE" : "DISCONTINUED" }
            : {}),
          version: { increment: 1 },
        },
      });
      if (!u.count)
        throw new ConflictException({
          code: "VERSION_CONFLICT",
          message: "Variant changed. Reload before saving.",
        });
      return this.db.prisma.productVariant.findUniqueOrThrow({ where: { id } });
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002")
        throw new ConflictException({
          code: "DUPLICATE_VARIANT",
          message: "SKU or attributes already exist.",
        });
      throw e;
    }
  }
  async publicProduct(id: string) {
    const eligible = await this.db.prisma.$queryRaw<
      Array<{ id: string }>
    >`WITH RECURSIVE visible AS (SELECT id,parent_id FROM categories WHERE status='VISIBLE' AND parent_id IS NULL UNION ALL SELECT c.id,c.parent_id FROM categories c JOIN visible p ON p.id=c.parent_id WHERE c.status='VISIBLE') SELECT id FROM visible`;
    const p = await this.db.prisma.product.findFirst({
      where: {
        id,
        saleStatus: "ACTIVE",
        adminHidden: false,
        categoryId: { in: eligible.map((x) => x.id) },
        shop: { status: "ACTIVE" },
      },
      include: {
        category: true,
        shop: { select: { id: true, name: true, slugNormalized: true } },
        images: { include: { asset: true }, orderBy: { position: "asc" } },
        variants: {
          where: { saleStatus: "ACTIVE" },
          include: { inventory: true },
          orderBy: [{ price: "asc" }, { id: "asc" }],
        },
      },
    });
    if (!p || !p.variants.length) throw new NotFoundException();
    const variants = p.variants.map((v) => ({
      id: v.id,
      sku: v.skuNormalized,
      attributes: v.attributes,
      price: v.price.toFixed(0),
      availableQuantity: v.inventory?.availableQuantity ?? 0,
    }));
    return {
      id: p.id,
      shopId: p.shopId,
      name: p.name,
      description: p.description,
      category: { id: p.category.id, name: p.category.name },
      shop: { id: p.shop.id, name: p.shop.name, slug: p.shop.slugNormalized },
      images: p.images.map((i) => ({ assetId: i.assetId, objectKey: i.asset.objectKey })),
      minimumPrice: variants[0]!.price,
      variants,
    };
  }
  async publicProducts() {
    const eligible = await this.db.prisma.$queryRaw<
      Array<{ id: string }>
    >`WITH RECURSIVE visible AS (SELECT id,parent_id FROM categories WHERE status='VISIBLE' AND parent_id IS NULL UNION ALL SELECT c.id,c.parent_id FROM categories c JOIN visible p ON p.id=c.parent_id WHERE c.status='VISIBLE') SELECT id FROM visible`;
    const rows = await this.db.prisma.product.findMany({
      where: {
        saleStatus: "ACTIVE",
        adminHidden: false,
        shop: { status: "ACTIVE" },
        categoryId: { in: eligible.map((x) => x.id) },
        variants: { some: { saleStatus: "ACTIVE" } },
      },
      include: {
        shop: { select: { id: true, name: true } },
        images: { include: { asset: true }, orderBy: { position: "asc" } },
        variants: {
          where: { saleStatus: "ACTIVE" },
          include: { inventory: true },
          orderBy: [{ price: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      shopId: p.shopId,
      name: p.name,
      shop: p.shop,
      images: p.images.map((i) => ({ assetId: i.assetId, objectKey: i.asset.objectKey })),
      minimumPrice: p.variants[0]?.price.toFixed(0) ?? "0",
      variants: p.variants.map((v) => ({
        id: v.id,
        sku: v.skuNormalized,
        attributes: v.attributes,
        price: v.price.toFixed(0),
        availableQuantity: v.inventory?.availableQuantity ?? 0,
      })),
    }));
  }
}
