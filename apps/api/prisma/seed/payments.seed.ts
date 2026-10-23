import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.ts";
import { Pool } from "pg";

dotenv.config({ path: resolve(process.cwd(), "../../.env.test"), quiet: true });
const url = process.env.TEST_DATABASE_URL?.trim();
const orderId = process.env.PAYMENT_FIXTURE_ORDER_ID?.trim();
if (!url || !orderId)
  throw new Error("Set TEST_DATABASE_URL and PAYMENT_FIXTURE_ORDER_ID for payment fixtures.");
const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
if (
  !/(?:_test|_disposable)$/i.test(databaseName) ||
  process.env.TEST_DATABASE_NAME_CONFIRMATION !== databaseName
)
  throw new Error("Payment fixtures are restricted to the confirmed disposable test database.");
const pool = new Pool({ connectionString: url, max: 2 });
const db = new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: true }) });
try {
  const order = await db.marketplaceOrder.findUnique({
    where: { id: orderId },
    include: { sellerOrders: true, payment: { include: { attempts: true } } },
  });
  if (
    !order ||
    order.paymentMethod !== "MOCK" ||
    !order.payment ||
    !order.paymentDeadline ||
    order.sellerOrders.some((part) => part.status !== "PENDING")
  )
    throw new Error(
      "The selected fixture must be an unpaid MOCK order with pending seller orders and a payment deadline.",
    );
  if (order.payment.attempts.length)
    throw new Error(
      "The selected fixture already has payment attempts; use a fresh checkout order.",
    );
  const snapshot = order.sellerOrders.map((part) => ({
    sellerOrderId: part.id,
    amount: part.originalTotal.toString(),
  }));
  const amount = snapshot.reduce((total, part) => total + BigInt(part.amount), 0n).toString();
  await db.$transaction(async (tx) => {
    const now = (await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0]!.now;
    if (order.paymentDeadline! <= now)
      throw new Error("Fixture order payment deadline has elapsed.");
    await tx.paymentAttempt.create({
      data: {
        paymentId: order.payment!.id,
        attemptNumber: 1,
        provider: "MOCK",
        settlementKind: "NORMAL",
        status: "PENDING",
        targetSellerOrdersSnapshot: snapshot,
        amount,
        expiresAt: order.paymentDeadline,
        operationKey: `seed-payment:${order.id}`,
      },
    });
    await tx.payment.update({
      where: { id: order.payment!.id },
      data: { version: { increment: 1 } },
    });
    await tx.marketplaceOrder.update({
      where: { id: order.id },
      data: { version: { increment: 1 } },
    });
  });
  console.info(
    `Created a pending mock-payment fixture for order ${order.id} (${amount} VND, ${snapshot.length} seller order(s)).`,
  );
} finally {
  await db.$disconnect();
}
