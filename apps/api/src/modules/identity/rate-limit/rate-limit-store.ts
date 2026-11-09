export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
  ping(): Promise<void>;
}

export const RATE_LIMIT_STORE = Symbol("RATE_LIMIT_STORE");
