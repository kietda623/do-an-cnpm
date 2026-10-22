import { Global, Module } from "@nestjs/common";
import { DatabaseService } from "./prisma.service.js";
import { TransactionContext } from "./transaction-context.js";

@Global()
@Module({
  providers: [DatabaseService, TransactionContext],
  exports: [DatabaseService, TransactionContext],
})
export class DatabaseModule {}
