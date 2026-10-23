import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiRequest, ApiResponse, Next } from "./request.types.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const browserAuthMutation = /^\/api\/v1\/auth\/(?:register|login|refresh|logout)$/;

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

@Injectable()
export class CsrfRequestMiddleware {
  private readonly allowedOrigins: Set<string>;
  private readonly signingSecret: string;

  constructor(config: ConfigService) {
    this.signingSecret =
      config.get<string>("JWT_SIGNING_SECRET")?.trim() ||
      "local-csrf-secret-at-least-32-characters";
    this.allowedOrigins = new Set(
      (config.get<string>("CORS_ORIGINS") ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    );
  }

  use(request: ApiRequest, _response: ApiResponse, next: Next): void {
    if (safeMethods.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const pathname = (request.originalUrl ?? request.path ?? "").split("?", 1)[0];
    const origin = firstHeader(request.headers.origin);
    const hasCookie = Boolean(firstHeader(request.headers.cookie));
    const browserAuthRequest = browserAuthMutation.test(pathname) && origin !== undefined;

    if (!hasCookie && !browserAuthRequest) {
      next();
      return;
    }

    const csrfToken = firstHeader(request.headers["x-csrf-token"]);
    if (!origin || !this.allowedOrigins.has(origin) || !csrfToken?.trim()) {
      next(
        new ForbiddenException({
          code: "CSRF_REJECTED",
          message: "A valid Origin and CSRF token are required.",
        }),
      );
      return;
    }

    const cookie = firstHeader(request.headers.cookie)
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("csrf="))
      ?.slice(5);
    if (!this.validCsrf(cookie, csrfToken)) {
      next(
        new ForbiddenException({
          code: "CSRF_REJECTED",
          message: "A valid Origin and CSRF token are required.",
        }),
      );
      return;
    }
    next();
  }

  private validCsrf(cookie: string | undefined, header: string | undefined): boolean {
    if (!cookie || !header || cookie !== header) return false;
    const [token, signature] = cookie.split(".");
    if (!token || !signature) return false;
    const expected = createHmac("sha256", this.signingSecret).update(token).digest("base64url");
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
