import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { createClient } from "redis";
import { RedisRateLimitStore } from "../../src/modules/identity/rate-limit/redis-rate-limit-store.js";

const redisUrl = process.env.RATE_LIMIT_REDIS_URL ?? "redis://127.0.0.1:56380";
const suitePrefix = `test:${randomUUID()}`;
const trackedPrefixes = new Set<string>();
const cleanupClient = createClient({ url: redisUrl });
cleanupClient.on("error", () => {});

function createStore(label: string): RedisRateLimitStore {
  const prefix = `test:${suitePrefix}:${label}`;
  trackedPrefixes.add(prefix);
  return new RedisRateLimitStore(redisUrl, "test", `${suitePrefix}:${label}`);
}

describe("RedisRateLimitStore", () => {
  let storeA: RedisRateLimitStore;
  let storeB: RedisRateLimitStore;

  beforeAll(async () => {
    await cleanupClient.connect();
    storeA = createStore("shared");
    storeB = createStore("shared");
    await Promise.all([storeA.ping(), storeB.ping()]);
  });

  afterAll(async () => {
    if (cleanupClient.isReady) {
      for (const prefix of trackedPrefixes) {
        let cursor = "0";
        do {
          const result = await cleanupClient.scan(cursor, {
            MATCH: `${prefix}:*`,
            COUNT: 100,
          });
          cursor = result.cursor;
          if (result.keys.length > 0) await cleanupClient.del(result.keys);
        } while (cursor !== "0");
      }
    }
    await Promise.all([storeA?.onModuleDestroy(), storeB?.onModuleDestroy()]);
    await cleanupClient.close();
  });

  it("shares an atomic capped counter across independent stores under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 === 0 ? storeA : storeB).consume("concurrent", 7, 60_000),
      ),
    );

    expect(results.filter(({ allowed }) => allowed)).toHaveLength(7);
    expect(results.filter(({ allowed, retryAfterSeconds }) => !allowed && retryAfterSeconds > 0))
      .toHaveLength(33);
    await expect(cleanupClient.get(`test:${suitePrefix}:shared:concurrent`)).resolves.toBe("7");
  });

  it("starts a fresh window after the counter TTL expires", async () => {
    const first = await storeA.consume("expires", 1, 100);
    expect(first.allowed).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const nextWindow = await storeB.consume("expires", 1, 100);
    expect(nextWindow.allowed).toBe(true);
  });

  it("isolates counters with different explicit prefixes", async () => {
    const otherPrefixStore = createStore("isolated");
    try {
      const first = await storeA.consume("same-key", 1, 60_000);
      const denied = await storeB.consume("same-key", 1, 60_000);
      const isolated = await otherPrefixStore.consume("same-key", 1, 60_000);

      expect(first.allowed).toBe(true);
      expect(denied.allowed).toBe(false);
      expect(isolated.allowed).toBe(true);
    } finally {
      await otherPrefixStore.onModuleDestroy();
    }
  });

  it("surfaces Redis connection failures", async () => {
    const unavailable = new RedisRateLimitStore(
      "redis://127.0.0.1:1",
      "test",
      `${suitePrefix}:offline`,
    );
    try {
      await expect(unavailable.ping()).rejects.toThrow();
    } finally {
      await unavailable.onModuleDestroy();
    }
  }, 15_000);
});
