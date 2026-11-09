import { HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { describe, expect, it, jest } from "@jest/globals";
import { RateLimitExceededException, RateLimiterService } from "../src/modules/identity/rate-limiter.service.js";
import type { RateLimitDecision, RateLimitStore } from "../src/modules/identity/rate-limit/rate-limit-store.js";

const secret = "rate-limit-test-key-secret-at-least-32-characters";
const windowMs = 60_000;

type Call = { key: string; limit: number; windowMs: number };

function bucketKey(scope: string, identifier: string): string {
  const digest = createHmac("sha256", secret).update(`${scope}:${identifier}`).digest("hex");
  return `auth:${digest}`;
}

function fixture(
  decide: (call: Call) => Promise<RateLimitDecision> = async () => ({
    allowed: true,
    retryAfterSeconds: 0,
  }),
  values: Record<string, string | undefined> = {},
) {
  const calls: Call[] = [];
  const store: RateLimitStore = {
    consume: jest.fn(async (key, limit, duration) => {
      const call = { key, limit, windowMs: duration };
      calls.push(call);
      return decide(call);
    }),
    ping: jest.fn(async () => {}),
  };
  const config = {
    get: (key: string) => ({ RATE_LIMIT_KEY_SECRET: secret, ...values })[key],
  } as unknown as ConfigService;
  return { calls, store, limiter: new RateLimiterService(store, config) };
}

describe("RateLimiterService", () => {
  it("applies the register IP and normalized email defaults in that order", async () => {
    const { calls, limiter } = fixture();

    await limiter.assertRegisterAllowed("203.0.113.7", "  Alice@Example.COM ");

    expect(calls).toEqual([
      { key: bucketKey("register:ip", "203.0.113.7"), limit: 60, windowMs },
      { key: bucketKey("register:email", "alice@example.com"), limit: 5, windowMs },
    ]);
    expect(JSON.stringify(calls)).not.toContain("alice@example.com");
  });

  it("applies the login IP and email defaults and shares casing variants", async () => {
    const { calls, limiter } = fixture();

    await limiter.assertLoginAllowed("203.0.113.8", "  Alice@Example.COM ");
    await limiter.assertLoginAllowed("203.0.113.8", "alice@example.com");

    expect(calls.map(({ limit }) => limit)).toEqual([180, 10, 180, 10]);
    expect(calls[1]!.key).toBe(calls[3]!.key);
    expect(calls.every(({ windowMs: duration }) => duration === windowMs)).toBe(true);
  });

  it("applies the refresh IP and session-family defaults with isolated families", async () => {
    const { calls, limiter } = fixture();

    await limiter.assertRefreshIpAllowed("203.0.113.9");
    await limiter.assertRefreshFamilyAllowed("family-a");
    await limiter.assertRefreshFamilyAllowed("family-b");

    expect(calls.map(({ limit }) => limit)).toEqual([300, 30, 30]);
    expect(calls[1]!.key).not.toBe(calls[2]!.key);
    expect(calls.map(({ windowMs: duration }) => duration)).toEqual([
      windowMs,
      windowMs,
      windowMs,
    ]);
  });

  it("turns a denied bucket into RATE_LIMITED with its retry delay", async () => {
    const denied = bucketKey("register:email", "alice@example.com");
    const { calls, limiter } = fixture(async ({ key }) => ({
      allowed: key !== denied,
      retryAfterSeconds: key === denied ? 23 : 0,
    }));

    const error = await limiter
      .assertRegisterAllowed("203.0.113.7", "Alice@example.com")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(RateLimitExceededException);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as RateLimitExceededException).getStatus()).toBe(429);
    expect((error as RateLimitExceededException).retryAfterSeconds).toBe(23);
    expect((error as HttpException).getResponse()).toMatchObject({ code: "RATE_LIMITED" });
    expect(calls).toHaveLength(2);
  });

  it("does not create per-email buckets after the IP bucket is exhausted", async () => {
    const { calls, limiter } = fixture(async () => ({ allowed: false, retryAfterSeconds: 11 }));

    await expect(limiter.assertRegisterAllowed("203.0.113.10", "spray@example.com"))
      .rejects.toBeInstanceOf(RateLimitExceededException);

    expect(calls).toEqual([
      { key: bucketKey("register:ip", "203.0.113.10"), limit: 60, windowMs },
    ]);
  });

  it("fails closed when the shared store is unavailable", async () => {
    const { limiter } = fixture(async () => {
      throw new Error("Redis unavailable");
    });

    await expect(limiter.assertLoginAllowed("203.0.113.11", "alice@example.com"))
      .rejects.toMatchObject({ status: 503 });
  });
});
