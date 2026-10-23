import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module.js";
import { OrderTransaction } from "../order/services/order-transaction.js";
import { PaymentsController } from "./controllers/payments.controller.js";
import { PaymentExpiryJob } from "./jobs/payment-expiry.job.js";
import { PaymentService } from "./services/payment.service.js";
import { PaymentQueryService } from "./services/payment-query.service.js";
import { SettlementService } from "./services/settlement.service.js";

@Module({
  imports: [IdentityModule],
  controllers: [PaymentsController],
  providers: [
    PaymentService,
    PaymentQueryService,
    PaymentExpiryJob,
    OrderTransaction,
    SettlementService,
  ],
  exports: [PaymentService, PaymentQueryService, OrderTransaction, SettlementService],
})
export class PaymentModule {}
