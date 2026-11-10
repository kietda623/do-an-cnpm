import type { OnModuleDestroy } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import type { RateLimitDecision, RateLimitStore } from "./rate-limit-store.js";

const CONSUME_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
local limit = tonumber(ARGV[1])
local allowed = count <= limit
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
elseif count > limit then
  redis.call('DECR', KEYS[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { allowed and 1 or 0, ttl }
`;

const MAX_CONNECTION_RETRIES = 2;

export class RedisRateLimitStore implements RateLimitStore, OnModuleDestroy {
  private client: RedisClientType | undefined;
  private connection: Promise<RedisClientType> | undefined;
  private shuttingDown = false;

  constructor(
    private readonly redisUrl: string,
    private readonly environment: string,
    private readonly keyPrefix: string,
  ) {
    if (!redisUrl.trim()) throw new Error("RATE_LIMIT_REDIS_URL must be configured");
    if (!environment.trim()) throw new Error("NODE_ENV must be configured for rate-limit keys");
    if (!keyPrefix.trim()) throw new Error("RATE_LIMIT_KEY_PREFIX must be configured");
  }

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    if (!key.trim()) throw new Error("Rate-limit key must not be empty");
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new Error("Rate-limit limit must be a positive integer");
    if (!Number.isSafeInteger(windowMs) || windowMs < 1)
      throw new Error("Rate-limit window must be a positive integer");

    const client = await this.getReadyClient();
    const result = await client.eval(CONSUME_SCRIPT, {
      keys: [this.prefixedKey(key)],
      arguments: [String(limit), String(windowMs)],
    });

    if (!Array.isArray(result) || result.length !== 2)
      throw new Error("Redis returned an invalid rate-limit decision");

    const allowed = Number(result[0]) === 1;
    const ttlMilliseconds = Number(result[1]);
    if (!Number.isFinite(ttlMilliseconds) || ttlMilliseconds < 0)
      throw new Error("Redis returned an invalid rate-limit TTL");

    return {
      allowed,
      retryAfterSeconds: Math.ceil(ttlMilliseconds / 1_000),
    };
  }

  async ping(): Promise<void> {
    const client = await this.getReadyClient();
    await client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    const client = this.client;
    if (!client) return;

    if (this.connection) await this.connection.catch(() => undefined);
    if (client.isOpen) await client.close();
    if (this.client === client) this.client = undefined;
  }

  private async getReadyClient(): Promise<RedisClientType> {
    if (this.shuttingDown) throw new Error("Redis rate-limit store is shutting down");
    if (this.client?.isReady) return this.client;
    if (this.connection) return this.connection;

    const client = this.client ?? this.createClient();
    this.client = client;

    if (client.isOpen) {
      throw new Error("Redis rate-limit client is open but not ready");
    }

    this.connection = client
      .connect()
      .then(() => client)
      .catch(async (error: unknown) => {
        if (client.isOpen) await client.close().catch(() => undefined);
        if (this.client === client) this.client = undefined;
        throw error;
      })
      .finally(() => {
        this.connection = undefined;
      });

    return this.connection;
  }

  private createClient(): RedisClientType {
    const client = createClient({
      url: this.redisUrl,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 1_500,
        reconnectStrategy: (retries) =>
          retries >= MAX_CONNECTION_RETRIES ? false : (retries + 1) * 100,
      },
    });
    client.on("error", () => undefined);
    return client;
  }

  private prefixedKey(key: string): string {
    return `${this.environment}:${this.keyPrefix}:${key}`;
  }
}
