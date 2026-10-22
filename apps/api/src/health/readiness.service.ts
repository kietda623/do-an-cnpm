import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/prisma.service.js";

export type ReadinessChecks = {
  configuration: "up" | "down";
  database: "up" | "down";
};

@Injectable()
export class ReadinessService {
  private readonly configurationReady: boolean;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
  ) {
    const connectionString = config.get<string>("DATABASE_URL")?.trim();
    const signingSecret = config.get<string>("JWT_SIGNING_SECRET")?.trim();
    this.configurationReady = Boolean(connectionString && signingSecret);
  }

  async check(): Promise<ReadinessChecks> {
    if (!this.database.isConfigured) {
      return { configuration: "down", database: "down" };
    }

    let databaseReady: ReadinessChecks["database"];
    try {
      await this.database.checkConnection();
      databaseReady = "up";
    } catch {
      databaseReady = "down";
    }

    return {
      configuration: this.configurationReady ? "up" : "down",
      database: databaseReady,
    };
  }
}
