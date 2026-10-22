import "reflect-metadata";
import { Logger, RequestMethod } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { CsrfRequestMiddleware } from "./common/http/csrf-request.middleware.js";
import { ContractErrorFilter } from "./common/http/error.filter.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { createContractValidationPipe } from "./common/http/validation.pipe.js";
import { StructuredLogger } from "./common/logging/logger.js";
import { RequestLoggerMiddleware } from "./common/logging/request-logger.middleware.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: new StructuredLogger() });

  const config = app.get(ConfigService);
  const requestId = app.get(RequestIdMiddleware);
  const requestLogger = app.get(RequestLoggerMiddleware);
  const csrfProtection = app.get(CsrfRequestMiddleware);
  app.use(requestId.use.bind(requestId), requestLogger.use.bind(requestLogger));
  app.use(csrfProtection.use.bind(csrfProtection));

  const allowedOrigins = new Set(
    (config.get<string>("CORS_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health/live", method: RequestMethod.GET },
      { path: "health/ready", method: RequestMethod.GET },
    ],
  });
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean | string | string[]) => void,
    ) => callback(null, !origin || allowedOrigins.has(origin)),
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  });
  app.useGlobalPipes(createContractValidationPipe());
  app.useGlobalFilters(new ContractErrorFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Marketplace API")
    .setDescription("Versioned API for the multi-vendor marketplace MVP.")
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.0.3")
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument, { useGlobalPrefix: false });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Marketplace API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
