import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { PaymentModule } from "../payment/payment.module.js";
import { AdminGuard } from "../shop/admin.guard.js";
import { ReturnConfirmationController } from "../admin/controllers/return-confirmation.controller.js";
import { ShipmentsController } from "./controllers/shipments.controller.js";
import { ShippingService } from "./services/shipping.service.js";

@Module({
  imports: [IdentityModule, PaymentModule],
  controllers: [ShipmentsController, ReturnConfirmationController],
  providers: [ShippingService, AdminGuard],
})
export class ShippingModule {}
