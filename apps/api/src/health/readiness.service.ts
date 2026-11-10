import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/prisma.service.js";
import {
  RATE_LIMIT_STORE,
  type RateLimitStore,
} from "../modules/identity/rate-limit/rate-limit-store.js";

export type ReadinessChecks = {
  configuration: "up" | "down";
  database: "up" | "down";
  rateLimiter: "up" | "down";
};

@Injectable()
export class ReadinessService {
  private readonly configurationReady: boolean;

  constructor(
    config: ConfigService,
    private readonly database: DatabaseService,
    @Inject(RATE_LIMIT_STORE) private readonly rateLimitStore: RateLimitStore,
  ) {
    const connectionString = config.get<string>("DATABASE_URL")?.trim();
    const signingSecret = config.get<string>("JWT_SIGNING_SECRET")?.trim();
    const rateLimitSecret = config.get<string>("RATE_LIMIT_KEY_SECRET")?.trim();
    const rateLimitRedisUrl = config
      .get<string>("RATE_LIMIT_REDIS_URL")
      ?.trim();
    const rateLimitKeyPrefix = config
      .get<string>("RATE_LIMIT_KEY_PREFIX")
      ?.trim();
    const proxyHops = config.get<string | number>("API_TRUST_PROXY_HOPS");
    const parsedProxyHops = Number(proxyHops ?? 0);
    const proxyConfigurationReady =
      Number.isSafeInteger(parsedProxyHops) && parsedProxyHops >= 0;

    this.configurationReady = Boolean(
      connectionString &&
      signingSecret &&
      rateLimitSecret &&
      rateLimitSecret.length >= 32 &&
      rateLimitRedisUrl &&
      rateLimitKeyPrefix &&
      proxyConfigurationReady,
    );
  }

  async check(): Promise<ReadinessChecks> {
    if (!this.database.isConfigured) {
      return { configuration: "down", database: "down", rateLimiter: "down" };
    }

    let databaseReady: ReadinessChecks["database"];
    try {
      await this.database.checkConnection();
      databaseReady = "up";
    } catch {
      databaseReady = "down";
    }

    let rateLimiterReady: ReadinessChecks["rateLimiter"];
    try {
      await this.rateLimitStore.ping();
      rateLimiterReady = "up";
    } catch {
      rateLimiterReady = "down";
    }

    return {
      configuration: this.configurationReady ? "up" : "down",
      database: databaseReady,
      rateLimiter: rateLimiterReady,
    };
  }
}
