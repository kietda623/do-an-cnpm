/**
 * Public unit-of-work boundary for cross-module operations. The transaction
 * type stays generic here so common/application code does not import Prisma.
 */
export interface TransactionContext<Transaction> {
  run<Result>(operation: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

/** Nest injection token for the persistence adapter. */
export const TRANSACTION_CONTEXT = Symbol("TRANSACTION_CONTEXT");
