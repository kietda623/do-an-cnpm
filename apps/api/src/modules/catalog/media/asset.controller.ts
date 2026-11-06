import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { isUUID } from "class-validator";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { DatabaseService } from "../../../database/prisma.service.js";
import { resolveAssetStorage } from "./asset-storage.js";

@ApiTags("assets")
@Controller("assets")
export class AssetController {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  @Get(":id")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "Read an asset stored on the local development disk" })
  async read(@Param("id") id: string): Promise<StreamableFile> {
    if (!isUUID(id)) throw new NotFoundException();

    const storage = resolveAssetStorage(this.config);
    if (storage.mode !== "local") throw new NotFoundException();

    const asset = await this.db.prisma.asset.findUnique({ where: { id } });
    if (!asset || asset.status !== "VERIFIED") throw new NotFoundException();

    const root = resolve(storage.directory);
    const filePath = resolve(root, asset.objectKey);
    const inside = relative(root, filePath);
    if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new NotFoundException();

    const info = await stat(filePath).catch(() => undefined);
    if (!info?.isFile()) throw new NotFoundException();

    return new StreamableFile(createReadStream(filePath), {
      type: asset.mimeType,
      length: info.size,
    });
  }
}
