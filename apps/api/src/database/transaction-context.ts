import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import type { TransactionContext as TransactionContextPort } from "../common/database/transaction-context.js";
import { DatabaseService } from "./prisma.service.js";

@Injectable()
export class PrismaTransactionContext implements TransactionContextPort<Prisma.TransactionClient> {
  constructor(private readonly database: DatabaseService) {}

  run<Result>(
    operation: (transaction: Prisma.TransactionClient) => Promise<Result>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<Result> {
    return this.database.prisma.$transaction(operation, options);
  }
}
