import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import type { ConfigService } from "@nestjs/config";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    const created: Array<{ objectKey: string }> = [];
    const db = {
      prisma: {
        asset: {
          create: async ({ data }: { data: Record<string, unknown>; }) => {
            const row = { id: assetId, ...data } as { id: string; objectKey: string };
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

    const result = await service.upload(
      userId,
      { buffer: png, originalname: "logo.png", mimetype: "image/png" },
      "SHOP_LOGO",
    );

    expect(result.url).toBe(`http://localhost:4000/api/v1/assets/${assetId}`);
    expect(result.mimeType).toBe("image/png");
    expect((await stat(join(directory, created[0]!.objectKey))).size).toBe(png.length);
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
