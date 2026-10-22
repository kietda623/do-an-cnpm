import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";
import { DatabaseService } from "./prisma.service.js";

@Injectable()
export class TransactionContext {
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
