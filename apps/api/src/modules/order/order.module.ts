import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { PaymentModule } from "../payment/payment.module.js";
import { CancellationController } from "./controllers/cancellation.controller.js";
import { CheckoutController } from "./controllers/checkout.controller.js";
import { OrdersController } from "./controllers/orders.controller.js";
import { QuoteController } from "./controllers/quote.controller.js";
import { CheckoutService } from "./services/checkout.service.js";
import { CancellationService } from "./services/cancellation.service.js";
import { OrderQueryService } from "./services/order-query.service.js";
import { QuoteService } from "./services/quote.service.js";

@Module({
  imports: [IdentityModule, PaymentModule],
  controllers: [QuoteController, CheckoutController, OrdersController, CancellationController],
  providers: [QuoteService, CheckoutService, OrderQueryService, CancellationService],
})
export class OrderModule {}
