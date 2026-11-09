import {
  Inject,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac } from "node:crypto";
import { RATE_LIMIT_STORE, type RateLimitStore } from "./rate-limit/rate-limit-store.js";

const WINDOW_MS = 60_000;

const defaults = {
  RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE: 5,
  RATE_LIMIT_REGISTER_IP_PER_MINUTE: 60,
  RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE: 10,
  RATE_LIMIT_LOGIN_IP_PER_MINUTE: 180,
  RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE: 30,
  RATE_LIMIT_REFRESH_IP_PER_MINUTE: 300,
} as const;

type LimitName = keyof typeof defaults;

function configuredLimit(config: ConfigService, name: LimitName): number {
  const value = config.get<string | number>(name);
  if (value === undefined || value === null || String(value).trim() === "") return defaults[name];
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export class RateLimitExceededException extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      {
        code: "RATE_LIMITED",
        message: "Too many requests. Try again shortly.",
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

@Injectable()
export class RateLimiterService {
  private readonly secret: string;
  private readonly limits: Record<LimitName, number>;

  constructor(
    @Inject(RATE_LIMIT_STORE) private readonly store: RateLimitStore,
    config: ConfigService,
  ) {
    const secret = config.get<string>("RATE_LIMIT_KEY_SECRET")?.trim();
    if (!secret || secret.length < 32)
      throw new Error("RATE_LIMIT_KEY_SECRET must contain at least 32 characters");
    this.secret = secret;
    this.limits = {
      RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE: configuredLimit(
        config,
        "RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE",
      ),
      RATE_LIMIT_REGISTER_IP_PER_MINUTE: configuredLimit(
        config,
        "RATE_LIMIT_REGISTER_IP_PER_MINUTE",
      ),
      RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE: configuredLimit(config, "RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE"),
      RATE_LIMIT_LOGIN_IP_PER_MINUTE: configuredLimit(config, "RATE_LIMIT_LOGIN_IP_PER_MINUTE"),
      RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE: configuredLimit(
        config,
        "RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE",
      ),
      RATE_LIMIT_REFRESH_IP_PER_MINUTE: configuredLimit(config, "RATE_LIMIT_REFRESH_IP_PER_MINUTE"),
    };
  }

  async assertRegisterAllowed(ip: string, email: string): Promise<void> {
    await this.consume(
      "register:ip",
      ip,
      this.limits.RATE_LIMIT_REGISTER_IP_PER_MINUTE,
    );
    await this.consume(
      "register:email",
      email.trim().toLowerCase(),
      this.limits.RATE_LIMIT_REGISTER_EMAIL_PER_MINUTE,
    );
  }

  async assertLoginAllowed(ip: string, email: string): Promise<void> {
    await this.consume("login:ip", ip, this.limits.RATE_LIMIT_LOGIN_IP_PER_MINUTE);
    await this.consume(
      "login:email",
      email.trim().toLowerCase(),
      this.limits.RATE_LIMIT_LOGIN_EMAIL_PER_MINUTE,
    );
  }

  async assertRefreshIpAllowed(ip: string): Promise<void> {
    await this.consume("refresh:ip", ip, this.limits.RATE_LIMIT_REFRESH_IP_PER_MINUTE);
  }

  async assertRefreshFamilyAllowed(familyId: string): Promise<void> {
    await this.consume(
      "refresh:family",
      familyId,
      this.limits.RATE_LIMIT_REFRESH_FAMILY_PER_MINUTE,
    );
  }

  private async consume(scope: string, identifier: string, limit: number): Promise<void> {
    let decision;
    try {
      decision = await this.store.consume(this.key(scope, identifier), limit, WINDOW_MS);
    } catch {
      throw new ServiceUnavailableException({
        code: "RATE_LIMIT_UNAVAILABLE",
        message: "Authentication rate limiting is temporarily unavailable.",
      });
    }
    if (!decision.allowed) throw new RateLimitExceededException(decision.retryAfterSeconds);
  }

  private key(scope: string, identifier: string): string {
    const digest = createHmac("sha256", this.secret)
      .update(`${scope}:${identifier}`)
      .digest("hex");
    return `auth:${digest}`;
  }
}
