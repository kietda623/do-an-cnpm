import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ConfigService } from "@nestjs/config";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import type { DatabaseService } from "../src/database/prisma.service.js";
import { AssetService } from "../src/modules/catalog/media/asset.service.js";
import { resolveAssetStorage } from "../src/modules/catalog/media/asset-storage.js";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const assetId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function config(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

type CreatedAsset = {
  id: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
};

function localService(directory: string) {
  const created: CreatedAsset[] = [];
  const db = {
    prisma: {
      asset: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { id: assetId, ...data } as CreatedAsset;
          created.push(row);
          return row;
        },
      },
    },
  } as unknown as DatabaseService;
  const service = new AssetService(
    db,
    config({
      NODE_ENV: "development",
      ASSET_LOCAL_DIR: directory,
      PUBLIC_API_URL: "http://localhost:4000",
    }),
  );
  return { service, created };
}

function oversizedPng(): Buffer {
  const image = Buffer.from(png);
  image.writeUInt32BE(5_000, 16);
  image.writeUInt32BE(8_001, 20);
  image.writeUInt32BE(crc32(image.subarray(12, 29)), 29);
  return image;
}

describe("asset storage resolution", () => {
  it("uses S3 when a bucket and public base are configured", () => {
    const storage = resolveAssetStorage(
      config({
        NODE_ENV: "development",
        S3_BUCKET: "marketplace-assets",
        ASSET_PUBLIC_READ_BASE: "https://cdn.example.test/",
      }),
    );

    expect(storage).toEqual({
      mode: "s3",
      bucket: "marketplace-assets",
      publicBase: "https://cdn.example.test",
    });
  });

  it("falls back to local disk in development without S3", () => {
    const storage = resolveAssetStorage(
      config({
        NODE_ENV: "development",
        ASSET_LOCAL_DIR: join(tmpdir(), "marketplace-assets"),
        PUBLIC_API_URL: "http://localhost:4000",
      }),
    );

    expect(storage).toEqual({
      mode: "local",
      directory: join(tmpdir(), "marketplace-assets"),
      publicBase: "http://localhost:4000/api/v1/assets",
    });
  });

  it("stays unavailable in production without S3", () => {
    expect(resolveAssetStorage(config({ NODE_ENV: "production" }))).toEqual({
      mode: "unavailable",
    });
  });
});

