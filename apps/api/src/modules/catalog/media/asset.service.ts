import {
  Injectable,
  ServiceUnavailableException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import type { OutputInfo } from "sharp";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "../../../database/prisma.service.js";

const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

@Injectable()
export class AssetService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(
    private readonly db: DatabaseService,
    config: ConfigService,
  ) {
    this.bucket = config.get<string>("S3_BUCKET") ?? "";
    this.publicBase = (
      config.get<string>("ASSET_PUBLIC_READ_BASE") ??
      config.get<string>("S3_PUBLIC_READ_BASE") ??
      ""
    ).replace(/\/$/, "");
    this.client = new S3Client({
      region: config.get<string>("S3_REGION")?.trim() || "ap-southeast-1",
      ...(config.get<string>("S3_ENDPOINT")
        ? { endpoint: config.get<string>("S3_ENDPOINT"), forcePathStyle: true }
        : {}),
      credentials:
        config.get<string>("S3_ACCESS_KEY_ID") && config.get<string>("S3_SECRET_ACCESS_KEY")
          ? {
              accessKeyId: config.get<string>("S3_ACCESS_KEY_ID")!,
              secretAccessKey: config.get<string>("S3_SECRET_ACCESS_KEY")!,
            }
          : undefined,
    });
  }

  async upload(
    userId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string } | undefined,
    purpose: string,
    shopId?: string,
  ) {
    if (!file?.buffer?.length)
      throw new UnprocessableEntityException({
        code: "FILE_REQUIRED",
        message: "Choose an image to upload.",
      });
    if (file.buffer.length > 5 * 1024 * 1024 || file.buffer.length < 1)
      throw new UnprocessableEntityException({
        code: "INVALID_FILE_SIZE",
        message: "Image must be between 1 byte and 5 MiB.",
      });
    if (!allowed.has(file.mimetype))
      throw new UnsupportedMediaTypeException({
        code: "UNSUPPORTED_IMAGE",
        message: "Only JPEG, PNG, and WebP images are supported.",
      });
    if (!["AVATAR", "SHOP_LOGO", "SHOP_BANNER", "PRODUCT_IMAGE"].includes(purpose))
      throw new UnprocessableEntityException({
        code: "INVALID_ASSET_PURPOSE",
        message: "The selected upload purpose is not available.",
      });
    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || detected.mime !== file.mimetype || !allowed.has(detected.mime))
      throw new UnsupportedMediaTypeException({
        code: "IMAGE_SIGNATURE_MISMATCH",
        message: "Image content does not match its declared type.",
      });
    let decoded: { data: Buffer; info: OutputInfo };
    try {
      decoded = await sharp(file.buffer, { failOn: "warning", limitInputPixels: 40_000_000 })
        .rotate()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new UnprocessableEntityException({
        code: "INVALID_IMAGE",
        message: "The image could not be decoded.",
      });
    }
    if (purpose === "PRODUCT_IMAGE") {
      if (!shopId)
        throw new UnprocessableEntityException({
          code: "SHOP_REQUIRED",
          message: "Choose a shop for this product image.",
        });
      const membership = await this.db.prisma.shopMember.findFirst({
        where: { shopId, userId, status: "ACTIVE", shop: { status: "ACTIVE" } },
      });
      if (!membership)
        throw new ServiceUnavailableException({
          code: "SHOP_MEDIA_UNAVAILABLE",
          message: "The selected shop is unavailable.",
        });
    }
    if (!this.bucket || !this.publicBase)
      throw new ServiceUnavailableException({
        code: "MEDIA_STORAGE_UNAVAILABLE",
        message: "Media storage is not configured.",
      });
    const ext = detected.ext === "jpeg" ? "jpg" : detected.ext;
    const objectKey = `users/${userId}/assets/${randomUUID()}.${ext}`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: file.buffer,
          ContentType: detected.mime,
          ContentLength: file.buffer.length,
        }),
      );
      const asset = await this.db.prisma.asset.create({
        data: {
          uploaderUserId: userId,
          purpose: purpose as "AVATAR" | "SHOP_LOGO" | "SHOP_BANNER" | "PRODUCT_IMAGE",
          ...(purpose === "PRODUCT_IMAGE" ? { shopId, attachedAt: new Date() } : {}),
          objectKey,
          mimeType: detected.mime,
          byteSize: file.buffer.length,
          width: decoded.info.width,
          height: decoded.info.height,
          status: "VERIFIED",
        },
      });
      return {
        id: asset.id,
        url: `${this.publicBase}/${objectKey}`,
        mimeType: asset.mimeType,
        byteSize: asset.byteSize,
        width: asset.width,
        height: asset.height,
      };
    } catch (error) {
      try {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
      } catch {
        /* preserve the original failure; cleanup can be retried by lifecycle policy */
      }
      throw error;
    }
  }
}
