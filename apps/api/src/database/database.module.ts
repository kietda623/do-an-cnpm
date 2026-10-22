import { Global, Module } from "@nestjs/common";
import { TRANSACTION_CONTEXT } from "../common/database/transaction-context.js";
import { DatabaseService } from "./prisma.service.js";
import { PrismaTransactionContext } from "./transaction-context.js";

@Global()
@Module({
  providers: [
    DatabaseService,
    PrismaTransactionContext,
    { provide: TRANSACTION_CONTEXT, useExisting: PrismaTransactionContext },
  ],
  exports: [DatabaseService, TRANSACTION_CONTEXT],
})
export class DatabaseModule {}
