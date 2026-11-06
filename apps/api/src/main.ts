import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { configureHttp } from "./common/http/configure-http.js";
import { StructuredLogger } from "./common/logging/logger.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
  });

  configureHttp(app);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Marketplace API")
    .setDescription("Versioned API for the multi-vendor marketplace MVP.")
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.0.3")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "BearerAuth",
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument, {
    useGlobalPrefix: false,
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Marketplace API listening on port ${port}`, "Bootstrap");
}

void bootstrap();
