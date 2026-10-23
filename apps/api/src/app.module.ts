import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CsrfRequestMiddleware } from "./common/http/csrf-request.middleware.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { StructuredLogger } from "./common/logging/logger.js";
import { RequestLoggerMiddleware } from "./common/logging/request-logger.middleware.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      ignoreEnvFile: process.env.NODE_ENV === "production",
    }),
    DatabaseModule,
    HealthModule,
    IdentityModule,
  ],
  providers: [
    RequestIdMiddleware,
    CsrfRequestMiddleware,
    RequestLoggerMiddleware,
    StructuredLogger,
  ],
})
export class AppModule {}
