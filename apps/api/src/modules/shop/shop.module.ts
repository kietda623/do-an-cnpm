import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { ShopController, ShopModerationController } from "./shop.controller.js";
import { AdminGuard } from "./admin.guard.js";
import { ShopService } from "./shop.service.js";
import { ShopStatisticsController } from "./controllers/shop-statistics.controller.js";
import { ShopStatisticsService } from "./services/shop-statistics.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [ShopController, ShopModerationController, ShopStatisticsController],
  providers: [ShopService, AdminGuard, ShopStatisticsService],
})
export class ShopModule {}
