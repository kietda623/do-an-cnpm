import { RequestMethod, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RequestLoggerMiddleware } from "../logging/request-logger.middleware.js";
import { allowedBrowserOrigins } from "./allowed-origins.js";
import { CsrfRequestMiddleware } from "./csrf-request.middleware.js";
import { ContractErrorFilter } from "./error.filter.js";
import { RequestIdMiddleware } from "./request-id.middleware.js";
import { createContractValidationPipe } from "./validation.pipe.js";

export function configureHttp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const configuredProxyHops =
    config.get<string | number>("API_TRUST_PROXY_HOPS") ?? 0;
  const trustedProxyHops = Number(configuredProxyHops);
  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0) {
    throw new Error("API_TRUST_PROXY_HOPS must be a non-negative integer");
  }
  app.getHttpAdapter().getInstance().set("trust proxy", trustedProxyHops);

  const requestId = app.get(RequestIdMiddleware);
  const requestLogger = app.get(RequestLoggerMiddleware);
  const csrfProtection = app.get(CsrfRequestMiddleware);

  app.use(requestId.use.bind(requestId), requestLogger.use.bind(requestLogger));

  const allowedOrigins = allowedBrowserOrigins(config);
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (
        error: Error | null,
        allowed?: boolean | string | string[],
      ) => void,
    ) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "Idempotency-Key",
    ],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
  });
  // After CORS so CSRF rejections still carry the CORS headers the browser needs to read them.
  app.use(csrfProtection.use.bind(csrfProtection));

  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(createContractValidationPipe());
  app.useGlobalFilters(new ContractErrorFilter());
}
