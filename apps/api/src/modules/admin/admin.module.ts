import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { OrderModule } from "../order/order.module.js";
import { AdminGuard } from "../shop/admin.guard.js";
import { AdminAuditController } from "./controllers/audit.controller.js";
import { AdminOrdersController } from "./controllers/orders.controller.js";
import { AdminProductsController } from "./controllers/products.controller.js";
import { AdminStatisticsController } from "./controllers/statistics.controller.js";
import { AdminUsersController } from "./controllers/users.controller.js";
import { AccountManagementService } from "./services/account-management.service.js";
import { AdminModerationService } from "./services/moderation.service.js";
import { OrderInquiryService } from "./services/order-inquiry.service.js";
import { AdminStatisticsService } from "./services/admin-statistics.service.js";
import { AuditQueryService } from "./services/audit-query.service.js";

@Module({
  imports: [IdentityModule, CatalogModule, OrderModule],
  controllers: [
    AdminUsersController,
    AdminProductsController,
    AdminOrdersController,
    AdminStatisticsController,
    AdminAuditController,
  ],
  providers: [
    AccountManagementService,
    AdminModerationService,
    OrderInquiryService,
    AdminStatisticsService,
    AuditQueryService,
    AdminGuard,
  ],
})
export class AdminModule {}
