import { Injectable } from "@nestjs/common";
import { StructuredLogger } from "./logger.js";
import type { ApiRequest, ApiResponse, Next } from "../http/request.types.js";

@Injectable()
export class RequestLoggerMiddleware {
  constructor(private readonly logger: StructuredLogger) {}

  use(request: ApiRequest, response: ApiResponse, next: Next): void {
    const startedAt = performance.now();
    response.once("finish", () => {
      this.logger.request({
        requestId: request.requestId ?? "unknown",
        method: request.method,
        path: request.path ?? (request.originalUrl ?? "").split("?", 1)[0],
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    });
    next();
  }
}
