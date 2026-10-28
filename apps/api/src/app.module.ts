import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { CsrfRequestMiddleware } from "./common/http/csrf-request.middleware.js";
import { RequestIdMiddleware } from "./common/http/request-id.middleware.js";
import { StructuredLogger } from "./common/logging/logger.js";
import { RequestLoggerMiddleware } from "./common/logging/request-logger.middleware.js";
import { DatabaseModule } from "./database/database.module.js";
import { HealthModule } from "./health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { ShopModule } from "./modules/shop/shop.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { InventoryModule } from "./modules/inventory/inventory.module.js";
import { CartModule } from "./modules/cart/cart.module.js";
import { OrderModule } from "./modules/order/order.module.js";
import { ShippingModule } from "./modules/shipping/shipping.module.js";
import { AdminModule } from "./modules/admin/admin.module.js";
import { ReviewModule } from "./modules/review/review.module.js";

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
    ShopModule,
    CatalogModule,
    InventoryModule,
    CartModule,
    OrderModule,
    ShippingModule,
    AdminModule,
    ReviewModule,
  ],
  providers: [
    RequestIdMiddleware,
    CsrfRequestMiddleware,
    RequestLoggerMiddleware,
    StructuredLogger,
  ],
})
export class AppModule {}
