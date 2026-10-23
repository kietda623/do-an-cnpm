import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { CheckoutController } from "./controllers/checkout.controller.js";
import { OrdersController } from "./controllers/orders.controller.js";
import { QuoteController } from "./controllers/quote.controller.js";
import { CheckoutService } from "./services/checkout.service.js";
import { OrderQueryService } from "./services/order-query.service.js";
import { QuoteService } from "./services/quote.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [QuoteController, CheckoutController, OrdersController],
  providers: [QuoteService, CheckoutService, OrderQueryService],
})
export class OrderModule {}
