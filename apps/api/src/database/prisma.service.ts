import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { Pool } from "pg";

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly client?: PrismaClient;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL")?.trim();
    if (!connectionString) {
      return;
    }

    // Prisma's PostgreSQL adapter encodes UTC timestamps without an offset.
    // URL options override Pool options in pg, so append UTC inside the URL.
    const databaseUrl = new URL(connectionString);
    const existingOptions = databaseUrl.searchParams.getAll("options").join(" ");
    databaseUrl.searchParams.set("options", `${existingOptions} -c timezone=UTC`.trim());
    const pool = new Pool({
      connectionString: databaseUrl.toString(),
      max: 10,
      connectionTimeoutMillis: 1_000,
      idleTimeoutMillis: 10_000,
      query_timeout: 5_000,
    });
    pool.on("error", () => {
      this.logger.error("PostgreSQL pool reported an idle client error");
    });

    this.client = new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
  }

  get isConfigured(): boolean {
    return this.client !== undefined;
  }

  get prisma(): PrismaClient {
    if (!this.client) {
      throw new Error("DATABASE_URL is required to use the database");
    }

    return this.client;
  }

  async checkConnection(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect();
  }
}
