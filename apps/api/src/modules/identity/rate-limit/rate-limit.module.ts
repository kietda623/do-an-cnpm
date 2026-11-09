import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RATE_LIMIT_STORE } from "./rate-limit-store.js";
import { RedisRateLimitStore } from "./redis-rate-limit-store.js";

@Module({
  providers: [
    {
      provide: RATE_LIMIT_STORE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new RedisRateLimitStore(
          config.getOrThrow<string>("RATE_LIMIT_REDIS_URL"),
          config.get<string>("NODE_ENV") ?? "development",
          config.getOrThrow<string>("RATE_LIMIT_KEY_PREFIX"),
        ),
    },
  ],
  exports: [RATE_LIMIT_STORE],
})
export class RateLimitModule {}
