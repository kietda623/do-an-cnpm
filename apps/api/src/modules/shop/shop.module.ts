import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { ShopController, ShopModerationController } from "./shop.controller.js";
import { AdminGuard } from "./admin.guard.js";
import { ShopService } from "./shop.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [ShopController, ShopModerationController],
  providers: [ShopService, AdminGuard],
})
export class ShopModule {}
