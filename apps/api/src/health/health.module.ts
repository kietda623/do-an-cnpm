import { Module } from "@nestjs/common";
import { RateLimitModule } from "../modules/identity/rate-limit/rate-limit.module.js";
import { HealthController } from "./health.controller.js";
import { ReadinessService } from "./readiness.service.js";

@Module({
  imports: [RateLimitModule],
  controllers: [HealthController],
  providers: [ReadinessService],
})
export class HealthModule {}
