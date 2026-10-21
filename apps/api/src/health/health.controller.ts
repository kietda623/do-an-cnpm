import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ReadinessService } from "./readiness.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly readiness: ReadinessService) {}

  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Get("ready")
  async ready() {
    const checks = await this.readiness.check();
    if (Object.values(checks).some((check) => check !== "up")) {
      throw new ServiceUnavailableException({
        status: "not_ready",
        checks,
      });
    }

    return { status: "ready", checks };
  }
}
