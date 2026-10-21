import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export type ReadinessChecks = {
  configuration: "up" | "down";
  database: "up" | "down";
};

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  private readonly pool?: Pool;
  private readonly configurationReady: boolean;

  constructor(config: ConfigService) {
    const connectionString = config.get<string>("DATABASE_URL")?.trim();
    const signingSecret = config.get<string>("JWT_SIGNING_SECRET")?.trim();
    this.configurationReady = Boolean(connectionString && signingSecret);

    if (connectionString) {
      this.pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 1_000,
        idleTimeoutMillis: 1_000,
        query_timeout: 1_000,
      });
    }
  }

  async check(): Promise<ReadinessChecks> {
    if (!this.pool) {
      return { configuration: "down", database: "down" };
    }

    let databaseReady: ReadinessChecks["database"];
    try {
      await this.pool.query("SELECT 1");
      databaseReady = "up";
    } catch {
      databaseReady = "down";
    }

    return {
      configuration: this.configurationReady ? "up" : "down",
      database: databaseReady,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