describe("AssetService local driver", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "asset-local-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("writes the uploaded image locally and returns a served URL", async () => {
    const { service, created } = localService(directory);
    const image = await sharp({
      create: { width: 2, height: 3, channels: 4, background: "#336699" },
    })
      .png()
      .toBuffer();

    const result = await service.upload(
      userId,
      { buffer: image, originalname: "logo.png", mimetype: "image/png" },
      "SHOP_LOGO",
    );

    expect(result.url).toBe(`http://localhost:4000/api/v1/assets/${assetId}`);
    expect(result.mimeType).toBe("image/png");
    expect(result.width).toBe(2);
    expect(result.height).toBe(3);
    expect(await readFile(join(directory, created[0]!.objectKey))).toEqual(image);
  });

  it("preserves WebP metadata and original uploaded bytes", async () => {
    const { service, created } = localService(directory);
    const image = await sharp({
      create: { width: 3, height: 2, channels: 4, background: "#336699" },
    })
      .webp()
      .toBuffer();

    const result = await service.upload(
      userId,
      { buffer: image, originalname: "logo.webp", mimetype: "image/webp" },
      "SHOP_LOGO",
    );

    expect(result.mimeType).toBe("image/webp");
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(await readFile(join(directory, created[0]!.objectKey))).toEqual(image);
  });

  it("streams encoded output without requesting or collecting raw pixels", async () => {
    const { service } = localService(directory);
    const image = await sharp({
      create: { width: 2, height: 3, channels: 4, background: "#336699" },
    })
      .png()
      .toBuffer();
    const toBuffer = jest.spyOn(sharp.prototype, "toBuffer");
    const raw = jest.spyOn(sharp.prototype, "raw");

    try {
      const result = await service.upload(
        userId,
        { buffer: image, originalname: "logo.png", mimetype: "image/png" },
        "SHOP_LOGO",
      );

      expect(result.width).toBe(2);
      expect(result.height).toBe(3);
      expect(toBuffer).not.toHaveBeenCalled();
      expect(raw).not.toHaveBeenCalled();
    } finally {
      toBuffer.mockRestore();
      raw.mockRestore();
    }
  });

  it("returns dimensions after applying JPEG EXIF orientation", async () => {
    const { service, created } = localService(directory);
    const image = await sharp({
      create: { width: 2, height: 3, channels: 3, background: "#336699" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await service.upload(
      userId,
      { buffer: image, originalname: "portrait.jpg", mimetype: "image/jpeg" },
      "SHOP_LOGO",
    );

    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(await readFile(join(directory, created[0]!.objectKey))).toEqual(image);
  });

  it("rejects a truncated PNG before writing a file or Asset row", async () => {
    const { service, created } = localService(directory);
    const image = await sharp({
      create: { width: 2, height: 3, channels: 4, background: "#336699" },
    })
      .png()
      .toBuffer();
    const truncated = image.subarray(0, 24);

    await expect(
      service.upload(
        userId,
        { buffer: truncated, originalname: "truncated.png", mimetype: "image/png" },
        "SHOP_LOGO",
      ),
    ).rejects.toMatchObject({ response: { code: "INVALID_IMAGE" }, status: 422 });
    expect(created).toHaveLength(0);
    expect(await listFiles(directory)).toEqual([]);
  });

  it("rejects a MIME and signature mismatch before persistence", async () => {
    const { service, created } = localService(directory);

    await expect(
      service.upload(
        userId,
        { buffer: png, originalname: "logo.jpg", mimetype: "image/jpeg" },
        "SHOP_LOGO",
      ),
    ).rejects.toMatchObject({
      response: { code: "IMAGE_SIGNATURE_MISMATCH" },
      status: 415,
    });
    expect(created).toHaveLength(0);
    expect(await listFiles(directory)).toEqual([]);
  });

  it("rejects an encoded file over 5 MiB before persistence", async () => {
    const { service, created } = localService(directory);

    await expect(
      service.upload(
        userId,
        {
          buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
          originalname: "large.png",
          mimetype: "image/png",
        },
        "SHOP_LOGO",
      ),
    ).rejects.toMatchObject({ response: { code: "INVALID_FILE_SIZE" }, status: 422 });
    expect(created).toHaveLength(0);
    expect(await listFiles(directory)).toEqual([]);
  });

  it("rejects images above the 40 million pixel limit before persistence", async () => {
    const { service, created } = localService(directory);
    const image = oversizedPng();

    await expect(
      sharp(image, { failOn: "warning", limitInputPixels: 40_000_000 }).raw().toBuffer(),
    ).rejects.toThrow("Input image exceeds pixel limit");
    await expect(
      service.upload(
        userId,
        { buffer: image, originalname: "oversized.png", mimetype: "image/png" },
        "SHOP_LOGO",
      ),
    ).rejects.toMatchObject({ response: { code: "INVALID_IMAGE" }, status: 422 });
    expect(created).toHaveLength(0);
    expect(await listFiles(directory)).toEqual([]);
  });

  it("removes the local file when persistence fails", async () => {
    const db = {
      prisma: {
        asset: {
          create: async () => {
            throw new Error("database unavailable");
          },
        },
      },
    } as unknown as DatabaseService;
    const service = new AssetService(
      db,
      config({
        NODE_ENV: "development",
        ASSET_LOCAL_DIR: directory,
        PUBLIC_API_URL: "http://localhost:4000",
      }),
    );

    await expect(
      service.upload(
        userId,
        { buffer: png, originalname: "logo.png", mimetype: "image/png" },
        "SHOP_LOGO",
      ),
    ).rejects.toThrow("database unavailable");
    expect(await listFiles(directory)).toEqual([]);
  });
});
