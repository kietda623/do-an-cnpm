import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createTestPool,
  resetAndDeployMigrations,
  runPrismaMigration,
} from "../helpers/database.js";
import type { Pool } from "pg";

describe("PostgreSQL shared migrations", () => {
  let pool: Pool;

  beforeAll(async () => {
    await resetAndDeployMigrations();
    pool = await createTestPool();
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
  });

  it("applies a fresh migration and remains stable when deploy is repeated", async () => {
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('addresses', 'assets', 'audit_events', 'idempotency_records', 'sessions', 'users')
       ORDER BY table_name`,
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "addresses",
      "assets",
      "audit_events",
      "idempotency_records",
      "sessions",
      "users",
    ]);

    const before = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name IN ('0001_shared', '0002_identity_assets') AND finished_at IS NOT NULL`,
    );
    expect(before.rows[0]?.count).toBe("2");

    runPrismaMigration("deploy");

    const after = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM "_prisma_migrations"
       WHERE migration_name IN ('0001_shared', '0002_identity_assets') AND finished_at IS NOT NULL`,
    );
    expect(after.rows[0]?.count).toBe(before.rows[0]?.count);
  }, 120_000);

  it("enforces identity, default-address, asset, and actor foreign-key constraints", async () => {
    const user = await pool.query<{ id: string }>(
      `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
       VALUES ('migration-buyer@example.test', 'hash', 'Migration Buyer')
       RETURNING "id"`,
    );
    const userId = user.rows[0]!.id;

    await expect(
      pool.query(
        `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
         VALUES ('Migration-Buyer@example.test', 'hash', 'Not Normalized')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const defaultAddress = (line1: string) =>
      pool.query(
        `INSERT INTO "addresses" (
           "user_id", "recipient_name", "phone", "line1", "ward", "district", "province", "country", "is_default"
         ) VALUES ($1, 'Buyer', '0901234567', $2, 'Ward', 'District', 'Province', 'VN', true)`,
        [userId, line1],
      );
    await defaultAddress("1 Migration Street");
    await expect(defaultAddress("2 Migration Street")).rejects.toMatchObject({
      code: "23505",
    });
    await pool.query(
      `UPDATE "addresses" SET "deleted_at" = CURRENT_TIMESTAMP WHERE "user_id" = $1`,
      [userId],
    );
    await defaultAddress("2 Migration Street");

    const asset = await pool.query<{ id: string }>(
      `INSERT INTO "assets" (
         "uploader_user_id", "purpose", "object_key", "mime_type", "byte_size", "width", "height", "status"
       ) VALUES ($1, 'AVATAR', 'test/migration-avatar.png', 'image/png', 128, 16, 16, 'VERIFIED')
       RETURNING "id"`,
      [userId],
    );
    await pool.query(
      `UPDATE "users" SET "avatar_asset_id" = $1 WHERE "id" = $2`,
      [asset.rows[0]!.id, userId],
    );

    await expect(
      pool.query(
        `INSERT INTO "assets" (
           "uploader_user_id", "purpose", "object_key", "mime_type", "byte_size", "width", "height"
         ) VALUES ($1, 'AVATAR', 'test/oversized.png', 'image/png', 5242881, 16, 16)`,
        [userId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await pool.query(
      `INSERT INTO "audit_events" (
         "actor_user_id", "actor_kind", "action", "target_type", "target_id", "outcome", "request_id"
       ) VALUES ($1, 'USER', 'profile.read', 'User', $1, 'SUCCESS', gen_random_uuid())`,
      [userId],
    );
    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" ("actor_user_id", "actor_scope", "operation", "idempotency_key", "request_hash")
         VALUES (gen_random_uuid(), 'user:missing', 'test.operation', 'missing-actor', repeat('a', 64))`,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("backfills expired MOCK orders left PENDING without touching ineligible rows", async () => {
    const suffix = randomUUID().slice(0, 8);
    const buyer = await pool.query<{ id: string }>(
      `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
       VALUES ($1, 'hash', 'Backfill Buyer')
       RETURNING "id"`,
      [`backfill-${suffix}@example.test`],
    );
    const buyerId = buyer.rows[0]!.id;
    const insertOrder = async (
      label: string,
      createdAt: Date,
    ): Promise<string> => {
      const order = await pool.query<{ id: string }>(
        `INSERT INTO "marketplace_orders" (
           "buyer_user_id", "public_number", "recipient_snapshot", "payment_method",
           "original_total", "created_at", "payment_deadline"
         ) VALUES ($1, $2, '{}'::jsonb, 'MOCK', 1000, $3, $4)
         RETURNING "id"`,
        [
          buyerId,
          `MIG-${suffix}-${label}`,
          createdAt,
          new Date(createdAt.getTime() + 15 * 60_000),
        ],
      );
      return order.rows[0]!.id;
    };
    const expiredAt = new Date(Date.now() - 16 * 60_000);
    await insertOrder("expired", expiredAt);
    await insertOrder("fresh", new Date());
    const paidId = await insertOrder("paid", expiredAt);
    const payment = await pool.query<{ id: string }>(
      `INSERT INTO "payments" ("order_id", "method") VALUES ($1, 'MOCK') RETURNING "id"`,
      [paidId],
    );
    await pool.query(
      `INSERT INTO "payment_attempts" (
         "payment_id", "attempt_number", "provider", "status",
         "target_seller_orders_snapshot", "amount", "operation_key"
       ) VALUES ($1, 1, 'MOCK', 'SUCCEEDED', '[]'::jsonb, 1000, $2)`,
      [payment.rows[0]!.id, `migration-backfill-${suffix}`],
    );

    const sql = readFileSync(
      resolve(
        process.cwd(),
        "prisma/migrations/0009_backfill_expired_order_status/migration.sql",
      ),
      "utf8",
    );
    const first = await pool.query(sql);
    expect(first.rowCount).toBe(1);
    const second = await pool.query(sql);
    expect(second.rowCount).toBe(0);

    const rows = await pool.query<{
      public_number: string;
      status: string;
      version: number;
    }>(
      `SELECT "public_number", "status", "version"
       FROM "marketplace_orders" WHERE "buyer_user_id" = $1
       ORDER BY "public_number"`,
      [buyerId],
    );
    expect(rows.rows).toEqual([
      {
        public_number: `MIG-${suffix}-expired`,
        status: "CANCELLED",
        version: 1,
      },
      { public_number: `MIG-${suffix}-fresh`, status: "PENDING", version: 0 },
      { public_number: `MIG-${suffix}-paid`, status: "PENDING", version: 0 },
    ]);
  });

  it("enforces append-only audit and idempotency uniqueness/state constraints", async () => {
    const audit = await pool.query<{ id: string }>(
      `INSERT INTO "audit_events" (
         "actor_kind", "action", "target_type", "target_id", "outcome", "request_id", "safe_metadata"
       ) VALUES ('SYSTEM', 'test.migration', 'TestResource', gen_random_uuid(), 'SUCCESS', gen_random_uuid(), '{"suite":"integration"}')
       RETURNING "id"`,
    );
    const auditId = audit.rows[0]!.id;

    await expect(
      pool.query(
        `UPDATE "audit_events" SET "reason" = 'changed' WHERE "id" = $1`,
        [auditId],
      ),
    ).rejects.toMatchObject({ code: "55000" });
    await expect(
      pool.query(`DELETE FROM "audit_events" WHERE "id" = $1`, [auditId]),
    ).rejects.toMatchObject({
      code: "55000",
    });
    await expect(
      pool.query(`TRUNCATE TABLE "audit_events"`),
    ).rejects.toMatchObject({
      code: "55000",
    });
    await expect(
      pool.query(
        `INSERT INTO "audit_events" (
           "actor_kind", "action", "target_type", "target_id", "outcome", "request_id", "safe_metadata"
         ) VALUES ('SYSTEM', 'test.invalid', 'TestResource', gen_random_uuid(), 'SUCCESS', gen_random_uuid(), '[]')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    const insertIdempotency = () =>
      pool.query(
        `INSERT INTO "idempotency_records" ("actor_scope", "operation", "idempotency_key", "request_hash")
         VALUES ('job:test', 'test.operation', 'once', repeat('a', 64))`,
      );
    await insertIdempotency();
    await expect(insertIdempotency()).rejects.toMatchObject({ code: "23505" });
    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" (
           "actor_scope", "operation", "idempotency_key", "request_hash", "state"
         ) VALUES ('job:test', 'test.invalid', 'bad-state', repeat('b', 64), 'COMPLETED')`,
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `INSERT INTO "idempotency_records" (
           "actor_scope", "operation", "idempotency_key", "request_hash", "state", "response_status"
         ) VALUES ('job:test', 'test.invalid', 'missing-status', repeat('c', 64), 'COMPLETED', NULL)`,
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("declares nullable payment attempt fields and the US6 partial uniques/indexes", async () => {
    const columns = await pool.query<{
      column_name: string;
      is_nullable: string;
    }>(
      `SELECT "column_name", "is_nullable"
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'payment_attempts'`,
    );
    const nullable = new Map(
      columns.rows.map(({ column_name, is_nullable }) => [
        column_name,
        is_nullable,
      ]),
    );
    for (const required of [
      "payment_id",
      "attempt_number",
      "provider",
      "settlement_kind",
      "status",
      "target_seller_orders_snapshot",
      "amount",
      "operation_key",
    ])
      expect(nullable.get(required)).toBe("NO");
    for (const optional of [
      "original_attempt_id",
      "compensates_event_id",
      "external_transaction_id",
      "expires_at",
      "settled_at",
    ])
      expect(nullable.get(optional)).toBe("YES");

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT "indexname", "indexdef"
       FROM pg_indexes
       WHERE schemaname = 'public' AND tablename IN (
         'payment_attempts', 'payment_allocations', 'payment_events',
         'simulated_refunds', 'marketplace_orders'
       )`,
    );
    const byName = new Map(
      indexes.rows.map((row) => [row.indexname, row.indexdef]),
    );
    for (const name of [
      "payment_attempts_payment_number_key",
      "payment_attempts_operation_key_key",
      "payment_attempts_compensates_event_id_key",
      "payment_attempts_payment_status_created_idx",
      "payment_allocations_attempt_seller_key",
      "payment_allocations_seller_id_idx",
      "payment_allocations_cod_seller_once",
      "payment_events_provider_external_event_key",
      "payment_events_payment_received_id_idx",
      "simulated_refunds_allocation_id_key",
      "simulated_refunds_operation_key_key",
      "simulated_refunds_seller_created_id_idx",
      "marketplace_orders_payment_deadline_idx",
    ])
      expect(byName.has(name)).toBe(true);
    for (const partial of [
      "payment_attempts_pending_mock_unique",
      "payment_attempts_mock_success_unique",
      "payment_attempts_external_transaction_key",
      "payment_allocations_cod_seller_once",
    ])
      expect(byName.get(partial)).toContain("WHERE");
  });

  it("enforces payment attempt, event, allocation, and refund constraints", async () => {
    const fixture = await createPaymentConstraintFixture(pool);
    const snapshot = [{ sellerOrderId: fixture.sellerOrderId, amount: "1000" }];
    const attempt = (options: PaymentAttemptInput) =>
      insertPaymentAttempt(pool, fixture.paymentId, snapshot, options);

    const pending = await attempt({ number: 1 });
    // One PENDING NORMAL MOCK attempt per payment.
    await expect(attempt({ number: 2 })).rejects.toMatchObject({
      code: "23505",
    });
    // amount > 0 and snapshot must be a JSON array.
    await expect(attempt({ number: 2, amount: "0" })).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      attempt({
        number: 2,
        snapshot: { sellerOrderId: fixture.sellerOrderId, amount: "1000" },
      }),
    ).rejects.toMatchObject({ code: "23514" });
    // settlement link: NORMAL must not carry compensates_event_id, LATE must.
    await expect(
      attempt({ number: 2, compensatesEventId: randomUUID() }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      attempt({ number: 2, settlementKind: "LATE_COMPENSATION" }),
    ).rejects.toMatchObject({ code: "23514" });

    const succeeded = await attempt({
      number: 2,
      status: "SUCCEEDED",
      externalTransactionId: "txn-constraint-1",
    });
    // One SUCCEEDED NORMAL MOCK attempt per payment.
    await expect(
      attempt({ number: 3, status: "SUCCEEDED" }),
    ).rejects.toMatchObject({
      code: "23505",
    });
    // UNIQUE(provider, external_transaction_id) applies only when present.
    await expect(
      attempt({
        number: 3,
        status: "FAILED",
        externalTransactionId: "txn-constraint-1",
      }),
    ).rejects.toMatchObject({ code: "23505" });
    await attempt({ number: 3, status: "FAILED" });
    await attempt({ number: 4, status: "FAILED" });
    await expect(
      attempt({ number: 1, status: "FAILED" }),
    ).rejects.toMatchObject({
      code: "23505",
    });
    // Snapshot is immutable after insert.
    await expect(
      pool.query(
        `UPDATE "payment_attempts"
         SET "target_seller_orders_snapshot" = '[]'::jsonb
         WHERE "id" = $1`,
        [succeeded.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "P0001" });

    // Allocations require a SUCCEEDED attempt.
    const allocation = (options: PaymentAllocationInput) =>
      insertPaymentAllocation(pool, succeeded.rows[0]!.id, options);
    await expect(
      insertPaymentAllocation(pool, pending.rows[0]!.id, {
        sellerOrderId: fixture.sellerOrderId,
        amount: "1000",
      }),
    ).rejects.toMatchObject({ code: "P0001" });
    const firstAllocation = await allocation({
      sellerOrderId: fixture.sellerOrderId,
      amount: "1000",
    });
    await expect(
      allocation({ sellerOrderId: fixture.sellerOrderId, amount: "1000" }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      allocation({ sellerOrderId: fixture.secondSellerOrderId, amount: "0" }),
    ).rejects.toMatchObject({ code: "23514" });
    const codAllocation = await allocation({
      sellerOrderId: fixture.secondSellerOrderId,
      amount: "400",
      kind: "COD_COLLECTION",
    });

    // PaymentEvent identity is unique per provider and its digest/late fields are checked.
    const insertEvent = (
      externalEventId: string,
      digest: string,
      late?: { amount: string; transactionId: string | null },
    ) =>
      pool.query<{ id: string }>(
        `INSERT INTO "payment_events" (
           "payment_id", "provider", "external_event_id", "payload_digest",
           "observed_status", "processing_result", "late_received_amount", "late_received_transaction_id"
         ) VALUES ($1, 'MOCK', $2, $3, 'SUCCEEDED', 'REFUNDED', $4, $5)
         RETURNING "id"`,
        [
          fixture.paymentId,
          externalEventId,
          digest,
          late?.amount ?? null,
          late?.transactionId ?? null,
        ],
      );
    const event = await insertEvent("evt-constraint-1", "a".repeat(64));
    await expect(
      insertEvent("evt-constraint-1", "b".repeat(64)),
    ).rejects.toMatchObject({
      code: "23505",
    });
    await expect(
      insertEvent("evt-constraint-2", "not-a-digest"),
    ).rejects.toMatchObject({
      code: "23514",
    });
    await expect(
      insertEvent("evt-constraint-3", "c".repeat(64), {
        amount: "0",
        transactionId: null,
      }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      insertEvent("evt-constraint-4", "d".repeat(64), {
        amount: "100",
        transactionId: null,
      }),
    ).rejects.toMatchObject({ code: "23514" });

    // Late compensation links back to one source event and the original attempt.
    const late = await attempt({
      number: 5,
      status: "SUCCEEDED",
      settlementKind: "LATE_COMPENSATION",
      compensatesEventId: event.rows[0]!.id,
      originalAttemptId: succeeded.rows[0]!.id,
    });
    await expect(
      attempt({
        number: 6,
        status: "SUCCEEDED",
        settlementKind: "LATE_COMPENSATION",
        compensatesEventId: event.rows[0]!.id,
        originalAttemptId: succeeded.rows[0]!.id,
      }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      insertPaymentAllocation(pool, late.rows[0]!.id, {
        sellerOrderId: fixture.secondSellerOrderId,
        amount: "400",
        kind: "COD_COLLECTION",
      }),
    ).rejects.toMatchObject({ code: "23505" });

    const refund = (options: SimulatedRefundInput) =>
      insertSimulatedRefund(pool, options);
    const firstRefund = await refund({
      allocationId: firstAllocation.rows[0]!.id,
      sellerOrderId: fixture.sellerOrderId,
      amount: "1000",
    });
    await expect(
      refund({
        allocationId: firstAllocation.rows[0]!.id,
        sellerOrderId: fixture.sellerOrderId,
        amount: "1000",
      }),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      refund({
        allocationId: codAllocation.rows[0]!.id,
        sellerOrderId: fixture.secondSellerOrderId,
        amount: "399",
      }),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      refund({
        allocationId: codAllocation.rows[0]!.id,
        sellerOrderId: fixture.sellerOrderId,
        amount: "400",
      }),
    ).rejects.toMatchObject({ code: "P0001" });
    const lateAllocation = await insertPaymentAllocation(
      pool,
      late.rows[0]!.id,
      {
        sellerOrderId: fixture.sellerOrderId,
        amount: "1000",
      },
    );
    await expect(
      refund({
        allocationId: lateAllocation.rows[0]!.id,
        sellerOrderId: fixture.sellerOrderId,
        amount: "1000",
        status: "FAILED",
      }),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      refund({
        allocationId: lateAllocation.rows[0]!.id,
        sellerOrderId: fixture.sellerOrderId,
        amount: "0",
      }),
    ).rejects.toMatchObject({ code: "P0001" });

    // Allocations, refunds, and events are append-only.
    await expect(
      pool.query(
        `UPDATE "payment_allocations" SET "amount" = 1 WHERE "id" = $1`,
        [firstAllocation.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query(`DELETE FROM "payment_allocations" WHERE "id" = $1`, [
        firstAllocation.rows[0]!.id,
      ]),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query(
        `UPDATE "simulated_refunds" SET "amount" = 1 WHERE "id" = $1`,
        [firstRefund.rows[0]!.id],
      ),
    ).rejects.toMatchObject({ code: "P0001" });
    await expect(
      pool.query(`DELETE FROM "payment_events" WHERE "id" = $1`, [
        event.rows[0]!.id,
      ]),
    ).rejects.toMatchObject({ code: "P0001" });
  });
});

type PaymentConstraintFixture = {
  paymentId: string;
  sellerOrderId: string;
  secondSellerOrderId: string;
};

type PaymentAttemptInput = {
  number: number;
  status?: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  settlementKind?: "NORMAL" | "LATE_COMPENSATION";
  snapshot?: unknown;
  amount?: string;
  externalTransactionId?: string | null;
  originalAttemptId?: string | null;
  compensatesEventId?: string | null;
};

type PaymentAllocationInput = {
  sellerOrderId: string;
  amount: string;
  kind?: "MOCK_PREPAYMENT" | "COD_COLLECTION";
};

type SimulatedRefundInput = {
  allocationId: string;
  sellerOrderId: string;
  amount: string;
  status?: string;
};

async function createPaymentConstraintFixture(
  pool: Pool,
): Promise<PaymentConstraintFixture> {
  const suffix = randomUUID().slice(0, 8);
  const buyer = await pool.query<{ id: string }>(
    `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
     VALUES ($1, 'hash', 'Payment Constraint Buyer')
     RETURNING "id"`,
    [`payment-constraint-buyer-${suffix}@example.test`],
  );
  const owner = await pool.query<{ id: string }>(
    `INSERT INTO "users" ("email_normalized", "password_hash", "display_name")
     VALUES ($1, 'hash', 'Payment Constraint Owner')
     RETURNING "id"`,
    [`payment-constraint-owner-${suffix}@example.test`],
  );
  const buyerId = buyer.rows[0]!.id;
  const ownerId = owner.rows[0]!.id;
  const insertShop = async (label: string) => {
    const logo = await pool.query<{ id: string }>(
      `INSERT INTO "assets" (
         "uploader_user_id", "purpose", "object_key", "mime_type", "byte_size", "width", "height", "status"
       ) VALUES ($1, 'AVATAR', $2, 'image/png', 64, 1, 1, 'VERIFIED')
       RETURNING "id"`,
      [ownerId, `test/payment-constraint-logo-${suffix}-${label}.png`],
    );
    const shop = await pool.query<{ id: string }>(
      `INSERT INTO "shops" (
         "owner_user_id", "name", "slug_normalized", "description", "logo_asset_id", "contact_address", "phone"
       ) VALUES ($1, $2, $3, 'Payment constraint shop', $4, 'Test', '0901234567')
       RETURNING "id"`,
      [
        ownerId,
        `Payment Constraint ${suffix} ${label}`,
        `payment-constraint-${suffix}-${label}`,
        logo.rows[0]!.id,
      ],
    );
    return shop.rows[0]!.id;
  };
  const firstShopId = await insertShop("one");
  const secondShopId = await insertShop("two");
  const createdAt = new Date();
  const order = await pool.query<{ id: string }>(
    `INSERT INTO "marketplace_orders" (
       "buyer_user_id", "public_number", "recipient_snapshot", "payment_method",
       "original_total", "created_at", "payment_deadline"
     ) VALUES ($1, $2, '{}'::jsonb, 'MOCK', 1000, $3::timestamptz, $3::timestamptz + INTERVAL '15 minutes')
     RETURNING "id"`,
    [buyerId, `PAY-CON-${suffix}`, createdAt],
  );
  const insertPart = async (shopId: string, amount: number) => {
    const part = await pool.query<{ id: string }>(
      `INSERT INTO "seller_orders" (
         "order_id", "shop_id", "shop_name_snapshot", "original_total"
       ) VALUES ($1, $2, $3, $4)
       RETURNING "id"`,
      [order.rows[0]!.id, shopId, `Payment Constraint ${suffix}`, amount],
    );
    return part.rows[0]!.id;
  };
  const sellerOrderId = await insertPart(firstShopId, 1000);
  const secondSellerOrderId = await insertPart(secondShopId, 400);
  const payment = await pool.query<{ id: string }>(
    `INSERT INTO "payments" ("order_id", "method") VALUES ($1, 'MOCK') RETURNING "id"`,
    [order.rows[0]!.id],
  );
  return {
    paymentId: payment.rows[0]!.id,
    sellerOrderId,
    secondSellerOrderId,
  };
}

function insertPaymentAttempt(
  pool: Pool,
  paymentId: string,
  defaultSnapshot: unknown,
  options: PaymentAttemptInput,
) {
  return pool.query<{ id: string }>(
    `INSERT INTO "payment_attempts" (
       "payment_id", "attempt_number", "provider", "settlement_kind",
       "original_attempt_id", "compensates_event_id", "status",
       "target_seller_orders_snapshot", "amount", "external_transaction_id", "operation_key"
     ) VALUES (
       $1, $2, 'MOCK', $3::"payment_settlement_kind", $4, $5,
       $6::"payment_attempt_status", $7::jsonb, $8, $9, $10
     )
     RETURNING "id"`,
    [
      paymentId,
      options.number,
      options.settlementKind ?? "NORMAL",
      options.originalAttemptId ?? null,
      options.compensatesEventId ?? null,
      options.status ?? "PENDING",
      JSON.stringify(options.snapshot ?? defaultSnapshot),
      options.amount ?? "1000",
      options.externalTransactionId ?? null,
      `constraint-attempt-${randomUUID()}`,
    ],
  );
}

function insertPaymentAllocation(
  pool: Pool,
  attemptId: string,
  options: PaymentAllocationInput,
) {
  return pool.query<{ id: string }>(
    `INSERT INTO "payment_allocations" ("attempt_id", "seller_order_id", "amount", "kind")
     VALUES ($1, $2, $3, $4::"payment_allocation_kind")
     RETURNING "id"`,
    [
      attemptId,
      options.sellerOrderId,
      options.amount,
      options.kind ?? "MOCK_PREPAYMENT",
    ],
  );
}

function insertSimulatedRefund(pool: Pool, options: SimulatedRefundInput) {
  return pool.query<{ id: string }>(
    `INSERT INTO "simulated_refunds" (
       "allocation_id", "seller_order_id", "amount", "reason", "status", "operation_key"
     ) VALUES ($1, $2, $3, 'CANCELLATION', $4, $5)
     RETURNING "id"`,
    [
      options.allocationId,
      options.sellerOrderId,
      options.amount,
      options.status ?? "SUCCEEDED",
      `constraint-refund-${randomUUID()}`,
    ],
  );
}
