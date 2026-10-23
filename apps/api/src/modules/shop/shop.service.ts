import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../database/prisma.service.js";
import type { Prisma } from "../../generated/prisma/client.js";

type ShopWrite = {
  name: string;
  slug: string;
  description: string;
  logoAssetId: string;
  contactAddress: string;
  phone: string;
};
type ShopPatch = Partial<ShopWrite> & {
  bannerAssetId?: string | null;
  expectedVersion: number;
};
type ShopWithAssets = Prisma.ShopGetPayload<{ include: { logo: true; banner: true } }>;
type ShopStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

@Injectable()
export class ShopService {
  private readonly publicBase: string;

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    this.publicBase = (
      config.get<string>("ASSET_PUBLIC_READ_BASE") ??
      config.get<string>("S3_PUBLIC_READ_BASE") ??
      ""
    ).replace(/\/$/, "");
  }

  async memberships(userId: string) {
    const rows = await this.db.prisma.shopMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { shop: true },
      orderBy: [{ createdAt: "asc" }, { shopId: "asc" }],
    });
    return rows.map(({ shop, role }) => ({
      shopId: shop.id,
      shopName: shop.name,
      shopStatus: shop.status,
      role,
    }));
  }

  async create(userId: string, input: ShopWrite) {
    try {
      return await this.db.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM assets WHERE id = ${input.logoAssetId}::uuid FOR UPDATE`;
        const logo = await tx.asset.findFirst({
          where: {
            id: input.logoAssetId,
            uploaderUserId: userId,
            purpose: "SHOP_LOGO",
            status: "VERIFIED",
            shopId: null,
          },
        });
        if (!logo) throw this.assetNotFound();

        const shop = await tx.shop.create({
          data: {
            ownerUserId: userId,
            name: input.name.trim(),
            slugNormalized: input.slug.trim().toLowerCase(),
            description: input.description.trim(),
            logoAssetId: logo.id,
            contactAddress: input.contactAddress.trim(),
            phone: input.phone.trim(),
          },
        });
        await tx.shopMember.create({
          data: { shopId: shop.id, userId, role: "OWNER", status: "ACTIVE" },
        });
        await tx.asset.update({
          where: { id: logo.id },
          data: { shopId: shop.id, attachedAt: new Date() },
        });
        await this.audit(tx, userId, shop.id, "shop.created");
        return this.managementProjection(
          await tx.shop.findUniqueOrThrow({
            where: { id: shop.id },
            include: { logo: true, banner: true },
          }),
        );
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException({
          code: "SHOP_SLUG_TAKEN",
          message: "That shop slug is already in use.",
        });
      }
      throw error;
    }
  }

  async publicShop(id: string) {
    const shop = await this.db.prisma.shop.findFirst({
      where: { id, status: "ACTIVE" },
      include: { logo: true, banner: true },
    });
    if (!shop) throw new NotFoundException();
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slugNormalized,
      description: shop.description,
      logo: this.assetProjection(shop.logo),
      banner: shop.banner ? this.assetProjection(shop.banner) : null,
    };
  }

  async management(userId: string, id: string) {
    const shop = await this.managedShop(this.db.prisma, userId, id);
    return this.managementProjection(shop);
  }

  async patch(userId: string, id: string, input: ShopPatch) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shops WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.managedShop(tx, userId, id);
      this.assertVersion(current.version, input.expectedVersion);
      if (
        input.slug !== undefined &&
        current.approvedAt &&
        input.slug.trim().toLowerCase() !== current.slugNormalized
      ) {
        throw new ConflictException({
          code: "APPROVED_SLUG_IMMUTABLE",
          message: "An approved shop slug cannot change.",
        });
      }

      const data: Record<string, unknown> = { version: { increment: 1 } };
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.slug !== undefined) data.slugNormalized = input.slug.trim().toLowerCase();
      if (input.description !== undefined) data.description = input.description.trim();
      if (input.contactAddress !== undefined) data.contactAddress = input.contactAddress.trim();
      if (input.phone !== undefined) data.phone = input.phone.trim();

      if (input.logoAssetId !== undefined) {
        const logo = await this.lockOwnedAsset(tx, userId, id, input.logoAssetId, "SHOP_LOGO");
        data.logoAssetId = logo.id;
      }
      if (input.bannerAssetId !== undefined) {
        if (input.bannerAssetId === null) data.bannerAssetId = null;
        else {
          const banner = await this.lockOwnedAsset(
            tx,
            userId,
            id,
            input.bannerAssetId,
            "SHOP_BANNER",
          );
          data.bannerAssetId = banner.id;
        }
      }

      const updated = await tx.shop.update({ where: { id }, data: data as never });
      for (const assetId of [input.logoAssetId, input.bannerAssetId]) {
        if (assetId) {
          await tx.asset.updateMany({
            where: { id: assetId, shopId: null },
            data: { shopId: id, attachedAt: new Date() },
          });
        }
      }
      await this.audit(tx, userId, id, "shop.updated");
      return this.managementProjection(
        await tx.shop.findUniqueOrThrow({
          where: { id: updated.id },
          include: { logo: true, banner: true },
        }),
      );
    });
  }

  async resubmit(userId: string, id: string, expectedVersion: number) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shops WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await this.managedShop(tx, userId, id);
      this.assertVersion(current.version, expectedVersion);
      if (current.status !== "REJECTED") {
        throw new ConflictException({
          code: "INVALID_SHOP_STATE",
          message: "Only rejected shops can be resubmitted.",
        });
      }
      const updated = await tx.shop.update({
        where: { id },
        data: { status: "PENDING", decisionReason: null, version: { increment: 1 } },
      });
      await this.audit(tx, userId, id, "shop.resubmitted");
      return this.managementProjection(
        await tx.shop.findUniqueOrThrow({
          where: { id: updated.id },
          include: { logo: true, banner: true },
        }),
      );
    });
  }

  async adminList(query: { status?: ShopStatus; page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await Promise.all([
      this.db.prisma.shop.findMany({
        where,
        include: { logo: true, banner: true },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.prisma.shop.count({ where }),
    ]);
    return {
      data: rows.map((shop) => this.managementProjection(shop)),
      meta: { page, pageSize, total },
    };
  }

  async moderate(
    adminId: string,
    id: string,
    action: "approve" | "reject" | "suspend" | "resume",
    input: { expectedVersion: number; reason?: string },
  ) {
    return this.db.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM shops WHERE id = ${id}::uuid FOR UPDATE`;
      const shop = await tx.shop.findUnique({
        where: { id },
        include: { logo: true, banner: true },
      });
      if (!shop) throw new NotFoundException();
      this.assertVersion(shop.version, input.expectedVersion);

      const fromTo = {
        approve: { from: "PENDING", to: "ACTIVE", audit: "shop.approved" },
        reject: { from: "PENDING", to: "REJECTED", audit: "shop.rejected" },
        suspend: { from: "ACTIVE", to: "SUSPENDED", audit: "shop.suspended" },
        resume: { from: "SUSPENDED", to: "ACTIVE", audit: "shop.resumed" },
      } as const;
      const transition = fromTo[action];
      if (shop.status !== transition.from) {
        throw new ConflictException({
          code: "INVALID_SHOP_STATE",
          message: `Cannot ${action} a ${shop.status.toLowerCase()} shop.`,
        });
      }
      const reason = action === "reject" || action === "suspend" ? input.reason?.trim() : null;
      if ((action === "reject" || action === "suspend") && !reason) {
        throw new UnprocessableEntityException({
          code: "REASON_REQUIRED",
          message: "A reason is required.",
        });
      }

      const updated = await tx.shop.update({
        where: { id },
        data: {
          status: transition.to,
          decisionReason: reason,
          ...(action === "approve" ? { approvedAt: new Date() } : {}),
          version: { increment: 1 },
        },
      });
      await this.audit(
        tx,
        adminId,
        id,
        transition.audit,
        reason ?? (input.reason?.trim() || undefined),
      );
      return this.managementProjection(
        await tx.shop.findUniqueOrThrow({
          where: { id: updated.id },
          include: { logo: true, banner: true },
        }),
      );
    });
  }

  private async managedShop(tx: Prisma.TransactionClient, userId: string, id: string) {
    const shop = await tx.shop.findFirst({
      where: { id, members: { some: { userId, status: "ACTIVE" } } },
      include: { logo: true, banner: true },
    });
    if (!shop) throw new NotFoundException();
    return shop;
  }

  private async lockOwnedAsset(
    tx: Prisma.TransactionClient,
    userId: string,
    shopId: string,
    assetId: string,
    purpose: "SHOP_LOGO" | "SHOP_BANNER",
  ) {
    await tx.$queryRaw`SELECT id FROM assets WHERE id = ${assetId}::uuid FOR UPDATE`;
    const asset = await tx.asset.findFirst({
      where: {
        id: assetId,
        uploaderUserId: userId,
        purpose,
        status: "VERIFIED",
        OR: [{ shopId: null }, { shopId }],
      },
    });
    if (!asset) throw this.assetNotFound();
    return asset;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    shopId: string,
    action: string,
    reason?: string,
  ) {
    await tx.auditEvent.create({
      data: {
        actorUserId,
        actorKind: "USER",
        action,
        targetType: "Shop",
        targetId: shopId,
        shopId,
        ...(reason ? { reason } : {}),
        outcome: "SUCCESS",
        requestId: randomUUID(),
        safeMetadata: {},
      },
    });
  }

  private managementProjection(shop: ShopWithAssets) {
    return {
      id: shop.id,
      name: shop.name,
      slug: shop.slugNormalized,
      description: shop.description,
      logoAssetId: shop.logoAssetId,
      contactAddress: shop.contactAddress,
      phone: shop.phone,
      logo: this.assetProjection(shop.logo),
      banner: shop.banner ? this.assetProjection(shop.banner) : null,
      status: shop.status,
      rejectionReason: shop.decisionReason,
      approvedAt: shop.approvedAt?.toISOString() ?? null,
      version: shop.version,
      createdAt: shop.createdAt.toISOString(),
      updatedAt: shop.updatedAt.toISOString(),
    };
  }

  private assetProjection(asset: ShopWithAssets["logo"]) {
    return {
      id: asset.id,
      url: this.publicBase ? `${this.publicBase}/${asset.objectKey}` : asset.objectKey,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
    };
  }

  private assertVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ConflictException({
        code: "VERSION_CONFLICT",
        message: "Reload the shop before retrying.",
      });
    }
  }

  private assetNotFound(): NotFoundException {
    return new NotFoundException({
      code: "ASSET_NOT_FOUND",
      message: "The selected asset is unavailable.",
    });
  }

  private isUniqueError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
