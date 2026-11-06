import type { ConfigService } from "@nestjs/config";
import { resolve } from "node:path";

export type AssetStorage =
  | { mode: "s3"; bucket: string; publicBase: string }
  | { mode: "local"; directory: string; publicBase: string }
  | { mode: "unavailable" };

export function resolveAssetStorage(config: ConfigService): AssetStorage {
  const bucket = config.get<string>("S3_BUCKET")?.trim() ?? "";
  const publicBase = (
    config.get<string>("ASSET_PUBLIC_READ_BASE") ??
    config.get<string>("S3_PUBLIC_READ_BASE") ??
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (bucket && publicBase) return { mode: "s3", bucket, publicBase };
  if (config.get<string>("NODE_ENV")?.trim() === "production") return { mode: "unavailable" };

  const directory =
    config.get<string>("ASSET_LOCAL_DIR")?.trim() || resolve(process.cwd(), "uploads");
  const apiBase = (
    config.get<string>("PUBLIC_API_URL")?.trim() ||
    `http://localhost:${config.get<string>("API_PORT")?.trim() || "4000"}`
  ).replace(/\/$/, "");

  return { mode: "local", directory, publicBase: `${apiBase}/api/v1/assets` };
}
