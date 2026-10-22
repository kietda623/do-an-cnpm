import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ApiRequest, ApiResponse, Next } from "./request.types.js";

@Injectable()
export class RequestIdMiddleware {
  use(request: ApiRequest, response: ApiResponse, next: Next): void {
    const requestId = randomUUID();
    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);
    next();
  }
}
