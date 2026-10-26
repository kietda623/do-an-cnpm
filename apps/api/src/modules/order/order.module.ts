import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { AdminSellerOrdersController } from "../admin/controllers/seller-orders.controller.js";
import { PaymentModule } from "../payment/payment.module.js";
import { AdminGuard } from "../shop/admin.guard.js";
import { CancellationController } from "./controllers/cancellation.controller.js";
import { CheckoutController } from "./controllers/checkout.controller.js";
import { OrdersController } from "./controllers/orders.controller.js";
import { QuoteController } from "./controllers/quote.controller.js";
import { SellerOrdersController } from "./controllers/seller-orders.controller.js";
import { CheckoutService } from "./services/checkout.service.js";
import { CancellationService } from "./services/cancellation.service.js";
import { OrderQueryService } from "./services/order-query.service.js";
import { QuoteService } from "./services/quote.service.js";
import { FulfillmentService } from "./services/fulfillment.service.js";

@Module({
  imports: [IdentityModule, PaymentModule],
  controllers: [
    QuoteController,
    CheckoutController,
    OrdersController,
    CancellationController,
    SellerOrdersController,
    AdminSellerOrdersController,
  ],
  providers: [
    QuoteService,
    CheckoutService,
    OrderQueryService,
    CancellationService,
    FulfillmentService,
    AdminGuard,
  ],
})
export class OrderModule {}
