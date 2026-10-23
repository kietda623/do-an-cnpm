import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { InventoryService } from "./services/inventory.service.js";
import { InventoryController } from "./controllers/inventory.controller.js";
@Module({
  imports: [IdentityModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
