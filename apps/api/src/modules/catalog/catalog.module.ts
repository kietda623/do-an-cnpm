import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { AdminGuard } from "../shop/admin.guard.js";
import { CatalogService } from "./services/catalog.service.js";
import { DiscoveryService } from "./services/discovery.service.js";
import { DiscoveryRepository } from "./repositories/discovery.repository.js";
import { DiscoveryController } from "./controllers/discovery.controller.js";
import {
  AdminCategoriesController,
  ManagementProductListController,
  ProductManagementController,
  PublicCategoriesController,
  VariantManagementController,
} from "./controllers/catalog.controller.js";
@Module({
  imports: [IdentityModule],
  controllers: [
    PublicCategoriesController,
    AdminCategoriesController,
    DiscoveryController,
    ProductManagementController,
    ManagementProductListController,
    VariantManagementController,
  ],
  providers: [CatalogService, DiscoveryService, DiscoveryRepository, AdminGuard],
  exports: [CatalogService, DiscoveryService],
})
export class CatalogModule {}
