import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { DatabaseService } from "../../../database/prisma.service.js";
import { PaymentService } from "../services/payment.service.js";

@Injectable()
export class PaymentExpiryJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentExpiryJob.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly db: DatabaseService,
    private readonly payments: PaymentService,
  ) {}

  onModuleInit() {
    if (!this.db.isConfigured) return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), 30_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep() {
    try {
      const count = await this.payments.expireDueOrders();
      if (count) this.logger.log(`Expired ${count} mock-payment order(s).`);
    } catch (error) {
      this.logger.error(
        "Payment expiry sweep failed; the next database-backed scan will retry.",
        error,
      );
    }
  }
}
